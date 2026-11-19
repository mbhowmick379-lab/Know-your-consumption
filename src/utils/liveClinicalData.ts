import type { VerifiedClinicalSource } from '../types/clinical.ts';

export interface ParsedFdaLabel {
  brandNames: string[];
  genericNames: string[];
  pharmClasses: string[];
  setId?: string;
  dailymedUrl?: string;
  boxedWarning: string;
  dosageAndAdministration: string;
  pediatricUse: string;
  geriatricUse: string;
  contraindications: string;
  drugInteractions: string;
  pregnancyAndSexSpecific: string;
}

export interface RxNormLookupResult {
  rxcui: string;
  matchedName: string;
  ingredients: string[];
  brandNames: string[];
  sourceUrl: string;
}

export interface LiveDrugEvidence {
  fdaLabel: ParsedFdaLabel | null;
  rxNorm: RxNormLookupResult | null;
  sources: VerifiedClinicalSource[];
}

function cleanExcerpt(raw: unknown, maxChars: number): string {
  if (!raw) return '';
  const joined = Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === 'string').join(' ')
    : typeof raw === 'string'
      ? raw
      : '';
  const normalized = joined.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}

function cleanStringArray(raw: unknown, limit = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return Array.from(
    new Set(
      raw
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim())
    )
  ).slice(0, limit);
}

/**
 * Parses a single OpenFDA drug label record into compact, clinically focused excerpts.
 */
