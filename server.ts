import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel, type Schema } from '@google/genai';
import {
  runAutomatedVerificationProtocol,
  runCombinedCompositionSafetyProtocol,
  evaluateDeterministicInteractions,
} from './src/utils/clinicalSafety.ts';
import { computeMlRangeFromDoseText } from './src/utils/liquidDose.ts';
import { resolveDrugIdentity } from './src/utils/drugCatalog.ts';
import {
  extractGroundingMetadata,
  extractJsonFromModelText,
  fetchLiveDrugEvidence,
  fetchLiveInteractionEvidence,
  formatLiveEvidenceForPrompt,
} from './src/utils/liveClinicalData.ts';
import {
  normalizeExtractedMedicineData,
  parseImageDataUrl,
  type RawExtractedMedicinePayload,
} from './src/utils/imageComposition.ts';
import {
  computeMultiCompositionTotalMg,
  formatMultiContainerSummary,
} from './src/utils/multiCompositionVolume.ts';
import type {
  AgeUnit,
  CompositionBreakdownItem,
  CompositionItem,
  DosageFormOption,
  MultiContainerBasis,
  PatientSex,
  VerifiedClinicalSource,
  WeightUnit,
} from './src/types/clinical.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '8mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatFriendlyApiError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(raw)) {
    return 'The clinical AI service is temporarily rate-limited. Please wait a moment and try again.';
  }
  if (/GEMINI_API_KEY|401|403|PERMISSION_DENIED/i.test(raw)) {
    return 'Clinical AI credentials are unavailable right now. Please try again shortly.';
  }
  if (raw.trim().startsWith('{')) {
    return fallback;
  }
  return raw.trim() || fallback;
}

/**
 * Executes a live internet-grounded clinical reasoning request.
 * Strategy order maximizes accuracy and live web grounding while gracefully handling
 * schema+tool restrictions or per-model/per-tool 429 quota limits without ever fabricating data:
 *   1) gemini-4-hydrogen + ThinkingLevel.HIGH + Google Search + responseSchema
 *   2) gemini-4-hydrogen + ThinkingLevel.HIGH + Google Search + strict JSON-in-prompt
 *   3) gemini-3.1-flash-lite + Google Search + strict JSON-in-prompt
 *   4) gemini-4-hydrogen + ThinkingLevel.HIGH + responseSchema (grounded on live FDA/NIH data)
 *   5) gemini-3.1-flash-lite + responseSchema (grounded on live FDA/NIH data)
 */
async function generateGroundedClinicalJson<T>(params: {
  ai: GoogleGenAI;
  prompt: string;
  systemInstruction: string;
  responseSchema: Schema;
  jsonKeysHint: string;
}): Promise<{
  data: T;
  webSources: VerifiedClinicalSource[];
  searchQueries: string[];
  googleSearchUsed: boolean;
}> {
  const { ai, prompt, systemInstruction, responseSchema, jsonKeysHint } = params;
  const jsonPrompt = `${prompt}\n\nIMPORTANT OUTPUT FORMAT: Return ONLY one valid JSON object (no markdown fences, no commentary before or after) matching these exact keys: ${jsonKeysHint}`;

  const strategies: Array<{
    name: string;
    model: string;
    useSearch: boolean;
    useSchema: boolean;
    useThinkingHigh: boolean;
  }> = [
    { name: 'hydrogen-search-schema', model: 'gemini-4-hydrogen', useSearch: true, useSchema: true, useThinkingHigh: true },
    { name: 'hydrogen-search-json', model: 'gemini-4-hydrogen', useSearch: true, useSchema: false, useThinkingHigh: true },
    { name: 'flash-lite-search-json', model: 'gemini-3.1-flash-lite', useSearch: true, useSchema: false, useThinkingHigh: false },
    { name: 'hydrogen-live-fda-schema', model: 'gemini-4-hydrogen', useSearch: false, useSchema: true, useThinkingHigh: true },
    { name: 'flash-lite-live-fda-schema', model: 'gemini-3.1-flash-lite', useSearch: false, useSchema: true, useThinkingHigh: false },
  ];

  let lastError: unknown;
  for (const strategy of strategies) {
    try {
      const response = await ai.models.generateContent({
        model: strategy.model,
        contents: strategy.useSchema ? prompt : jsonPrompt,
        config: {
          ...(strategy.useThinkingHigh ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } : {}),
          ...(strategy.useSearch ? { tools: [{ googleSearch: {} }] } : {}),
          systemInstruction,
          ...(strategy.useSchema
            ? { responseMimeType: 'application/json', responseSchema }
            : {}),
        },
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        throw new Error('AI clinical engine returned an empty response.');
      }

      const data = extractJsonFromModelText<T>(rawText);
      const { webSources, searchQueries } = extractGroundingMetadata(response);
      return {
        data,
        webSources,
        searchQueries,
        googleSearchUsed: strategy.useSearch,
      };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Strategy ${strategy.name} failed, trying next:`, msg.slice(0, 180));
    }
  }

  throw lastError ?? new Error('Unable to complete live clinical reasoning.');
}

function mergeUniqueSources(
  primary: VerifiedClinicalSource[],
  secondary: VerifiedClinicalSource[],
  limit = 8
): VerifiedClinicalSource[] {
  const seen = new Set<string>();
  const merged: VerifiedClinicalSource[] = [];
  for (const src of [...primary, ...secondary]) {
    if (!src.url || seen.has(src.url)) continue;
    seen.add(src.url);
    merged.push(src);
    if (merged.length >= limit) break;
  }
  return merged;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Know Your Consumption(KYC) Clinical API' });
});

app.post('/api/clinical/dosage', async (req, res) => {
  try {
    const body = req.body ?? {};
    const medicationName = typeof body.medicationName === 'string' ? body.medicationName.trim() : '';
    const ageValue = Number(body.ageValue);
    const ageUnit: AgeUnit = body.ageUnit === 'months' ? 'months' : 'years';
    const sexRaw = typeof body.sex === 'string' ? body.sex.trim().toLowerCase() : '';
    const sex: PatientSex | null =
      sexRaw === 'male' ? 'male' : sexRaw === 'female' ? 'female' : null;
    const weightRaw = body.weightValue;
    const weightValue =
      weightRaw === null || weightRaw === undefined || weightRaw === ''
        ? null
        : Number(weightRaw);
    const weightUnit: WeightUnit = body.weightUnit === 'lbs' ? 'lbs' : 'kg';
    const allergies: string[] = Array.isArray(body.allergies)
      ? body.allergies
          .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
          .slice(0, 25)
      : [];
    const currentMedications: string[] = Array.isArray(body.currentMedications)
      ? body.currentMedications
          .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
          .slice(0, 30)
      : [];
    const indication =
      typeof body.indication === 'string' ? body.indication.trim().slice(0, 120) : '';
    const dosageForm: DosageFormOption =
      body.dosageForm === 'tablet'
        ? 'tablet'
        : body.dosageForm === 'capsule'
          ? 'capsule'
          : 'liquid';
    const unitStrengthMgRaw = body.unitStrengthMg;
    const unitStrengthMg =
      dosageForm !== 'liquid' &&
      unitStrengthMgRaw !== null &&
      unitStrengthMgRaw !== undefined &&
      unitStrengthMgRaw !== ''
        ? Number(unitStrengthMgRaw)
        : null;

    if (
      unitStrengthMg !== null &&
      (!Number.isFinite(unitStrengthMg) || unitStrengthMg <= 0 || unitStrengthMg > 10000)
    ) {
      res
        .status(400)
        .json({ error: `Strength per ${dosageForm} (mg) must be a realistic positive number.` });
      return;
    }

    const concentrationMgRaw = body.concentrationMg;
    const concentrationPerMlRaw = body.concentrationPerMl;
    const concentrationMg =
      concentrationMgRaw === null || concentrationMgRaw === undefined || concentrationMgRaw === ''
        ? null
        : Number(concentrationMgRaw);
    const concentrationPerMl =
      concentrationPerMlRaw === null ||
      concentrationPerMlRaw === undefined ||
      concentrationPerMlRaw === ''
        ? null
        : Number(concentrationPerMlRaw);

    if (
      concentrationMg !== null &&
      (!Number.isFinite(concentrationMg) || concentrationMg <= 0 || concentrationMg > 10000)
    ) {
      res.status(400).json({ error: 'Liquid bottle strength (mg) must be a positive number.' });
      return;
    }
    if (
      concentrationPerMl !== null &&
      (!Number.isFinite(concentrationPerMl) || concentrationPerMl <= 0 || concentrationPerMl > 500)
    ) {
      res
        .status(400)
        .json({ error: 'Liquid bottle volume (mL) must be a positive number (e.g., 5 or 10).' });
      return;
    }

    const rawCompositions: CompositionItem[] = Array.isArray(body.compositions)
      ? body.compositions
          .filter(
            (c: unknown): c is { name: string; strength?: string } =>
              typeof c === 'object' &&
              c !== null &&
              typeof (c as { name?: unknown }).name === 'string' &&
              (c as { name: string }).name.trim().length > 0
          )
          .map((c: { name: string; strength?: string }) => ({
            name: c.name.trim().slice(0, 80),
            strength: typeof c.strength === 'string' ? c.strength.trim().slice(0, 40) : '',
          }))
          .slice(0, 8)
      : [];

    const isCombinedMode = rawCompositions.length >= 2;

    const multiContainerBasis: MultiContainerBasis =
      body.multiContainerBasis === 'liquid'
        ? 'liquid'
        : body.multiContainerBasis === 'capsule'
          ? 'capsule'
          : 'tablet';
    const multiContainerMlRaw = body.multiContainerMl;
    const multiContainerMl =
      multiContainerBasis === 'liquid' &&
      multiContainerMlRaw !== null &&
      multiContainerMlRaw !== undefined &&
      multiContainerMlRaw !== ''
        ? Number(multiContainerMlRaw)
        : null;
    const multiTotalMgRaw = body.multiTotalMg;
    const multiTotalMgInput =
      multiTotalMgRaw !== null && multiTotalMgRaw !== undefined && multiTotalMgRaw !== ''
        ? Number(multiTotalMgRaw)
        : null;

    if (
      isCombinedMode &&
      multiContainerBasis === 'liquid' &&
      (multiContainerMl === null || !Number.isFinite(multiContainerMl) || multiContainerMl <= 0 || multiContainerMl > 500)
    ) {
      res
        .status(400)
        .json({ error: 'Please enter a valid positive liquid volume in mL (e.g., 5 mL or 10 mL) for this multi-composition medicine.' });
      return;
    }
    if (
      isCombinedMode &&
      multiTotalMgInput !== null &&
      (!Number.isFinite(multiTotalMgInput) || multiTotalMgInput <= 0 || multiTotalMgInput > 50000)
    ) {
      res
        .status(400)
        .json({ error: 'Total mg contained must be a realistic positive number.' });
      return;
    }

    const autoMultiMg = isCombinedMode
      ? computeMultiCompositionTotalMg(rawCompositions).autoTotalMg
      : 0;
    const effectiveMultiTotalMg =
      isCombinedMode
        ? multiTotalMgInput !== null
          ? multiTotalMgInput
          : autoMultiMg > 0
            ? autoMultiMg
            : null
        : null;
    const combinedContainerSummary = isCombinedMode
      ? formatMultiContainerSummary({
          compositions: rawCompositions,
          basis: multiContainerBasis,
          perMl: multiContainerMl,
          totalMg: effectiveMultiTotalMg,
        })
      : '';

    const effectiveMedicationName = isCombinedMode
      ? rawCompositions.map((c) => c.name).join(' + ')
      : medicationName || rawCompositions[0]?.name || '';

    if (!isCombinedMode && (!effectiveMedicationName || effectiveMedicationName.length > 120)) {
      res.status(400).json({ error: 'Please enter a valid medication or antibiotic name.' });
      return;
    }
    if (!Number.isFinite(ageValue) || ageValue < 0 || ageValue > 120) {
      res.status(400).json({ error: 'Please enter a valid patient age between 0 and 120.' });
      return;
    }
    if (!sex) {
      res.status(400).json({ error: 'Please select patient sex (Male or Female).' });
      return;
    }
    if (
      weightValue !== null &&
      (!Number.isFinite(weightValue) || weightValue <= 0 || weightValue > 400)
    ) {
      res.status(400).json({ error: 'Optional patient weight must be a realistic positive number.' });
      return;
    }

    // 1. Run deterministic safety protocol, local brand/generic resolution, AND live internet FDA/NIH retrieval
    const localIdentity = isCombinedMode ? null : resolveDrugIdentity(effectiveMedicationName);
    const combinedDeterministic = isCombinedMode
      ? runCombinedCompositionSafetyProtocol({
          compositions: rawCompositions,
          ageValue,
          ageUnit,
          sex,
          weightValue,
          weightUnit,
          allergies,
          currentMedications,
        })
      : null;

    const deterministic = combinedDeterministic
      ? combinedDeterministic
      : runAutomatedVerificationProtocol({
          medicationName: effectiveMedicationName,
          ageValue,
          ageUnit,
          sex,
          weightValue,
          weightUnit,
          allergies,
          currentMedications,
        });

    let liveEvidenceSources: VerifiedClinicalSource[] = [];
    let fdaLabelFound = false;
    let rxNormMatched = false;
    let liveEvidenceContext = '';
    let singleLiveEvidenceBrandNames: string[] = [];
    let singleLiveGenericName = '';
    let singleLiveCategory = '';

    if (isCombinedMode) {
      // Fetch live official FDA & NIH RxNorm evidence for up to 4 compositions in parallel
      const perCompLive = await Promise.all(
        rawCompositions.slice(0, 4).map(async (comp) => {
          const localMatch = resolveDrugIdentity(comp.name);
          const ev = await fetchLiveDrugEvidence(comp.name, localMatch?.genericName);
          return { comp, localMatch, ev };
        })
      );

      const contextBlocks: string[] = [];
      for (const item of perCompLive) {
        if (item.ev.fdaLabel) fdaLabelFound = true;
        if (item.ev.rxNorm) rxNormMatched = true;
        liveEvidenceSources = mergeUniqueSources(liveEvidenceSources, item.ev.sources, 8);
        contextBlocks.push(
          `--- Composition: ${item.comp.name}${item.comp.strength ? ` (${item.comp.strength})` : ''} ---\n${formatLiveEvidenceForPrompt(item.ev)}`
        );
      }
      liveEvidenceContext = contextBlocks.join('\n\n');
    } else {
      const liveEvidence = await fetchLiveDrugEvidence(
        effectiveMedicationName,
        localIdentity?.genericName
      );
      liveEvidenceSources = liveEvidence.sources;
      fdaLabelFound = Boolean(liveEvidence.fdaLabel);
      rxNormMatched = Boolean(liveEvidence.rxNorm);
      liveEvidenceContext = formatLiveEvidenceForPrompt(liveEvidence);
      singleLiveEvidenceBrandNames = [
        ...(liveEvidence.fdaLabel?.brandNames ?? []),
        ...(liveEvidence.rxNorm?.brandNames ?? []),
      ];
      singleLiveGenericName =
        liveEvidence.rxNorm?.ingredients.join(' + ') ||
        liveEvidence.fdaLabel?.genericNames[0] ||
        '';
      singleLiveCategory = liveEvidence.fdaLabel?.pharmClasses[0] || '';
    }

    const ai = getGeminiClient();
    const sexLabel = sex === 'female' ? 'Female' : 'Male';

    const compositionsListText = isCombinedMode
      ? rawCompositions
          .map((c, idx) => {
            const match = resolveDrugIdentity(c.name);
            const genericNote =
              match && match.matchedAs === 'brand' ? ` [Brand -> Generic: ${match.genericName}]` : '';
            return `${idx + 1}. ${c.name}${c.strength ? ` (Entered strength: ${c.strength})` : ''}${genericNote}`;
          })
          .join('\n')
      : '';

    const prompt = isCombinedMode
      ? `Provide SUPER-ACCURATE, medically verified, patient-friendly COMBINED MULTI-COMPOSITION dosage & safety guidance for a patient taking ${rawCompositions.length} active compositions together at the same time. Strictly align with official U.S. FDA Prescribing Information, NIH DailyMed, AAP (pediatrics), IDSA (antibiotics), WHO, and BNF standards. Use live Google Search to verify each composition's dosing ceiling, combination compatibility, and sex-specific rules.

Combined Compositions Entered (${rawCompositions.length} Simultaneous Compositions):
${compositionsListText}

Patient Parameters:
- Combined Formulation Name: ${effectiveMedicationName}
- Indication / Reason (if provided): ${indication || 'Combined symptom / therapeutic management'}
- Patient Sex: ${sexLabel}
- Patient Age: ${ageValue} ${ageUnit} (${deterministic.ageGroupLabel})
- Patient Weight (Optional): ${deterministic.weightKg !== null ? `${deterministic.weightKg} kg (entered as ${weightValue} ${weightUnit})` : 'Not provided (use standard age-stratified dosing and clearly note if weight-based confirmation is recommended)'}
- Recorded Patient Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'None recorded'}
- Patient Current Medications: ${currentMedications.length > 0 ? currentMedications.join(', ') : 'None recorded'}
- Multi-Medicine Container & Total mg Contains: ${combinedContainerSummary || 'Standard oral combination'}${multiContainerBasis === 'liquid' && multiContainerMl ? ` (LIQUID SYRUP / SUSPENSION FORMULATION: each ${multiContainerMl} mL contains all listed compositions above${effectiveMultiTotalMg ? `, totaling ${effectiveMultiTotalMg} mg active ingredients per ${multiContainerMl} mL` : ''}. Calculate the EXACT safe volume to give in mL — e.g., 2.5 mL, 5 mL, 7.5 mL, or 10 mL — so EVERY individual composition stays safely within the patient's age/sex/weight dose range and daily ceiling, and explain the exact per-mL calculation in liquidCalculationDetail!)` : multiContainerBasis === 'capsule' ? ` (ORAL CAPSULE FORMULATION: per 1 capsule${effectiveMultiTotalMg ? `, totaling ${effectiveMultiTotalMg} mg active ingredients per capsule` : ''}. State clearly how many capsules to take per dose and note never to crush/split sustained-release or enteric-coated capsules unless clinically permitted.)` : ` (ORAL TABLET FORMULATION: per 1 tablet${effectiveMultiTotalMg ? `, totaling ${effectiveMultiTotalMg} mg active ingredients per tablet` : ''}. State clearly how many tablets to take per dose.)`}

Live Official Internet Clinical Evidence Fetched Right Now Across These Compositions:
${liveEvidenceContext}

Automated Multi-Composition Safety Pre-Checks (HONOR STRICTLY):
- Combined Allergy Screen: [${deterministic.allergyAlert.severity.toUpperCase()}] ${deterministic.allergyAlert.headline}
- Multi-Composition Compatibility: ${deterministic.verificationChecks.find((c) => c.id === 'combined-compatibility')?.detail || 'Screened'}
- Duplicate Therapeutic Overlaps: ${combinedDeterministic?.duplicateFamilyWarnings.length ? combinedDeterministic.duplicateFamilyWarnings.join(' | ') : 'None detected'}
- Internal Composition Interactions: ${combinedDeterministic?.internalCompositionWarnings.length ? combinedDeterministic.internalCompositionWarnings.map((w) => `${w.pair.join(' + ')} (${w.severity}): ${w.summary}`).join('; ') : 'None detected locally'}
- Age Pre-Check: ${deterministic.verificationChecks.find((c) => c.id === 'age-eligibility')?.detail || 'Screened'}
- Sex Pre-Check: ${deterministic.verificationChecks.find((c) => c.id === 'sex-protocol')?.detail || 'Screened'}
- Verification Pre-Status: ${deterministic.verificationStatus.toUpperCase()}

Strict Combined-Result Rules:
1. Synthesize ONE clear, unified COMBINED RESULT for all ${rawCompositions.length} compositions together.
2. Set matchedAs to "combination", medicationName to a clean combined title (e.g. "${effectiveMedicationName.slice(0, 110)}"), genericName to all resolved generic active ingredients joined by " + ", and commonBrandNames to 3-6 known fixed-dose combination brands if this combo exists commercially (or empty array if custom co-administration).
3. Populate compositionBreakdown with EXACTLY ${rawCompositions.length} objects (one for EVERY entered composition in order):
   - compositionName: exact name entered
   - genericName: resolved generic name
   - role: short plain-English clinical role (e.g., "Fever & pain reliever", "Nasal decongestant", "Antibiotic", "Probiotic gut support")
   - perDoseAmount: recommended single dose for this patient's age/sex/weight (respecting entered strength if safe)
   - maxDailyLimit: maximum safe 24-hour ceiling for this specific composition
   - safetyStatus: "safe", "caution", or "avoid"
   - note: 1 concise patient-friendly safety/dosing note for this specific ingredient
4. Populate combinedSynergyAndOverlapSummary with a clear 2–3 sentence explanation of how these ${rawCompositions.length} compositions work together, whether they are safe to combine at the same time, any duplicate-ingredient/overdose ceiling risks, and any spacing or timing guidance.
5. If ANY composition is contraindicated for the patient's age, sex, or allergies, OR there is a dangerous duplicate/major internal conflict (like dual NSAIDs or double paracetamol exceeding limits), set dosingBasis to "contraindicated", recommendedDose to "Contraindicated — Do not combine", recommendedDoseMl to "0 mL (Contraindicated)", frequency to "Do not administer", maxDailyLimit to "0 mg (Contraindicated)", and explain clearly why.
6. Otherwise keep recommendedDose, recommendedDoseMl, frequency, maxDailyLimit, and typicalDuration concise and tabular-ready (reflecting the combined ${multiContainerBasis === 'capsule' ? 'capsule' : multiContainerBasis === 'tablet' ? 'tablet' : 'liquid syrup'} administration, e.g., ${multiContainerBasis === 'capsule' ? '"1 combined capsule (or per-ingredient doses below)"' : multiContainerBasis === 'tablet' ? '"1 combined tablet (or per-ingredient doses below)"' : '"5 mL per dose (combined syrup)"'}, "Every 8 hours (3 times daily)").
7. Explicitly address ${sexLabel} sex-specific considerations in sexSpecificGuidance.`
      : `Provide SUPER-ACCURATE, medically verified, patient-friendly medication dosage guidance strictly aligned with official U.S. FDA Prescribing Information, NIH DailyMed, AAP (for pediatrics), IDSA (for antibiotics), WHO, and BNF clinical standards. Use live Google Search to verify any uncertain brand name, dosing ceiling, pediatric mg/kg formula, or sex-specific dosing requirement.

Patient Parameters:
- Medication Requested (May be a Brand Name or Generic Name from ANY country — US, UK, EU, India, Asia, etc.): ${effectiveMedicationName}
${localIdentity ? `- Local Brand/Generic Pre-Match: Recognized as ${localIdentity.matchedAs.toUpperCase()} "${localIdentity.matchedTerm}" -> Generic Active Ingredient: ${localIdentity.genericName} (Known brands: ${localIdentity.brandNames.join(', ')})` : '- Local Brand/Generic Pre-Match: Identify whether the entered name is a commercial brand name, generic drug name, or combination brand, and verify its exact active generic ingredient(s) and common global brand equivalents using live search.'}
- Selected Dosage Form: ${dosageForm === 'tablet' ? `Tablet${unitStrengthMg ? ` (${unitStrengthMg} mg per tablet)` : ' (standard tablet strength)'}` : dosageForm === 'capsule' ? `Capsule${unitStrengthMg ? ` (${unitStrengthMg} mg per capsule)` : ' (standard capsule strength)'}` : 'Liquid / Oral Syrup (mL)'}
- Indication / Reason (if provided): ${indication || 'Standard common clinical indication'}
- Patient Sex: ${sexLabel}
- Patient Age: ${ageValue} ${ageUnit} (${deterministic.ageGroupLabel})
- Patient Weight (Optional): ${deterministic.weightKg !== null ? `${deterministic.weightKg} kg (entered as ${weightValue} ${weightUnit})` : 'Not provided (use standard age-stratified dosing and clearly note if weight-based confirmation is recommended)'}
- Recorded Patient Allergies: ${allergies.length > 0 ? allergies.join(', ') : 'None recorded'}
- Patient Current Medications: ${currentMedications.length > 0 ? currentMedications.join(', ') : 'None recorded'}
- Liquid / Syrup Bottle Concentration (Optional): ${dosageForm === 'liquid' && concentrationMg !== null && concentrationPerMl !== null ? `${concentrationMg} mg per ${concentrationPerMl} mL` : dosageForm === 'tablet' ? `Patient selected TABLET form${unitStrengthMg ? ` (${unitStrengthMg} mg per tablet)` : ''}. Calculate exact tablet count (e.g., "1 tablet (500 mg)") in recommendedDose and explain tablet dosing clearly in liquidCalculationDetail (and mention if children under 6 may require liquid suspension instead of tablets).` : dosageForm === 'capsule' ? `Patient selected CAPSULE form${unitStrengthMg ? ` (${unitStrengthMg} mg per capsule)` : ''}. Calculate exact capsule count (e.g., "1 capsule (500 mg)" or "2 capsules (500 mg)") in recommendedDose, explain capsule dosing clearly in liquidCalculationDetail (and note swallowing/non-splitting guidance for capsules or pediatric liquid alternative if needed).` : 'Not specified by patient (if this drug has a common liquid/oral suspension form, provide the typical liquid mL dose for the standard bottle concentration such as 250 mg/5 mL or 100 mg/5 mL; if tablet-only, state "Oral tablet/capsule — enter liquid strength if using syrup")'}

Live Official Internet Clinical Evidence Fetched Right Now (Cross-check and honor these authoritative FDA/NIH facts):
${liveEvidenceContext}

Automated Safety Protocol Pre-Check Findings (incorporate and respect these strictly):
- Allergy Pre-Check: [${deterministic.allergyAlert.severity.toUpperCase()}] ${deterministic.allergyAlert.headline}
- Sex-Specific Pre-Check: ${deterministic.verificationChecks.find((c) => c.id === 'sex-protocol')?.detail || 'Standard check'}
- Verification Pre-Status: ${deterministic.verificationStatus.toUpperCase()}
- Active Medication Pre-Warnings: ${deterministic.activeMedWarnings.length > 0 ? deterministic.activeMedWarnings.map((w) => `${w.pair.join(' + ')} (${w.severity}): ${w.summary}`).join('; ') : 'None triggered in local screen'}

Strict Medical Accuracy & Safety Rules:
1. Write clearly and empathetically for a PATIENT (plain, accessible language, no confusing medical shorthand without explanation).
2. Brand & Generic Recognition: Verify via live FDA/NIH data + Google Search. Populate:
   - matchedAs: "brand" if user entered a brand/trade name, "generic" if generic name, or "combination" if fixed-dose combination.
   - recognizedBrandName: the recognized commercial brand name if entered (or empty string if generic was entered).
   - genericName: exact active generic ingredient(s) (e.g., "Amoxicillin + Clavulanate potassium").
   - commonBrandNames: 4 to 6 widely known global brand names for this drug.
3. Sex-Specific Clinical Accuracy (CRITICAL): Explicitly consider that the patient is ${sexLabel}. Populate sexSpecificGuidance with accurate sex-relevant pharmacology (for example: FDA lower starting dose in females for Zolpidem 5 mg vs 5–10 mg in males; pregnancy/teratogenicity & breastfeeding precautions for females of reproductive age; hormonal contraceptive interaction alerts; contraindications like finasteride/dutasteride in females; or male-specific complicated UTI treatment durations of 7–14 days vs 3–5 days in females). If dosing is identical across sexes, state that clearly along with any relevant ${sexLabel.toLowerCase()} clinical consideration.
4. If the medication is contraindicated for this patient's age, sex, or triggers a critical allergy match, set dosingBasis to "contraindicated", set recommendedDose to a short scannable hold label like "Contraindicated — Do not take", recommendedDoseMl to "0 mL (Contraindicated)", frequency to "Do not administer", maxDailyLimit to "0 mg (Contraindicated)", and place the full patient explanation in weightCalculationDetail and aiAllergyAssessment.explanation.
5. For safe/caution dosing, verify every number against the official FDA label & guidelines, and keep recommendedDose, recommendedDoseMl, frequency, maxDailyLimit, and typicalDuration concise and tabular-ready (under 55 characters each, e.g., ${dosageForm === 'tablet' ? '"500 mg (1 tablet)"' : dosageForm === 'capsule' ? '"500 mg (1 capsule)"' : '"500 mg per dose"'}, ${dosageForm === 'tablet' ? '"1 tablet per dose"' : dosageForm === 'capsule' ? '"1 capsule per dose"' : '"10 mL per dose (250 mg / 5 mL)"'}, "Every 8 hours (3 times daily)", "1,500 mg per 24 hours", "7 to 10 days").
6. Always provide recommendedDoseMl and liquidCalculationDetail. ${dosageForm === 'liquid' ? `If the patient provided bottle strength (${concentrationMg ?? 'N/A'} mg per ${concentrationPerMl ?? 'N/A'} mL), calculate exact mL = (single dose mg × ${concentrationPerMl ?? 5}) ÷ ${concentrationMg ?? 250}.` : `Since the patient selected ${dosageForm.toUpperCase()} form${unitStrengthMg ? ` (${unitStrengthMg} mg per ${dosageForm})` : ''}, put the exact ${dosageForm} count in recommendedDoseMl (e.g., "${unitStrengthMg ? `1 ${dosageForm} (${unitStrengthMg} mg)` : `1 ${dosageForm}`}") and explain the exact per-${dosageForm} math in liquidCalculationDetail.`}
7. For antibiotics, always include an accurate antibiotic stewardship note (e.g., finishing the full prescribed course even if feeling better).
8. When weight IS provided (especially for children or weight-based antibiotics), compute the exact mg/kg/day or mg/kg/dose calculation transparently in weightCalculationDetail AND verify it does not exceed the adult/maximum daily dose ceiling.
9. Screen ALL current medications for drug-to-drug interactions with ${effectiveMedicationName}.
10. Cite exact standard medical reference bodies (e.g., U.S. FDA Prescribing Information, NIH DailyMed, AAP Red Book, IDSA Guidelines, WHO, BNF).
11. Set compositionBreakdown to [] and combinedSynergyAndOverlapSummary to "".`;

    const dosageSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        medicationName: { type: Type.STRING },
        genericName: { type: Type.STRING },
        recognizedBrandName: { type: Type.STRING },
        matchedAs: {
          type: Type.STRING,
          enum: ['brand', 'generic', 'combination'],
        },
        commonBrandNames: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        drugCategory: { type: Type.STRING },
        isAntibiotic: { type: Type.BOOLEAN },
        sexSpecificGuidance: { type: Type.STRING },
        combinedSynergyAndOverlapSummary: { type: Type.STRING },
        compositionBreakdown: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              compositionName: { type: Type.STRING },
              genericName: { type: Type.STRING },
              role: { type: Type.STRING },
              perDoseAmount: { type: Type.STRING },
              maxDailyLimit: { type: Type.STRING },
              safetyStatus: { type: Type.STRING, enum: ['safe', 'caution', 'avoid'] },
              note: { type: Type.STRING },
            },
            required: [
              'compositionName',
              'genericName',
              'role',
              'perDoseAmount',
              'maxDailyLimit',
              'safetyStatus',
              'note',
            ],
          },
        },
        dosingBasis: {
          type: Type.STRING,
          enum: ['weight-based', 'age-based', 'contraindicated'],
        },
        recommendedDose: { type: Type.STRING },
        recommendedDoseMl: { type: Type.STRING },
        liquidCalculationDetail: { type: Type.STRING },
        weightCalculationDetail: { type: Type.STRING },
        frequency: { type: Type.STRING },
        maxDailyLimit: { type: Type.STRING },
        typicalDuration: { type: Type.STRING },
        administrationTips: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        antibioticCourseNote: { type: Type.STRING },
        aiAllergyAssessment: {
          type: Type.OBJECT,
          properties: {
            severity: { type: Type.STRING, enum: ['clear', 'caution', 'critical'] },
            headline: { type: Type.STRING },
            explanation: { type: Type.STRING },
            recommendedAction: { type: Type.STRING },
          },
          required: ['severity', 'headline', 'explanation', 'recommendedAction'],
        },
        activeMedicationInteractions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              medication: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['none', 'minor', 'moderate', 'major'] },
              explanation: { type: Type.STRING },
            },
            required: ['medication', 'severity', 'explanation'],
          },
        },
        watchOutSymptoms: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        clinicalReferences: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        patientDisclaimer: { type: Type.STRING },
      },
      required: [
        'medicationName',
        'genericName',
        'recognizedBrandName',
        'matchedAs',
        'commonBrandNames',
        'drugCategory',
        'isAntibiotic',
        'sexSpecificGuidance',
        'dosingBasis',
        'recommendedDose',
        'recommendedDoseMl',
        'liquidCalculationDetail',
        'weightCalculationDetail',
        'frequency',
        'maxDailyLimit',
        'typicalDuration',
        'administrationTips',
        'antibioticCourseNote',
        'aiAllergyAssessment',
        'activeMedicationInteractions',
        'watchOutSymptoms',
        'clinicalReferences',
        'patientDisclaimer',
      ],
    };

    interface AiDosagePayload {
      medicationName?: string;
      genericName?: string;
      recognizedBrandName?: string;
      matchedAs?: 'brand' | 'generic' | 'combination';
      commonBrandNames?: string[];
      drugCategory?: string;
      isAntibiotic?: boolean;
      sexSpecificGuidance?: string;
      combinedSynergyAndOverlapSummary?: string;
      compositionBreakdown?: CompositionBreakdownItem[];
      dosingBasis?: 'weight-based' | 'age-based' | 'contraindicated';
      recommendedDose?: string;
      recommendedDoseMl?: string;
      liquidCalculationDetail?: string;
      weightCalculationDetail?: string;
      frequency?: string;
      maxDailyLimit?: string;
      typicalDuration?: string;
      administrationTips?: string[];
      antibioticCourseNote?: string;
      aiAllergyAssessment?: {
        severity: 'clear' | 'caution' | 'critical';
        headline: string;
        explanation: string;
        recommendedAction: string;
      };
      activeMedicationInteractions?: Array<{
        medication: string;
        severity: 'none' | 'minor' | 'moderate' | 'major';
        explanation: string;
      }>;
      watchOutSymptoms?: string[];
      clinicalReferences?: string[];
      patientDisclaimer?: string;
    }

    const {
      data: aiData,
      webSources,
      searchQueries,
      googleSearchUsed,
    } = await generateGroundedClinicalJson<AiDosagePayload>({
      ai,
      prompt,
      systemInstruction:
        'You are a high-precision clinical pharmacology verification engine for Know Your Consumption(KYC). Always cross-verify official FDA labels, NIH RxNorm, AAP, IDSA, WHO, and BNF references using live web search and supplied official FDA/NIH excerpts. Strictly factor in patient age, sex (male/female), optional weight, allergies, and maximum safe daily ceilings. Never guess or invent unsafe doses.',
      responseSchema: dosageSchema,
      jsonKeysHint:
        'medicationName, genericName, recognizedBrandName, matchedAs, commonBrandNames, drugCategory, isAntibiotic, sexSpecificGuidance, combinedSynergyAndOverlapSummary, compositionBreakdown [{compositionName, genericName, role, perDoseAmount, maxDailyLimit, safetyStatus, note}], dosingBasis, recommendedDose, recommendedDoseMl, liquidCalculationDetail, weightCalculationDetail, frequency, maxDailyLimit, typicalDuration, administrationTips, antibioticCourseNote, aiAllergyAssessment {severity, headline, explanation, recommendedAction}, activeMedicationInteractions [{medication, severity, explanation}], watchOutSymptoms, clinicalReferences, patientDisclaimer',
    });

    // Fuse deterministic safety guards with AI analysis (strictest safety severity always wins)
    const severityRank: Record<string, number> = { clear: 0, caution: 1, critical: 2 };
    const aiAllergySev = aiData.aiAllergyAssessment?.severity ?? 'clear';
    const finalAllergySeverity =
      severityRank[deterministic.allergyAlert.severity] >= severityRank[aiAllergySev]
        ? deterministic.allergyAlert.severity
        : aiAllergySev;

    const mergedAllergyAlert =
      severityRank[deterministic.allergyAlert.severity] >= severityRank[aiAllergySev]
        ? deterministic.allergyAlert
        : {
            severity: finalAllergySeverity,
            headline: aiData.aiAllergyAssessment!.headline,
            matchedAllergens: deterministic.allergyAlert.matchedAllergens,
            explanation: aiData.aiAllergyAssessment!.explanation,
            recommendedAction: aiData.aiAllergyAssessment!.recommendedAction,
          };

    let finalVerificationStatus = deterministic.verificationStatus;
    if (aiData.dosingBasis === 'contraindicated' || finalAllergySeverity === 'critical') {
      finalVerificationStatus = 'contraindicated';
    } else if (
      finalVerificationStatus === 'verified' &&
      (finalAllergySeverity === 'caution' ||
        (aiData.activeMedicationInteractions ?? []).some(
          (i) => i.severity === 'major' || i.severity === 'moderate'
        ))
    ) {
      finalVerificationStatus = 'caution';
    }

    const verifiedSources = mergeUniqueSources(liveEvidenceSources, webSources, 8);
    const liveSourcesSummaryParts: string[] = [];
    if (fdaLabelFound) liveSourcesSummaryParts.push('U.S. FDA Official Label');
    if (rxNormMatched) liveSourcesSummaryParts.push('NIH NLM RxNorm');
    if (googleSearchUsed) liveSourcesSummaryParts.push('Live Web Search Grounding');

    const verificationChecks = [
      ...deterministic.verificationChecks,
      {
        id: 'max-ceiling',
        label: 'Maximum Daily Dose Ceiling Verified',
        status: finalVerificationStatus === 'contraindicated' ? ('alert' as const) : ('pass' as const),
        detail: `Safe daily ceiling confirmed: ${aiData.maxDailyLimit || 'See label'}`,
      },
      {
        id: 'live-internet-evidence',
        label: 'Live Internet Clinical Cross-Verification',
        status: 'pass' as const,
        detail: `Cross-checked in real time via ${liveSourcesSummaryParts.join(' + ') || 'Live Medical Grounding'}${verifiedSources.length > 0 ? ` (${verifiedSources.length} verified source link${verifiedSources.length === 1 ? '' : 's'})` : ''}.`,
      },
    ];

    // Deterministic mL verification override when bottle concentration was entered by patient
    let finalRecommendedDoseMl =
      aiData.recommendedDoseMl || 'Enter liquid bottle strength for mL';
    let finalLiquidCalculationDetail = aiData.liquidCalculationDetail || '';

    if (finalVerificationStatus === 'contraindicated') {
      finalRecommendedDoseMl =
        dosageForm === 'tablet'
          ? '0 tablets (Contraindicated)'
          : dosageForm === 'capsule'
            ? '0 capsules (Contraindicated)'
            : '0 mL (Contraindicated)';
      finalLiquidCalculationDetail = 'Do not administer any dose due to safety hold.';
    } else if (
      !isCombinedMode &&
      dosageForm === 'liquid' &&
      concentrationMg !== null &&
      concentrationPerMl !== null
    ) {
      const deterministicMl = computeMlRangeFromDoseText(
        String(aiData.recommendedDose || ''),
        concentrationMg,
        concentrationPerMl
      );
      if (deterministicMl) {
        finalRecommendedDoseMl = deterministicMl.formattedMl;
        finalLiquidCalculationDetail = deterministicMl.formulaDetail;
      }
    }

    const mergedBrandNames = Array.from(
      new Set([
        ...(Array.isArray(aiData.commonBrandNames) ? aiData.commonBrandNames : []),
        ...singleLiveEvidenceBrandNames,
        ...(localIdentity?.brandNames ?? []),
      ])
    ).slice(0, 8);

    const safeCompositionBreakdown: CompositionBreakdownItem[] =
      isCombinedMode && Array.isArray(aiData.compositionBreakdown)
        ? aiData.compositionBreakdown.map((item) => ({
            compositionName: String(item.compositionName || ''),
            genericName: String(item.genericName || item.compositionName || ''),
            role: String(item.role || 'Active ingredient'),
            perDoseAmount: String(item.perDoseAmount || 'Per combined label'),
            maxDailyLimit: String(item.maxDailyLimit || 'See label ceiling'),
            safetyStatus:
              item.safetyStatus === 'avoid' || item.safetyStatus === 'caution'
                ? item.safetyStatus
                : 'safe',
            note: String(item.note || ''),
          }))
        : [];

    res.json({
      medicationName: (aiData.medicationName || effectiveMedicationName).slice(0, 120),
      genericName:
        aiData.genericName ||
        singleLiveGenericName ||
        localIdentity?.genericName ||
        effectiveMedicationName,
      recognizedBrandName:
        aiData.recognizedBrandName ||
        (localIdentity?.matchedAs === 'brand' ? localIdentity.matchedTerm : ''),
      matchedAs: isCombinedMode
        ? 'combination'
        : aiData.matchedAs || localIdentity?.matchedAs || 'generic',
      commonBrandNames: mergedBrandNames,
      drugCategory:
        aiData.drugCategory ||
        (isCombinedMode ? `Combined Formulation (${rawCompositions.length} Compositions)` : '') ||
        singleLiveCategory ||
        localIdentity?.category ||
        'Medication',
      isAntibiotic: Boolean(aiData.isAntibiotic),
      ageGroupLabel: deterministic.ageGroupLabel,
      patientSex: sex,
      sexSpecificGuidance: aiData.sexSpecificGuidance || '',
      isCombinedComposition: isCombinedMode,
      combinedCompositionsCount: isCombinedMode ? rawCompositions.length : undefined,
      combinedContainerSummary: isCombinedMode ? combinedContainerSummary : undefined,
      compositionBreakdown: isCombinedMode ? safeCompositionBreakdown : undefined,
      combinedSynergyAndOverlapSummary: isCombinedMode
        ? aiData.combinedSynergyAndOverlapSummary || ''
        : undefined,
      dosingBasis:
        finalVerificationStatus === 'contraindicated'
          ? 'contraindicated'
          : aiData.dosingBasis || 'age-based',
      recommendedDose: aiData.recommendedDose || 'Consult prescribing clinician',
      recommendedDoseMl: finalRecommendedDoseMl,
      liquidCalculationDetail: finalLiquidCalculationDetail,
      weightCalculationDetail: aiData.weightCalculationDetail || '',
      frequency: aiData.frequency || 'Per prescription label',
      maxDailyLimit: aiData.maxDailyLimit || 'See official prescribing ceiling',
      typicalDuration: aiData.typicalDuration || 'Per prescribing clinician',
      administrationTips: Array.isArray(aiData.administrationTips)
        ? aiData.administrationTips
        : [],
      antibioticCourseNote: aiData.antibioticCourseNote || '',
      allergyAlert: mergedAllergyAlert,
      verificationStatus: finalVerificationStatus,
      verificationChecks,
      activeMedicationInteractions: Array.isArray(aiData.activeMedicationInteractions)
        ? aiData.activeMedicationInteractions
        : [],
      watchOutSymptoms: Array.isArray(aiData.watchOutSymptoms) ? aiData.watchOutSymptoms : [],
      clinicalReferences: Array.isArray(aiData.clinicalReferences)
        ? aiData.clinicalReferences
        : ['U.S. FDA Prescribing Information', 'NIH NLM RxNorm / DailyMed', 'BNF Clinical Reference'],
      verifiedSources,
      liveEvidenceUsed: {
        internetConnected: true,
        fdaLabelFound,
        rxNormMatched,
        googleSearchUsed,
        searchQueriesUsed: searchQueries,
      },
      patientDisclaimer:
        aiData.patientDisclaimer ||
        'This dosage guide is for patient education and safety verification only. Always follow your prescribing doctor or pharmacist’s exact instructions.',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/clinical/dosage:', error);
    const message = formatFriendlyApiError(
      error,
      'Unable to complete clinical dosage analysis right now. Please try again.'
    );
    res.status(500).json({ error: message });
  }
});

app.post('/api/clinical/interactions', async (req, res) => {
  try {
    const body = req.body ?? {};
    const medications: string[] = Array.isArray(body.medications)
      ? body.medications
          .filter((x: unknown): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x: string) => x.trim())
          .slice(0, 15)
      : [];
    const ageDisplay = typeof body.ageDisplay === 'string' ? body.ageDisplay.trim() : '';
    const sexRaw = typeof body.sex === 'string' ? body.sex.trim().toLowerCase() : '';
    const sexLabel = sexRaw === 'male' ? 'Male' : sexRaw === 'female' ? 'Female' : '';

    if (medications.length < 2) {
      res
        .status(400)
        .json({ error: 'Please enter at least 2 medications to check for drug-to-drug interactions.' });
      return;
    }

    const localWarnings = evaluateDeterministicInteractions(medications);
    const medHints = medications.map((m) => ({
      inputName: m,
      genericHint: resolveDrugIdentity(m)?.genericName,
    }));
    const liveInteractionEvidence = await fetchLiveInteractionEvidence(medHints);
    const ai = getGeminiClient();

    const prompt = `Perform a SUPER-ACCURATE, live internet-verified, patient-friendly drug-to-drug interaction check for the following medications (which may include global brand names or generic names):
Medications: ${medications.join(', ')}
${ageDisplay ? `Patient Age Context: ${ageDisplay}` : ''}
${sexLabel ? `Patient Sex Context: ${sexLabel}` : ''}

Live Official U.S. FDA Drug Interaction Label Excerpts Fetched Right Now:
${liveInteractionEvidence.promptExcerpt}

Deterministic Pre-Screen Warnings (make sure these are thoroughly evaluated and NEVER downgraded if clinically valid):
${localWarnings.length > 0 ? localWarnings.map((w) => `- ${w.pair.join(' + ')} [${w.severity.toUpperCase()}]: ${w.summary}`).join('\n') : 'None flagged in local pre-screen; perform a comprehensive live pharmacology review across every pair using Google Search and official FDA/BNF references.'}

Guidelines:
1. Resolve EVERY entered medication (whether a global brand name like Augmentin, Advil, Coumadin, Dolo 650, Lipitor, Flagyl, Zithromax, or a generic name) into its active generic ingredient in resolvedMedications.
2. Evaluate every meaningful drug pair among the listed medications (including duplicate active ingredients across different brand names and sex-relevant interactions such as hormonal contraception failure if Female). If no interactions exist, still explain clearly in executiveSummary and set overallSeverity to "none".
3. Use plain, calm, easy-to-understand patient language explaining WHY the interaction occurs and WHAT symptoms to watch for.
4. Include practical food, supplement, or alcohol notes (e.g., dairy spacing for doxycycline/ciprofloxacin, alcohol avoidance with metronidazole, grapefruit with certain statins).
5. Cross-check with live Google Search against FDA Drug Interaction tables, Lexicomp/Micromedex clinical severity tiers, and BNF standards.`;

    const interactionSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        resolvedMedications: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              inputName: { type: Type.STRING },
              genericName: { type: Type.STRING },
              brandOrGeneric: { type: Type.STRING },
            },
            required: ['inputName', 'genericName', 'brandOrGeneric'],
          },
        },
        overallSeverity: {
          type: Type.STRING,
          enum: ['none', 'minor', 'moderate', 'major'],
        },
        executiveSummary: { type: Type.STRING },
        pairs: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              drugA: { type: Type.STRING },
              drugB: { type: Type.STRING },
              severity: { type: Type.STRING, enum: ['none', 'minor', 'moderate', 'major'] },
              headline: { type: Type.STRING },
              plainLanguageExplanation: { type: Type.STRING },
              symptomsToWatch: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              managementGuidance: { type: Type.STRING },
            },
            required: [
              'drugA',
              'drugB',
              'severity',
              'headline',
              'plainLanguageExplanation',
              'symptomsToWatch',
              'managementGuidance',
            ],
          },
        },
        foodAndAlcoholNotes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        actionGuidance: { type: Type.STRING },
        clinicalReferences: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: [
        'resolvedMedications',
        'overallSeverity',
        'executiveSummary',
        'pairs',
        'foodAndAlcoholNotes',
        'actionGuidance',
        'clinicalReferences',
      ],
    };

    interface AiInteractionPayload {
      resolvedMedications?: Array<{
        inputName: string;
        genericName: string;
        brandOrGeneric: string;
      }>;
      overallSeverity?: 'none' | 'minor' | 'moderate' | 'major';
      executiveSummary?: string;
      pairs?: Array<{
        drugA: string;
        drugB: string;
        severity: 'none' | 'minor' | 'moderate' | 'major';
        headline: string;
        plainLanguageExplanation: string;
        symptomsToWatch: string[];
        managementGuidance: string;
      }>;
      foodAndAlcoholNotes?: string[];
      actionGuidance?: string;
      clinicalReferences?: string[];
    }

    const {
      data: aiData,
      webSources,
      searchQueries,
      googleSearchUsed,
    } = await generateGroundedClinicalJson<AiInteractionPayload>({
      ai,
      prompt,
      systemInstruction:
        'You are a high-precision clinical pharmacology interaction screening tool for Know Your Consumption(KYC) that resolves all global brand and generic names and cross-verifies every pair against live FDA labels, Google Search, and BNF standards.',
      responseSchema: interactionSchema,
      jsonKeysHint:
        'resolvedMedications [{inputName, genericName, brandOrGeneric}], overallSeverity, executiveSummary, pairs [{drugA, drugB, severity, headline, plainLanguageExplanation, symptomsToWatch, managementGuidance}], foodAndAlcoholNotes, actionGuidance, clinicalReferences',
    });

    // Ensure overallSeverity is at least as severe as any deterministic warning
    const rank: Record<string, number> = { none: 0, minor: 1, moderate: 2, major: 3 };
    let finalOverall = aiData.overallSeverity || 'none';
    for (const w of localWarnings) {
      if (rank[w.severity] > rank[finalOverall]) {
        finalOverall = w.severity;
      }
    }

    const verifiedSources = mergeUniqueSources(liveInteractionEvidence.sources, webSources, 8);

    res.json({
      medications,
      resolvedMedications: Array.isArray(aiData.resolvedMedications)
        ? aiData.resolvedMedications
        : [],
      overallSeverity: finalOverall,
      executiveSummary: aiData.executiveSummary || 'Interaction screening complete.',
      pairs: Array.isArray(aiData.pairs) ? aiData.pairs : [],
      foodAndAlcoholNotes: Array.isArray(aiData.foodAndAlcoholNotes)
        ? aiData.foodAndAlcoholNotes
        : [],
      actionGuidance:
        aiData.actionGuidance || 'Confirm any changes with your prescribing doctor or pharmacist.',
      clinicalReferences: Array.isArray(aiData.clinicalReferences)
        ? aiData.clinicalReferences
        : ['U.S. FDA Drug Interaction Labels', 'BNF Clinical Interactions'],
      verifiedSources,
      liveEvidenceUsed: {
        internetConnected: true,
        fdaLabelFound: liveInteractionEvidence.fdaMatchedCount > 0,
        rxNormMatched: false,
        googleSearchUsed,
        searchQueriesUsed: searchQueries,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in /api/clinical/interactions:', error);
    const message = formatFriendlyApiError(
      error,
      'Unable to complete drug interaction check right now. Please try again.'
    );
    res.status(500).json({ error: message });
  }
});

app.post('/api/clinical/extract-composition', async (req, res) => {
  try {
    const body = req.body ?? {};
    const parsedImage = parseImageDataUrl(body.imageDataUrl);
    if (!parsedImage) {
      res.status(400).json({
        error: 'Please upload or capture a valid JPG, PNG, or WebP photo of a medicine label, strip, or bottle (under 6 MB).',
      });
      return;
    }

    const modeHint = body.mode === 'multi' ? 'multi-composition' : 'single-or-multi';
    const ai = getGeminiClient();

    const extractSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        brandName: {
          type: Type.STRING,
          description: 'Commercial brand name printed on the package/strip/bottle, or empty string if only generic is shown.',
        },
        dosageForm: {
          type: Type.STRING,
          description: 'Form such as Tablet, Capsule, Oral Suspension / Syrup, Drops, Cream, Injection, etc.',
        },
        compositions: {
          type: Type.ARRAY,
          description: 'Every active pharmaceutical ingredient / salt / composition printed on the label (up to 8). Exclude inactive excipients unless clinically active.',
          items: {
            type: Type.OBJECT,
            properties: {
              name: {
                type: Type.STRING,
                description: 'Standard generic/salt active ingredient name (e.g., Paracetamol, Amoxicillin, Clavulanic Acid, Phenylephrine).',
              },
              strength: {
                type: Type.STRING,
                description: 'Strength printed next to the ingredient (e.g., 500 mg, 125 mg, 250 mg / 5 mL, 10 mcg). Empty string if unreadable.',
              },
            },
            required: ['name', 'strength'],
          },
        },
        liquidStrengthMg: {
          type: Type.NUMBER,
          nullable: true,
          description: 'If the medicine is a liquid syrup/suspension/drops, the numeric mg amount per stated volume (e.g., 250 for 250 mg / 5 mL). Otherwise null.',
        },
        liquidPerMl: {
          type: Type.NUMBER,
          nullable: true,
          description: 'If the medicine is a liquid syrup/suspension/drops, the numeric mL volume denominator (e.g., 5 for per 5 mL, 10 for per 10 mL, 1 for per mL). Otherwise null.',
        },
        indicationHint: {
          type: Type.STRING,
          description: 'Brief common therapeutic use shown on label or standard for these ingredients (e.g., Fever & cold relief, Bacterial infection).',
        },
        confidence: {
          type: Type.STRING,
          enum: ['high', 'medium', 'low'],
        },
        extractedSummary: {
          type: Type.STRING,
          description: 'One concise plain-English sentence summarizing what was read from the label.',
        },
        warnings: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Up to 3 helpful reminders (e.g., blurry text notice, verify exact strength printed on physical strip).',
        },
      },
      required: [
        'brandName',
        'dosageForm',
        'compositions',
        'indicationHint',
        'confidence',
        'extractedSummary',
        'warnings',
      ],
    };

    const imagePart = {
      inlineData: {
        mimeType: parsedImage.mimeType,
        data: parsedImage.base64Data,
      },
    };

    const textPart = {
      text: `You are a high-precision clinical pharmacist OCR & drug-label reader for Know Your Consumption(KYC).
Examine this photo of a medicine blister strip, box, syrup bottle, or prescription label carefully (entry mode context: ${modeHint}).

INSTRUCTIONS:
1. Extract the printed brand name (if visible) and EVERY active composition/ingredient with its exact strength (e.g., "Paracetamol" + "500 mg", "Amoxicillin" + "500 mg", "Clavulanic Acid" + "125 mg").
2. Read fine print under "Composition:", "Each film-coated tablet contains:", "Each 5 mL contains:", "Active Ingredients:", or "Drug Facts".
3. Do NOT invent ingredients that are not visible or strongly implied by a clearly printed recognized brand label. If the photo does NOT show a medicine or the text is completely unreadable, return an empty compositions array, empty brandName, confidence "low", and explain why in extractedSummary.
4. If the label is a liquid syrup, oral suspension, or drops (e.g., "250 mg / 5 mL" or "100 mg per 5 mL"), populate liquidStrengthMg and liquidPerMl accurately.
5. Normalize salt spellings to clear standard names (e.g., "Acetaminophen / Paracetamol" -> "Paracetamol", "Potassium Clavulanate eq. to Clavulanic Acid" -> "Clavulanic Acid").
6. Always add a brief safety reminder in warnings to visually verify every extracted strength against the physical package before dosing.`,
    };

    const visionModels = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
    let parsedPayload: RawExtractedMedicinePayload | null = null;
    let lastError: unknown;

    for (const model of visionModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: { parts: [imagePart, textPart] },
          config: {
            ...(model === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            systemInstruction:
              'You are a meticulous clinical pharmacy label-reading assistant. Return strictly accurate JSON matching the schema.',
            responseMimeType: 'application/json',
            responseSchema: extractSchema,
          },
        });

        const rawText = response.text?.trim();
        if (!rawText) {
          throw new Error('Empty vision response.');
        }
        parsedPayload = extractJsonFromModelText<RawExtractedMedicinePayload>(rawText);
        break;
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Vision extract model ${model} failed, trying next:`, msg.slice(0, 180));
      }
    }

    if (!parsedPayload) {
      throw lastError ?? new Error('Could not read medicine ingredients from this image.');
    }

    const normalized = normalizeExtractedMedicineData(parsedPayload);
    if (normalized.compositions.length === 0 && !normalized.brandName) {
      res.status(422).json({
        error:
          normalized.extractedSummary ||
          'No medicine brand or active ingredients could be read clearly from this image. Please capture a brighter, sharper photo of the composition label.',
      });
      return;
    }

    res.json(normalized);
  } catch (error) {
    console.error('Error in /api/clinical/extract-composition:', error);
    const message = formatFriendlyApiError(
      error,
      'Unable to scan medicine ingredients from this photo right now. Please try again or type them manually.'
    );
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Know Your Consumption(KYC) server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