export function parseOpenFdaLabelRecord(record: Record<string, unknown> | null | undefined): ParsedFdaLabel | null {
  if (!record || typeof record !== 'object') return null;

  const openfda = (record.openfda as Record<string, unknown> | undefined) ?? {};
  const brandNames = cleanStringArray(openfda.brand_name, 8);
  const genericNames = cleanStringArray(openfda.generic_name, 6);
  const pharmClasses = cleanStringArray(openfda.pharm_class_epc, 4);
  const setId = typeof record.set_id === 'string' && record.set_id.trim() ? record.set_id.trim() : undefined;
  const dailymedUrl = setId
    ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`
    : undefined;

  const boxedWarning = cleanExcerpt(record.boxed_warning, 450);
  const dosageAndAdministration = cleanExcerpt(record.dosage_and_administration, 1300);
  const pediatricUse = cleanExcerpt(record.pediatric_use, 650);
  const geriatricUse = cleanExcerpt(record.geriatric_use, 450);
  const contraindications = cleanExcerpt(record.contraindications, 650);
  const drugInteractions = cleanExcerpt(record.drug_interactions, 900);

  const sexCombined = [
    cleanExcerpt(record.pregnancy, 320),
    cleanExcerpt(record.females_and_males_of_reproductive_potential, 300),
    cleanExcerpt(record.use_in_specific_populations, 320),
  ]
    .filter(Boolean)
    .join(' ');
  const pregnancyAndSexSpecific = cleanExcerpt(sexCombined, 700);

  if (
    !dosageAndAdministration &&
    !contraindications &&
    !drugInteractions &&
    brandNames.length === 0 &&
    genericNames.length === 0
  ) {
    return null;
  }

  return {
    brandNames,
    genericNames,
    pharmClasses,
    setId,
    dailymedUrl,
    boxedWarning,
    dosageAndAdministration,
    pediatricUse,
    geriatricUse,
    contraindications,
    drugInteractions,
    pregnancyAndSexSpecific,
  };
}

/**
 * Extracts verified web sources and search queries from a Gemini GenerateContentResponse with Google Search grounding.
 */
export function extractGroundingMetadata(response: unknown): {
  webSources: VerifiedClinicalSource[];
  searchQueries: string[];
} {
  const candidates = (response as { candidates?: Array<{ groundingMetadata?: Record<string, unknown> }> })?.candidates;
  const gm = candidates?.[0]?.groundingMetadata;
  if (!gm || typeof gm !== 'object') {
    return { webSources: [], searchQueries: [] };
  }

  const rawChunks = Array.isArray(gm.groundingChunks) ? gm.groundingChunks : [];
  const seenUrls = new Set<string>();
  const webSources: VerifiedClinicalSource[] = [];

  for (const chunk of rawChunks) {
    const web = (chunk as { web?: { uri?: string; title?: string } })?.web;
    const uri = typeof web?.uri === 'string' ? web.uri.trim() : '';
    const title = typeof web?.title === 'string' ? web.title.trim() : '';
    if (!uri || !/^https?:\/\//i.test(uri) || seenUrls.has(uri)) continue;
    seenUrls.add(uri);
    webSources.push({
      title: title || uri,
      url: uri,
      sourceType: 'web',
    });
    if (webSources.length >= 6) break;
  }

  const searchQueries = Array.isArray(gm.webSearchQueries)
    ? gm.webSearchQueries
        .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
        .map((q) => q.trim())
        .slice(0, 5)
    : [];

  return { webSources, searchQueries };
}

/**
 * Safely extracts and parses a JSON object from model text, even if surrounded by markdown fences or prose.
 */
export function extractJsonFromModelText<T = Record<string, unknown>>(rawText: string): T {
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Strip markdown ```json ... ``` blocks
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim()) as T;
    }
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error('Unable to parse structured clinical JSON response.');
  }
}

/**
 * Formats fetched FDA + NIH RxNorm clinical evidence into a clean prompt context block.
 */
export function formatLiveEvidenceForPrompt(evidence: LiveDrugEvidence): string {
  const sections: string[] = [];

  if (evidence.rxNorm) {
    sections.push(
      `[NIH NLM RxNorm Verified Identity] RxCUI: ${evidence.rxNorm.rxcui} | Matched: ${evidence.rxNorm.matchedName}` +
        (evidence.rxNorm.ingredients.length > 0
          ? ` | Active Generic Ingredients: ${evidence.rxNorm.ingredients.join(', ')}`
          : '') +
        (evidence.rxNorm.brandNames.length > 0
          ? ` | US Brand Names: ${evidence.rxNorm.brandNames.join(', ')}`
          : '')
    );
  }

  if (evidence.fdaLabel) {
    const fda = evidence.fdaLabel;
    sections.push(
      `[Official U.S. FDA Prescribing Label (OpenFDA / DailyMed)]` +
        (fda.genericNames.length > 0 ? `\n- FDA Generic Name(s): ${fda.genericNames.join(', ')}` : '') +
        (fda.brandNames.length > 0 ? `\n- FDA Brand Name(s): ${fda.brandNames.join(', ')}` : '') +
        (fda.pharmClasses.length > 0 ? `\n- Pharmacologic Class: ${fda.pharmClasses.join(', ')}` : '') +
        (fda.boxedWarning ? `\n- FDA Boxed Warning: ${fda.boxedWarning}` : '') +
        (fda.dosageAndAdministration ? `\n- FDA Dosage & Administration: ${fda.dosageAndAdministration}` : '') +
        (fda.pediatricUse ? `\n- FDA Pediatric Use: ${fda.pediatricUse}` : '') +
        (fda.geriatricUse ? `\n- FDA Geriatric Use: ${fda.geriatricUse}` : '') +
        (fda.contraindications ? `\n- FDA Contraindications: ${fda.contraindications}` : '') +
        (fda.pregnancyAndSexSpecific
          ? `\n- FDA Specific Populations / Sex & Reproductive Safety: ${fda.pregnancyAndSexSpecific}`
          : '') +
        (fda.drugInteractions ? `\n- FDA Drug Interactions Excerpt: ${fda.drugInteractions}` : '')
    );
  }

  if (sections.length === 0) {
    return 'No direct US OpenFDA/RxNorm record matched this exact string (common for regional international brands). Use live Google Search grounding to verify official prescribing information, active generic ingredients, age/sex/weight dosing, and safety warnings.';
  }

  return sections.join('\n\n');
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 3500): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KnowYourConsumption-ClinicalVerifier/1.0',
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeQueryToken(term: string): string {
  return term
    .replace(/["'\\()[\]{}:^~*?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * Queries NIH NLM RxNorm REST API to resolve a brand or generic drug name to RxCUI, ingredients, and brands.
 */
async function queryRxNorm(term: string): Promise<RxNormLookupResult | null> {
  const clean = sanitizeQueryToken(term);
  if (!clean) return null;

  const approxUrl = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(clean)}&maxEntries=3`;
  const approx = await fetchJsonWithTimeout<{
    approximateGroup?: {
      candidate?: Array<{ rxcui?: string; name?: string; score?: string }>;
    };
  }>(approxUrl, 2800);

  const topCandidate = approx?.approximateGroup?.candidate?.[0];
  const rxcui = topCandidate?.rxcui;
  if (!rxcui) return null;

  const relatedUrl = `https://rxnav.nlm.nih.gov/REST/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=IN+MIN+BN`;
  const related = await fetchJsonWithTimeout<{
    relatedGroup?: {
      conceptGroup?: Array<{
        tty?: string;
        conceptProperties?: Array<{ name?: string }>;
      }>;
    };
  }>(relatedUrl, 2800);

  const ingredients: string[] = [];
  const brandNames: string[] = [];

  for (const group of related?.relatedGroup?.conceptGroup ?? []) {
    const names = (group.conceptProperties ?? [])
      .map((p) => p.name?.trim())
      .filter((n): n is string => Boolean(n));
    if (group.tty === 'IN' || group.tty === 'MIN') {
      ingredients.push(...names);
    } else if (group.tty === 'BN') {
      brandNames.push(...names);
    }
  }

  return {
    rxcui,
    matchedName: topCandidate.name || clean,
    ingredients: Array.from(new Set(ingredients)).slice(0, 6),
    brandNames: Array.from(new Set(brandNames)).slice(0, 8),
    sourceUrl: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${encodeURIComponent(rxcui)}`,
  };
}

/**
 * Queries U.S. FDA OpenFDA Official Drug Label API for a drug name (trying exact brand/generic first).
 */
async function queryOpenFdaLabel(primaryTerm: string, secondaryGeneric?: string): Promise<ParsedFdaLabel | null> {
  const candidates = Array.from(
    new Set(
      [sanitizeQueryToken(primaryTerm), secondaryGeneric ? sanitizeQueryToken(secondaryGeneric) : ''].filter(Boolean)
    )
  );

  for (const term of candidates) {
    const quoted = `"${term}"`;
    const exactQuery = `openfda.brand_name:${quoted}+OR+openfda.generic_name:${quoted}`;
    const url = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(exactQuery).replace(/%2B/g, '+')}&limit=2`;
    const data = await fetchJsonWithTimeout<{ results?: Array<Record<string, unknown>> }>(url, 3200);
    if (data?.results && data.results.length > 0) {
      // Prefer the record that actually includes dosage_and_administration
      const best =
        data.results.find((r) => Boolean(r.dosage_and_administration)) ?? data.results[0];
      const parsed = parseOpenFdaLabelRecord(best);
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Fetches live authoritative FDA Label + NIH RxNorm clinical evidence in parallel.
 */
export async function fetchLiveDrugEvidence(
  medicationInput: string,
  localGenericHint?: string
): Promise<LiveDrugEvidence> {
  const [rxNorm, fdaInitial] = await Promise.all([
    queryRxNorm(medicationInput),
    queryOpenFdaLabel(medicationInput, localGenericHint),
  ]);

  let fdaLabel = fdaInitial;
  if (!fdaLabel && rxNorm?.ingredients[0]) {
    fdaLabel = await queryOpenFdaLabel(rxNorm.ingredients[0]);
  }

  const sources: VerifiedClinicalSource[] = [];
  if (fdaLabel) {
    const fdaTitle =
      fdaLabel.brandNames[0] || fdaLabel.genericNames[0]
        ? `U.S. FDA Official Prescribing Label — ${fdaLabel.brandNames[0] || fdaLabel.genericNames[0]}`
        : 'U.S. FDA Official Prescribing Label (OpenFDA / DailyMed)';
    sources.push({
      title: fdaTitle,
      url: fdaLabel.dailymedUrl || 'https://dailymed.nlm.nih.gov/dailymed/',
      sourceType: 'fda',
    });
  }
  if (rxNorm) {
    sources.push({
      title: `NIH NLM RxNorm Drug Identity — ${rxNorm.ingredients[0] || rxNorm.matchedName} (RxCUI ${rxNorm.rxcui})`,
      url: rxNorm.sourceUrl,
      sourceType: 'nih',
    });
  }

  return { fdaLabel, rxNorm, sources };
}

/**
 * Fetches live OpenFDA drug_interactions label excerpts for a list of medications (up to 4 in parallel).
 */
export async function fetchLiveInteractionEvidence(
  medications: Array<{ inputName: string; genericHint?: string }>
): Promise<{ promptExcerpt: string; sources: VerifiedClinicalSource[]; fdaMatchedCount: number }> {
  const subset = medications.slice(0, 4);
  const results = await Promise.all(
    subset.map(async (med) => {
      const label = await queryOpenFdaLabel(med.inputName, med.genericHint);
      return { med, label };
    })
  );

  const lines: string[] = [];
  const sources: VerifiedClinicalSource[] = [];
  let fdaMatchedCount = 0;

  for (const { med, label } of results) {
    if (!label) continue;
    fdaMatchedCount++;
    const labelName = label.genericNames[0] || label.brandNames[0] || med.inputName;
    sources.push({
      title: `U.S. FDA Interaction Label — ${labelName}`,
      url: label.dailymedUrl || 'https://dailymed.nlm.nih.gov/dailymed/',
      sourceType: 'fda',
    });
    if (label.drugInteractions || label.contraindications) {
      lines.push(
        `[FDA Label for ${med.inputName} (${labelName})]` +
          (label.drugInteractions ? `\nDrug Interactions: ${label.drugInteractions}` : '') +
          (label.contraindications ? `\nContraindications: ${label.contraindications}` : '')
      );
    }
  }

  return {
    promptExcerpt:
      lines.length > 0
        ? lines.join('\n\n')
        : 'Use live Google Search grounding to cross-verify official FDA Drug Interaction tables and BNF guidance for every drug pair.',
    sources,
    fdaMatchedCount,
  };
}
