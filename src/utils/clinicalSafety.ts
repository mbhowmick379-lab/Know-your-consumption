import type {
  AgeUnit,
  AllergyAlert,
  CompositionItem,
  DeterministicInteractionWarning,
  InteractionSeverity,
  PatientSex,
  VerificationCheck,
  VerificationStatus,
  WeightUnit,
} from '../types/clinical.ts';
import { expandMedicationWithGeneric } from './drugCatalog.ts';

export interface CombinedCompositionPreset {
  id: string;
  label: string;
  category: string;
  indication: string;
  containerBasis?: 'tablet' | 'capsule' | 'liquid';
  containerMl?: number;
  compositions: CompositionItem[];
}

export const COMBINED_COMPOSITION_PRESETS: CombinedCompositionPreset[] = [
  {
    id: 'cold-syrup-5ml',
    label: 'Cold Syrup (3 in 5 mL)',
    category: 'Liquid Syrup',
    indication: 'Cold, fever & runny nose',
    containerBasis: 'liquid',
    containerMl: 5,
    compositions: [
      { name: 'Paracetamol', strength: '125 mg' },
      { name: 'Phenylephrine', strength: '5 mg' },
      { name: 'Chlorpheniramine', strength: '1 mg' },
    ],
  },
  {
    id: 'cold-flu-4',
    label: 'Cold & Flu (4 Compositions)',
    category: 'Cold & Fever',
    indication: 'Cold, nasal congestion, fever & headache',
    containerBasis: 'tablet',
    compositions: [
      { name: 'Paracetamol', strength: '500 mg' },
      { name: 'Phenylephrine', strength: '10 mg' },
      { name: 'Chlorpheniramine', strength: '2 mg' },
      { name: 'Caffeine', strength: '30 mg' },
    ],
  },
  {
    id: 'pain-3',
    label: 'Pain & Swelling (3 Compositions)',
    category: 'Pain & Inflammation',
    indication: 'Musculoskeletal pain, dental pain & inflammation',
    containerBasis: 'tablet',
    compositions: [
      { name: 'Aceclofenac', strength: '100 mg' },
      { name: 'Paracetamol', strength: '325 mg' },
      { name: 'Serratiopeptidase', strength: '15 mg' },
    ],
  },
  {
    id: 'antibiotic-3',
    label: 'Antibiotic + Probiotic Capsule (3)',
    category: 'Antibiotic Combo',
    indication: 'Bacterial respiratory, sinus or ear infection',
    containerBasis: 'capsule',
    compositions: [
      { name: 'Amoxicillin', strength: '500 mg' },
      { name: 'Clavulanic Acid', strength: '125 mg' },
      { name: 'Lactic Acid Bacillus', strength: '60M spores' },
    ],
  },
];

export interface QuickMedication {
  name: string;
  category: 'Antibiotics' | 'Pain & Fever' | 'Allergy & Respiratory' | 'Heart & Metabolism' | 'Digestive & Other';
  drugClass: string;
  commonUse: string;
}

export const COMMON_ALLERGENS: string[] = [
  'Penicillin',
  'Amoxicillin',
  'Cephalosporins',
  'Sulfa / Sulfonamides',
  'NSAIDs / Ibuprofen',
  'Aspirin',
  'Macrolides (Azithromycin)',
  'Fluoroquinolones (Ciprofloxacin)',
  'Tetracyclines (Doxycycline)',
  'Codeine / Opioids',
];

export const QUICK_MEDICATIONS: QuickMedication[] = [
  { name: 'Amoxicillin', category: 'Antibiotics', drugClass: 'Penicillin Antibiotic', commonUse: 'Ear, throat, sinus & respiratory infections' },
  { name: 'Amoxicillin-Clavulanate (Augmentin)', category: 'Antibiotics', drugClass: 'Penicillin + Beta-Lactamase Inhibitor', commonUse: 'Sinus, dental & skin infections' },
  { name: 'Azithromycin', category: 'Antibiotics', drugClass: 'Macrolide Antibiotic', commonUse: 'Respiratory & atypical bacterial infections' },
  { name: 'Cephalexin (Keflex)', category: 'Antibiotics', drugClass: '1st-Gen Cephalosporin', commonUse: 'Skin & urinary tract infections' },
  { name: 'Doxycycline', category: 'Antibiotics', drugClass: 'Tetracycline Antibiotic', commonUse: 'Tick-borne, skin & respiratory infections' },
  { name: 'Ciprofloxacin', category: 'Antibiotics', drugClass: 'Fluoroquinolone Antibiotic', commonUse: 'Complicated urinary & GI infections' },
  { name: 'Trimethoprim-Sulfamethoxazole (Bactrim)', category: 'Antibiotics', drugClass: 'Sulfonamide Antibiotic', commonUse: 'Urinary & MRSA skin infections' },
  { name: 'Metronidazole', category: 'Antibiotics', drugClass: 'Nitroimidazole Antibiotic', commonUse: 'Anaerobic & dental infections' },
  { name: 'Acetaminophen (Paracetamol)', category: 'Pain & Fever', drugClass: 'Analgesic / Antipyretic', commonUse: 'Fever reduction & mild-to-moderate pain' },
  { name: 'Ibuprofen', category: 'Pain & Fever', drugClass: 'NSAID', commonUse: 'Inflammation, fever & musculoskeletal pain' },
  { name: 'Naproxen', category: 'Pain & Fever', drugClass: 'NSAID', commonUse: 'Longer-acting pain & joint inflammation' },
  { name: 'Aspirin', category: 'Pain & Fever', drugClass: 'Salicylate / Antiplatelet', commonUse: 'Adult cardiovascular prevention & pain' },
  { name: 'Cetirizine', category: 'Allergy & Respiratory', drugClass: '2nd-Gen Antihistamine', commonUse: 'Seasonal allergies & hives' },
  { name: 'Loratadine', category: 'Allergy & Respiratory', drugClass: '2nd-Gen Antihistamine', commonUse: 'Non-drowsy allergy relief' },
  { name: 'Albuterol (Salbutamol)', category: 'Allergy & Respiratory', drugClass: 'Short-Acting Beta Agonist', commonUse: 'Quick-relief asthma & bronchospasm' },
  { name: 'Lisinopril', category: 'Heart & Metabolism', drugClass: 'ACE Inhibitor', commonUse: 'High blood pressure & heart protection' },
  { name: 'Metformin', category: 'Heart & Metabolism', drugClass: 'Biguanide', commonUse: 'Type 2 diabetes blood sugar control' },
  { name: 'Atorvastatin', category: 'Heart & Metabolism', drugClass: 'Statin', commonUse: 'Cholesterol lowering' },
  { name: 'Omeprazole', category: 'Digestive & Other', drugClass: 'Proton Pump Inhibitor', commonUse: 'Acid reflux & GERD' },
  { name: 'Ondansetron', category: 'Digestive & Other', drugClass: '5-HT3 Antagonist', commonUse: 'Nausea & vomiting relief' },
];

export const EXAMPLE_INTERACTION_SETS: { label: string; drugs: string[] }[] = [
  { label: 'Warfarin + Amoxicillin', drugs: ['Warfarin', 'Amoxicillin'] },
  { label: 'Ibuprofen + Lisinopril', drugs: ['Ibuprofen', 'Lisinopril'] },
  { label: 'Clarithromycin + Simvastatin', drugs: ['Clarithromycin', 'Simvastatin'] },
  { label: 'Ciprofloxacin + Metformin + Ibuprofen', drugs: ['Ciprofloxacin', 'Metformin', 'Ibuprofen'] },
];

export function toAgeInYears(ageValue: number, ageUnit: AgeUnit): number {
  if (!Number.isFinite(ageValue) || ageValue < 0) return 0;
  return ageUnit === 'months' ? Number((ageValue / 12).toFixed(3)) : Number(ageValue.toFixed(3));
}

export function toWeightInKg(weightValue: number | null | undefined, weightUnit: WeightUnit = 'kg'): number | null {
  if (weightValue === null || weightValue === undefined || !Number.isFinite(weightValue) || weightValue <= 0) {
    return null;
  }
  const kg = weightUnit === 'lbs' ? weightValue * 0.45359237 : weightValue;
  return Number(kg.toFixed(2));
}

export function getAgeGroupLabel(ageYears: number): string {
  if (ageYears < 0.083) return 'Neonate (< 1 month)';
  if (ageYears < 1) return 'Infant (1–11 months)';
  if (ageYears < 12) return 'Pediatric Child (1–11 years)';
  if (ageYears < 18) return 'Adolescent (12–17 years)';
  if (ageYears < 65) return 'Adult (18–64 years)';
  return 'Older Adult (65+ years)';
}

interface AllergenFamily {
  familyName: string;
  allergyKeywords: string[];
  directDrugs: string[];
  crossReactiveDrugs?: string[];
  crossNote?: string;
}

const ALLERGEN_FAMILIES: AllergenFamily[] = [
  {
    familyName: 'Penicillin / Beta-Lactam',
    allergyKeywords: ['penicillin', 'amoxicillin', 'ampicillin', 'augmentin', 'beta-lactam', 'pcn'],
    directDrugs: ['amoxicillin', 'ampicillin', 'penicillin', 'augmentin', 'amoxicillin-clavulanate', 'piperacillin', 'dicloxacillin', 'nafcillin', 'oxacillin'],
    crossReactiveDrugs: ['cephalexin', 'keflex', 'cefdinir', 'cefuroxime', 'ceftriaxone', 'cefpodoxime', 'cefadroxil', 'cefazolin', 'cephalosporin'],
    crossNote: 'Cephalosporins share a beta-lactam ring with penicillins. Although cross-reactivity is lower with newer generations, patients with severe or anaphylactic penicillin allergy require clinician review before taking cephalosporins.',
  },
  {
    familyName: 'Cephalosporin',
    allergyKeywords: ['cephalosporin', 'cephalexin', 'keflex', 'cefdinir', 'ceftriaxone', 'cefuroxime'],
    directDrugs: ['cephalexin', 'keflex', 'cefdinir', 'cefuroxime', 'ceftriaxone', 'cefpodoxime', 'cefadroxil', 'cefazolin', 'cefixime'],
    crossReactiveDrugs: ['amoxicillin', 'ampicillin', 'penicillin', 'augmentin'],
    crossNote: 'Potential beta-lactam side-chain cross-reactivity with penicillins. Confirm allergy reaction history with your doctor or pharmacist.',
  },
  {
    familyName: 'Sulfonamide (Sulfa)',
    allergyKeywords: ['sulfa', 'sulfonamide', 'bactrim', 'septra', 'sulfamethoxazole', 'trimethoprim-sulfamethoxazole'],
    directDrugs: ['bactrim', 'septra', 'sulfamethoxazole', 'trimethoprim-sulfamethoxazole', 'sulfadiazine', 'sulfisoxazole', 'sulfasalazine'],
    crossReactiveDrugs: ['celecoxib', 'furosemide', 'hydrochlorothiazide'],
    crossNote: 'Non-antibiotic sulfonamides rarely cross-react with sulfa antibiotics, but patients with severe sulfa reactions (e.g. Stevens-Johnson syndrome) should verify safety with their pharmacist.',
  },
  {
    familyName: 'NSAID / Salicylate',
    allergyKeywords: ['nsaid', 'ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'aspirin', 'salicylate', 'diclofenac', 'meloxicam'],
    directDrugs: ['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve', 'aspirin', 'diclofenac', 'ketorolac', 'meloxicam', 'celecoxib', 'indomethacin', 'bismuth subsalicylate'],
  },
  {
    familyName: 'Macrolide',
    allergyKeywords: ['macrolide', 'azithromycin', 'z-pack', 'zithromax', 'clarithromycin', 'erythromycin'],
    directDrugs: ['azithromycin', 'z-pack', 'zithromax', 'clarithromycin', 'erythromycin'],
  },
  {
    familyName: 'Fluoroquinolone',
    allergyKeywords: ['fluoroquinolone', 'quinolone', 'ciprofloxacin', 'cipro', 'levofloxacin', 'moxifloxacin'],
    directDrugs: ['ciprofloxacin', 'cipro', 'levofloxacin', 'moxifloxacin', 'ofloxacin'],
  },
  {
    familyName: 'Tetracycline',
    allergyKeywords: ['tetracycline', 'doxycycline', 'minocycline'],
    directDrugs: ['tetracycline', 'doxycycline', 'minocycline', 'demeclocycline'],
  },
  {
    familyName: 'Opioid / Codeine',
    allergyKeywords: ['codeine', 'opioid', 'morphine', 'oxycodone', 'hydrocodone', 'tramadol'],
    directDrugs: ['codeine', 'morphine', 'oxycodone', 'hydrocodone', 'tramadol', 'hydromorphone'],
  },
];

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function evaluateAllergyConflict(medicationName: string, allergies: string[]): AllergyAlert {
  const expandedMed = expandMedicationWithGeneric(medicationName);
  const medNorm = normalizeToken(expandedMed);
  const cleanedAllergies = allergies.map((a) => a.trim()).filter(Boolean);

  if (!medNorm || cleanedAllergies.length === 0) {
    return {
      severity: 'clear',
      headline: 'No recorded allergy conflicts',
      matchedAllergens: [],
      explanation: cleanedAllergies.length === 0
        ? 'No allergies were entered in your profile. Always double-check inactive ingredients and prior reactions.'
        : `Screened against ${cleanedAllergies.length} recorded allergen(s) with no direct or class cross-reactivity match found.`,
      recommendedAction: 'Confirm with your pharmacist if you have ever had a rash, swelling, or breathing trouble with this medication.',
    };
  }

  const directMatches: string[] = [];
  const cautionMatches: string[] = [];
  let cautionDetail = '';

  for (const rawAllergy of cleanedAllergies) {
    const allergyNorm = normalizeToken(rawAllergy);

    // Direct text overlap
    if (medNorm.includes(allergyNorm) || allergyNorm.includes(medNorm)) {
      directMatches.push(rawAllergy);
      continue;
    }

    for (const family of ALLERGEN_FAMILIES) {
      const userAllergicToFamily = family.allergyKeywords.some((kw) => allergyNorm.includes(kw));
      if (!userAllergicToFamily) continue;

      const isDirectClassDrug = family.directDrugs.some((d) => medNorm.includes(d));
      if (isDirectClassDrug) {
        directMatches.push(`${rawAllergy} (${family.familyName} class)`);
        break;
      }

      const isCrossDrug = family.crossReactiveDrugs?.some((d) => medNorm.includes(d));
      if (isCrossDrug) {
        cautionMatches.push(`${rawAllergy} (${family.familyName} cross-reactivity)`);
        if (family.crossNote) cautionDetail = family.crossNote;
        break;
      }
    }
  }

  if (directMatches.length > 0) {
    return {
      severity: 'critical',
      headline: `CRITICAL ALLERGY ALERT: Avoid ${medicationName}`,
      matchedAllergens: Array.from(new Set(directMatches)),
      explanation: `${medicationName} directly matches or belongs to the same drug class as your documented allergy (${Array.from(new Set(directMatches)).join(', ')}). Taking this medication risks a severe allergic reaction including hives, swelling, or anaphylaxis.`,
      recommendedAction: 'Do NOT take this medication. Contact your prescribing doctor or pharmacist immediately for a safe alternative antibiotic or medication.',
    };
  }

  if (cautionMatches.length > 0) {
    return {
      severity: 'caution',
      headline: `Allergy Cross-Reactivity Caution for ${medicationName}`,
      matchedAllergens: Array.from(new Set(cautionMatches)),
      explanation: cautionDetail || `${medicationName} has potential chemical cross-reactivity with your documented allergy (${Array.from(new Set(cautionMatches)).join(', ')}).`,
      recommendedAction: 'Speak with your doctor or pharmacist before taking this medication, especially if your previous reaction involved breathing difficulty, throat swelling, or severe rash.',
    };
  }

  return {
    severity: 'clear',
    headline: 'No recorded allergy conflicts detected',
    matchedAllergens: [],
    explanation: `${medicationName} does not match your recorded allergies (${cleanedAllergies.join(', ')}) or known high-risk cross-reactivity families.`,
    recommendedAction: 'Monitor for any unexpected skin rash, itching, or swelling when starting any new medication.',
  };
}

interface AgeContraindicationRule {
  keywords: string[];
  maxUnsafeAgeYears?: number;
  minUnsafeAgeYears?: number;
  severity: 'alert' | 'warning';
  title: string;
  detail: string;
}

const AGE_SAFETY_RULES: AgeContraindicationRule[] = [
  {
    keywords: ['aspirin', 'acetylsalicylic', 'bismuth subsalicylate', 'pepto'],
    maxUnsafeAgeYears: 18,
    severity: 'alert',
    title: 'Pediatric Reye Syndrome Contraindication',
    detail: 'Aspirin and salicylate-containing products should NOT be given to children or teenagers under 18 years due to the risk of Reye syndrome, unless explicitly prescribed by a pediatric specialist.',
  },
  {
    keywords: ['ibuprofen', 'advil', 'motrin', 'naproxen', 'aleve'],
    maxUnsafeAgeYears: 0.5,
    severity: 'alert',
    title: 'Infant NSAID Contraindication (< 6 Months)',
    detail: 'Ibuprofen and other NSAIDs are not recommended for infants under 6 months of age due to immature kidney function.',
  },
  {
    keywords: ['naproxen', 'aleve'],
    maxUnsafeAgeYears: 12,
    severity: 'warning',
    title: 'Pediatric Naproxen Restriction (< 12 Years)',
    detail: 'Over-the-counter naproxen is generally restricted to patients aged 12 years and older unless directed by a pediatrician.',
  },
  {
    keywords: ['doxycycline', 'tetracycline', 'minocycline'],
    maxUnsafeAgeYears: 8,
    severity: 'warning',
    title: 'Pediatric Tooth Enamel Caution (< 8 Years)',
    detail: 'Tetracyclines can cause permanent tooth staining in children under 8 years. Short courses of doxycycline are only used under direct pediatric physician supervision when benefits outweigh risks.',
  },
  {
    keywords: ['ciprofloxacin', 'cipro', 'levofloxacin', 'moxifloxacin'],
    maxUnsafeAgeYears: 18,
    severity: 'alert',
    title: 'Pediatric Fluoroquinolone Restriction (< 18 Years)',
    detail: 'Fluoroquinolone antibiotics are generally avoided in patients under 18 years due to joint/cartilage and tendon safety concerns, reserved only for specific severe infections under specialist care.',
  },
  {
    keywords: ['codeine', 'tramadol'],
    maxUnsafeAgeYears: 18,
    severity: 'alert',
    title: 'Pediatric Opioid Contraindication (< 18 Years)',
    detail: 'FDA safety warnings contraindicate codeine and tramadol in children and adolescents due to unpredictable metabolism and life-threatening breathing suppression.',
  },
  {
    keywords: ['loperamide', 'imodium'],
    maxUnsafeAgeYears: 2,
    severity: 'alert',
    title: 'Toddler Antidiarrheal Contraindication (< 2 Years)',
    detail: 'Loperamide must not be given to infants or children under 2 years of age.',
  },
  {
    keywords: ['ibuprofen', 'naproxen', 'nsaid', 'diphenhydramine', 'benadryl'],
    minUnsafeAgeYears: 65,
    severity: 'warning',
    title: 'Older Adult (65+) Beers Criteria Caution',
    detail: 'Patients aged 65+ face higher risks of stomach bleeding, kidney strain (with NSAIDs), or dizziness/confusion (with sedating antihistamines). Confirm lowest effective dose with your doctor.',
  },
];

interface KnownInteractionRule {
  groupA: string[];
  groupB: string[];
  severity: InteractionSeverity;
  summary: string;
  guidance: string;
}

const KNOWN_INTERACTIONS: KnownInteractionRule[] = [
  {
    groupA: ['warfarin', 'coumadin'],
    groupB: ['amoxicillin', 'augmentin', 'ciprofloxacin', 'metronidazole', 'bactrim', 'sulfamethoxazole', 'azithromycin', 'clarithromycin'],
    severity: 'major',
    summary: 'Many antibiotics alter gut bacteria or liver metabolism of Warfarin, significantly increasing INR and bleeding risk.',
    guidance: 'Contact your anticoagulation clinic or doctor before starting this antibiotic; extra INR blood monitoring is typically needed.',
  },
  {
    groupA: ['warfarin', 'coumadin', 'apixaban', 'eliquis', 'rivaroxaban', 'xarelto'],
    groupB: ['ibuprofen', 'naproxen', 'aspirin', 'diclofenac', 'meloxicam'],
    severity: 'major',
    summary: 'Combining blood thinners with NSAIDs or aspirin substantially increases the risk of serious gastrointestinal or internal bleeding.',
    guidance: 'Avoid combining unless specifically prescribed together. Ask your pharmacist if acetaminophen is a safer alternative.',
  },
  {
    groupA: ['ibuprofen', 'naproxen', 'diclofenac', 'meloxicam'],
    groupB: ['lisinopril', 'enalapril', 'losartan', 'valsartan', 'ramipril'],
    severity: 'moderate',
    summary: 'NSAIDs can reduce the blood-pressure-lowering effect of ACE inhibitors/ARBs and place extra strain on the kidneys.',
    guidance: 'Avoid regular NSAID use without checking with your doctor, especially if you also take a water pill (diuretic) or have kidney concerns.',
  },
  {
    groupA: ['clarithromycin', 'erythromycin'],
    groupB: ['simvastatin', 'atorvastatin', 'lovastatin'],
    severity: 'major',
    summary: 'Macrolide antibiotics like clarithromycin block the enzyme (CYP3A4) that clears certain statins, risking severe muscle injury (rhabdomyolysis).',
    guidance: 'Your doctor often recommends temporarily pausing the statin or choosing a different antibiotic like azithromycin.',
  },
  {
    groupA: ['ciprofloxacin', 'levofloxacin', 'doxycycline', 'tetracycline'],
    groupB: ['calcium', 'iron', 'antacid', 'tums', 'magnesium', 'zinc', 'multivitamin'],
    severity: 'moderate',
    summary: 'Minerals like calcium, iron, magnesium, and zinc bind to fluoroquinolone and tetracycline antibiotics in the stomach, blocking absorption so the infection may not clear.',
    guidance: 'Separate this antibiotic from dairy, antacids, or mineral supplements by at least 2 to 4 hours.',
  },
  {
    groupA: ['ciprofloxacin', 'levofloxacin'],
    groupB: ['metformin', 'glipizide', 'insulin', 'glyburide'],
    severity: 'moderate',
    summary: 'Fluoroquinolone antibiotics can cause unpredictable blood sugar swings (low or high blood glucose) in patients taking diabetes medications.',
    guidance: 'Monitor blood glucose more frequently while taking this antibiotic and report symptoms of low blood sugar promptly.',
  },
  {
    groupA: ['azithromycin', 'ciprofloxacin', 'levofloxacin', 'ondansetron'],
    groupB: ['amiodarone', 'sotalol', 'escitalopram', 'citalopram', 'ondansetron', 'azithromycin'],
    severity: 'moderate',
    summary: 'Combining medications that prolong the heart QT interval can increase the risk of irregular heart rhythms.',
    guidance: 'Verify this combination with your pharmacist, especially if you have a history of heart rhythm issues or low potassium.',
  },
  {
    groupA: ['sildenafil', 'tadalafil', 'viagra', 'cialis'],
    groupB: ['nitroglycerin', 'isosorbide'],
    severity: 'major',
    summary: 'Combining PDE5 inhibitors with nitrates can cause a sudden, life-threatening drop in blood pressure.',
    guidance: 'Do NOT combine these medications. Seek medical advice immediately.',
  },
];

export function evaluateDeterministicInteractions(medications: string[]): DeterministicInteractionWarning[] {
  const cleaned = Array.from(new Set(medications.map((m) => m.trim()).filter(Boolean)));
  const findings: DeterministicInteractionWarning[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    for (let j = i + 1; j < cleaned.length; j++) {
      const a = cleaned[i];
      const b = cleaned[j];
      const aNorm = normalizeToken(expandMedicationWithGeneric(a));
      const bNorm = normalizeToken(expandMedicationWithGeneric(b));

      for (const rule of KNOWN_INTERACTIONS) {
        const matchAB =
          rule.groupA.some((k) => aNorm.includes(k)) && rule.groupB.some((k) => bNorm.includes(k));
        const matchBA =
          rule.groupA.some((k) => bNorm.includes(k)) && rule.groupB.some((k) => aNorm.includes(k));

        if (matchAB || matchBA) {
          findings.push({
            pair: [a, b],
            severity: rule.severity,
            summary: rule.summary,
            guidance: rule.guidance,
          });
          break;
        }
      }
    }
  }

  return findings;
}

interface SexSpecificRule {
  keywords: string[];
  appliesTo: PatientSex;
  minAgeYears?: number;
  maxAgeYears?: number;
  severity: 'alert' | 'warning' | 'info';
  title: string;
  detail: string;
}

const SEX_SPECIFIC_RULES: SexSpecificRule[] = [
  {
    keywords: ['finasteride', 'propecia', 'proscar', 'dutasteride', 'avodart'],
    appliesTo: 'female',
    severity: 'alert',
    title: 'Female Contraindication (5-Alpha Reductase Inhibitor)',
    detail:
      'Finasteride and dutasteride are strictly contraindicated in women who are or may become pregnant due to severe risk of fetal birth defects. Women should not take or handle crushed tablets.',
  },
  {
    keywords: ['isotretinoin', 'accutane', 'warfarin', 'coumadin', 'methotrexate', 'valproate', 'valproic', 'depakote', 'thalidomide'],
    appliesTo: 'female',
    minAgeYears: 12,
    maxAgeYears: 55,
    severity: 'warning',
    title: 'High-Risk Pregnancy / Teratogenicity Precaution',
    detail:
      'This medication carries major fetal safety risks during pregnancy. Female patients of reproductive potential must confirm pregnancy status and discuss effective contraception with their doctor before use.',
  },
  {
    keywords: ['doxycycline', 'tetracycline', 'minocycline', 'ciprofloxacin', 'levofloxacin', 'lisinopril', 'enalapril', 'ramipril', 'losartan', 'valsartan', 'atorvastatin', 'simvastatin', 'rosuvastatin'],
    appliesTo: 'female',
    minAgeYears: 12,
    maxAgeYears: 55,
    severity: 'warning',
    title: 'Reproductive / Pregnancy Safety Check (Female)',
    detail:
      'Avoid during pregnancy unless explicitly cleared by a physician (risk of fetal tooth/bone, kidney, or developmental effects). Confirm pregnancy and breastfeeding status before taking.',
  },
  {
    keywords: ['zolpidem', 'ambien'],
    appliesTo: 'female',
    minAgeYears: 18,
    severity: 'warning',
    title: 'FDA Sex-Specific Dose Reduction (Female)',
    detail:
      'The FDA mandates a lower starting dose of Zolpidem for females (5 mg immediate-release or 6.25 mg extended-release) because women clear the drug more slowly, increasing next-morning drowsiness and driving impairment.',
  },
  {
    keywords: ['rifampin', 'rifampicin', 'rifabutin', 'carbamazepine', 'topiramate', 'modafinil', 'griseofulvin'],
    appliesTo: 'female',
    minAgeYears: 12,
    maxAgeYears: 55,
    severity: 'warning',
    title: 'Hormonal Contraceptive Interaction Notice',
    detail:
      'This medication accelerates liver clearance of hormonal birth control pills, patches, and rings, reducing contraceptive effectiveness. Use a backup barrier method during treatment.',
  },
  {
    keywords: ['nitrofurantoin', 'macrobid', 'trimethoprim-sulfamethoxazole', 'bactrim', 'fosfomycin'],
    appliesTo: 'male',
    minAgeYears: 18,
    severity: 'info',
    title: 'Male UTI Duration Clinical Note',
    detail:
      'Urinary tract infections in adult males are classified as complicated UTIs and typically require a longer antibiotic course (7 to 14 days) and physician evaluation compared with shorter 3–5 day uncomplicated female courses.',
  },
];

export function evaluateSexSpecificSafety(
  medicationName: string,
  sex: PatientSex | null | undefined,
  ageYears: number
): VerificationCheck {
  if (!sex) {
    return {
      id: 'sex-protocol',
      label: 'Sex-Specific Clinical Safety Screen',
      status: 'info',
      detail: 'Patient sex not specified. Select Male or Female for sex-specific dosing and reproductive safety verification.',
    };
  }

  const medNorm = normalizeToken(expandMedicationWithGeneric(medicationName));
  const sexLabel = sex === 'female' ? 'Female' : 'Male';

  for (const rule of SEX_SPECIFIC_RULES) {
    if (rule.appliesTo !== sex) continue;
    const matchesMed = rule.keywords.some((kw) => medNorm.includes(kw));
    if (!matchesMed) continue;
    if (rule.minAgeYears !== undefined && ageYears < rule.minAgeYears) continue;
    if (rule.maxAgeYears !== undefined && ageYears > rule.maxAgeYears) continue;

    return {
      id: 'sex-protocol',
      label: 'Sex-Specific Clinical Safety Screen',
      status: rule.severity,
      detail: `${rule.title}: ${rule.detail}`,
    };
  }

  return {
    id: 'sex-protocol',
    label: 'Sex-Specific Clinical Safety Screen',
    status: 'pass',
    detail: `Evaluated for ${sexLabel} patient profile. No sex-specific dosing contraindication triggered in deterministic screening.`,
  };
}

export interface DeterministicVerificationOutput {
  ageYears: number;
  ageGroupLabel: string;
  weightKg: number | null;
  sex: PatientSex | null;
  allergyAlert: AllergyAlert;
  verificationChecks: VerificationCheck[];
  verificationStatus: VerificationStatus;
  activeMedWarnings: DeterministicInteractionWarning[];
}

export function runAutomatedVerificationProtocol(params: {
  medicationName: string;
  ageValue: number;
  ageUnit: AgeUnit;
  sex?: PatientSex | null;
  weightValue?: number | null;
  weightUnit?: WeightUnit;
  allergies: string[];
  currentMedications: string[];
}): DeterministicVerificationOutput {
  const ageYears = toAgeInYears(params.ageValue, params.ageUnit);
  const ageGroupLabel = getAgeGroupLabel(ageYears);
  const weightKg = toWeightInKg(params.weightValue, params.weightUnit ?? 'kg');
  const medNorm = normalizeToken(expandMedicationWithGeneric(params.medicationName));
  const rawMedNorm = normalizeToken(params.medicationName);

  const allergyAlert = evaluateAllergyConflict(params.medicationName, params.allergies);
  const checks: VerificationCheck[] = [];

  // 1. Allergy Check
  checks.push({
    id: 'allergy-screen',
    label: 'Allergy & Cross-Reactivity Screen',
    status:
      allergyAlert.severity === 'critical'
        ? 'alert'
        : allergyAlert.severity === 'caution'
          ? 'warning'
          : 'pass',
    detail: allergyAlert.headline,
  });

  // 2. Age Safety Check
  let ageStatus: 'pass' | 'warning' | 'alert' = 'pass';
  let ageDetail = `Evaluated for ${ageGroupLabel} (${params.ageValue} ${params.ageUnit}). No automated age-band contraindication triggered.`;

  for (const rule of AGE_SAFETY_RULES) {
    const matchesMed = rule.keywords.some((kw) => medNorm.includes(kw));
    if (!matchesMed) continue;

    const triggersMax = rule.maxUnsafeAgeYears !== undefined && ageYears < rule.maxUnsafeAgeYears;
    const triggersMin = rule.minUnsafeAgeYears !== undefined && ageYears >= rule.minUnsafeAgeYears;

    if (triggersMax || triggersMin) {
      ageStatus = rule.severity;
      ageDetail = `${rule.title}: ${rule.detail}`;
      break;
    }
  }

  checks.push({
    id: 'age-protocol',
    label: 'Age-Stratified Eligibility Check',
    status: ageStatus,
    detail: ageDetail,
  });

  // 3. Optional Weight Verification & Plausibility
  if (weightKg === null) {
    checks.push({
      id: 'weight-protocol',
      label: 'Optional Weight Stratification',
      status: ageYears < 12 ? 'warning' : 'info',
      detail:
        ageYears < 12
          ? 'Weight not provided. Standard age-range dosing shown — adding child weight (kg or lbs) is strongly advised for accurate pediatric antibiotic dosing.'
          : 'Weight omitted (optional). Standard adult/adolescent age-based dosing protocol applied.',
    });
  } else {
    const seemsPlausible =
      (ageYears < 1 && weightKg >= 2 && weightKg <= 15) ||
      (ageYears >= 1 && ageYears < 12 && weightKg >= 6 && weightKg <= 70) ||
      (ageYears >= 12 && weightKg >= 25 && weightKg <= 250);

    checks.push({
      id: 'weight-protocol',
      label: 'Weight-Based Dosing & Plausibility',
      status: seemsPlausible ? 'pass' : 'warning',
      detail: seemsPlausible
        ? `Weight verified at ${weightKg} kg for mg/kg/day dosing ceiling verification.`
        : `Entered weight (${weightKg} kg) is unusual for age ${params.ageValue} ${params.ageUnit}. Double-check kg vs. lbs unit selection.`,
    });
  }

  // 4. Active Medication Cross-Check
  const activeMedWarnings = evaluateDeterministicInteractions([
    params.medicationName,
    ...params.currentMedications.filter((m) => normalizeToken(m) !== rawMedNorm),
  ]).filter((w) =>
    normalizeToken(w.pair[0]) === rawMedNorm || normalizeToken(w.pair[1]) === rawMedNorm
  );

  if (params.currentMedications.length === 0) {
    checks.push({
      id: 'active-meds',
      label: 'Active Medication Cross-Check',
      status: 'info',
      detail: 'No current medications listed in your profile. Add current medications to screen automatically.',
    });
  } else if (activeMedWarnings.length > 0) {
    const hasMajor = activeMedWarnings.some((w) => w.severity === 'major');
    checks.push({
      id: 'active-meds',
      label: 'Active Medication Cross-Check',
      status: hasMajor ? 'alert' : 'warning',
      detail: `${activeMedWarnings.length} potential interaction(s) flagged with your active medications (${activeMedWarnings.map((w) => w.pair.find((p) => normalizeToken(p) !== rawMedNorm)).join(', ')}).`,
    });
  } else {
    checks.push({
      id: 'active-meds',
      label: 'Active Medication Cross-Check',
      status: 'pass',
      detail: `Screened against ${params.currentMedications.length} active medication(s) in your profile with no major deterministic conflict.`,
    });
  }

  // 5. Sex-Specific Clinical & Reproductive Safety Check
  const sexCheck = evaluateSexSpecificSafety(params.medicationName, params.sex, ageYears);
  checks.push(sexCheck);

  // Overall status
  let verificationStatus: VerificationStatus = 'verified';
  if (allergyAlert.severity === 'critical' || ageStatus === 'alert' || sexCheck.status === 'alert') {
    verificationStatus = 'contraindicated';
  } else if (
    allergyAlert.severity === 'caution' ||
    ageStatus === 'warning' ||
    checks.some((c) => c.status === 'warning' || c.status === 'alert')
  ) {
    verificationStatus = 'caution';
  }

  return {
    ageYears,
    ageGroupLabel,
    weightKg,
    sex: params.sex ?? null,
    allergyAlert,
    verificationChecks: checks,
    verificationStatus,
    activeMedWarnings,
  };
}

const DUPLICATE_THERAPEUTIC_FAMILIES: Array<{
  familyName: string;
  patterns: RegExp[];
  warning: string;
}> = [
  {
    familyName: 'Acetaminophen / Paracetamol',
    patterns: [/\b(acetaminophen|paracetamol|tylenol|calpol|dolo|crocin|panadol)\b/i],
    warning:
      'Multiple compositions contain Acetaminophen / Paracetamol. Combining them risks severe liver overdose — never exceed 4,000 mg/day total in adults (or 75 mg/kg/day in children).',
  },
  {
    familyName: 'NSAIDs (Pain & Inflammation)',
    patterns: [/\b(ibuprofen|naproxen|diclofenac|aceclofenac|aspirin|ketorolac|meloxicam|celecoxib|mefenamic|nimesulide|indomethacin|advil|motrin|combiflam|voveran)\b/i],
    warning:
      'Multiple NSAID compositions are present simultaneously. Combining two NSAIDs increases stomach bleeding, ulcer, and kidney injury risk without added benefit.',
  },
  {
    familyName: 'Sedating Antihistamines',
    patterns: [/\b(chlorpheniramine|diphenhydramine|hydroxyzine|promethazine|cetirizine|levocetirizine|pheniramine)\b/i],
    warning:
      'Multiple antihistamine compositions are combined, which increases drowsiness, dry mouth, and impaired alertness.',
  },
  {
    familyName: 'Oral Decongestants',
    patterns: [/\b(phenylephrine|pseudoephedrine)\b/i],
    warning:
      'Multiple nasal decongestant compositions can raise blood pressure, heart rate, and jitteriness.',
  },
];

export interface CombinedSafetyProtocolResult extends DeterministicVerificationOutput {
  compositions: CompositionItem[];
  internalCompositionWarnings: DeterministicInteractionWarning[];
  duplicateFamilyWarnings: string[];
}

/**
 * Runs deterministic safety verification across 2, 3, 4, or more compositions simultaneously:
 * - Screens EVERY composition against patient allergies, age-band limits, and sex-specific rules
 * - Detects internal composition-to-composition drug interactions
 * - Detects duplicate active ingredients or overlapping therapeutic families (e.g., dual paracetamol or dual NSAIDs)
 */
export function runCombinedCompositionSafetyProtocol(params: {
  compositions: CompositionItem[];
  ageValue: number;
  ageUnit: AgeUnit;
  sex?: PatientSex | null;
  weightValue?: number | null;
  weightUnit?: WeightUnit;
  allergies: string[];
  currentMedications: string[];
}): CombinedSafetyProtocolResult {
  const cleanCompositions = params.compositions
    .map((c) => ({
      name: c.name.trim(),
      strength: c.strength?.trim() || '',
    }))
    .filter((c) => c.name.length > 0);

  const combinedLabel = cleanCompositions.map((c) => c.name).join(' + ');
  const ageYears = toAgeInYears(params.ageValue, params.ageUnit);
  const ageGroupLabel = getAgeGroupLabel(ageYears);
  const weightKg = toWeightInKg(params.weightValue, params.weightUnit ?? 'kg');

  // 1. Evaluate allergy across EVERY composition and keep the most severe alert
  const allergyRank: Record<string, number> = { clear: 0, caution: 1, critical: 2 };
  let worstAllergy: AllergyAlert = {
    severity: 'clear',
    headline: `No recorded allergy conflicts across all ${cleanCompositions.length} compositions`,
    matchedAllergens: [],
    explanation:
      params.allergies.length === 0
        ? 'No drug allergies were entered. Always confirm your full allergy list before taking combination medications.'
        : `Screened all ${cleanCompositions.length} compositions against ${params.allergies.length} recorded allergy item(s) with no direct or cross-reactive match.`,
    recommendedAction: 'Confirm inactive excipients and label warnings with your pharmacist.',
  };

  const allMatchedAllergens = new Set<string>();
  const triggeredAllergyDetails: string[] = [];

  for (const comp of cleanCompositions) {
    const alert = evaluateAllergyConflict(comp.name, params.allergies);
    if (alert.severity !== 'clear') {
      alert.matchedAllergens.forEach((m) => allMatchedAllergens.add(m));
      triggeredAllergyDetails.push(`${comp.name}: ${alert.headline}`);
      if (allergyRank[alert.severity] > allergyRank[worstAllergy.severity]) {
        worstAllergy = {
          ...alert,
          headline: `${alert.severity === 'critical' ? 'Critical' : 'Caution'} Allergy Match in Combined Compositions`,
        };
      }
    }
  }
  if (triggeredAllergyDetails.length > 0) {
    worstAllergy = {
      ...worstAllergy,
      matchedAllergens: Array.from(allMatchedAllergens),
      explanation: `${triggeredAllergyDetails.join(' | ')}. ${worstAllergy.explanation}`,
    };
  }

  const checks: VerificationCheck[] = [
    {
      id: 'allergy-screen',
      label: `Allergy & Cross-Reactivity Screen (${cleanCompositions.length} Compositions)`,
      status:
        worstAllergy.severity === 'critical'
          ? 'alert'
          : worstAllergy.severity === 'caution'
            ? 'warning'
            : 'pass',
      detail: worstAllergy.headline,
    },
  ];

  // 2. Age-band screening across every composition
  let worstAgeStatus: 'pass' | 'warning' | 'alert' = 'pass';
  const ageIssues: string[] = [];
  for (const comp of cleanCompositions) {
    const single = runAutomatedVerificationProtocol({
      medicationName: comp.name,
      ageValue: params.ageValue,
      ageUnit: params.ageUnit,
      sex: params.sex,
      weightValue: params.weightValue,
      weightUnit: params.weightUnit,
      allergies: [],
      currentMedications: [],
    });
    const ageCheck = single.verificationChecks.find((c) => c.id === 'age-eligibility');
    if (ageCheck && (ageCheck.status === 'alert' || ageCheck.status === 'warning')) {
      ageIssues.push(`${comp.name}: ${ageCheck.detail}`);
      if (ageCheck.status === 'alert') {
        worstAgeStatus = 'alert';
      } else if (worstAgeStatus !== 'alert') {
        worstAgeStatus = 'warning';
      }
    }
  }

  checks.push({
    id: 'age-eligibility',
    label: `Age-Stratified Check (${cleanCompositions.length} Compositions)`,
    status: worstAgeStatus,
    detail:
      ageIssues.length > 0
        ? ageIssues.join(' ')
        : `All ${cleanCompositions.length} compositions passed automated age-band screening for ${ageGroupLabel} (${params.ageValue} ${params.ageUnit}).`,
  });

  // 3. Duplicate ingredient / therapeutic family overlap + internal composition interactions
  const duplicateFamilyWarnings: string[] = [];
  const exactSeen = new Map<string, string>();
  for (const comp of cleanCompositions) {
    const expanded = normalizeToken(expandMedicationWithGeneric(comp.name));
    if (exactSeen.has(expanded)) {
      duplicateFamilyWarnings.push(
        `Duplicate active composition detected: "${comp.name}" overlaps with "${exactSeen.get(expanded)}". Avoid taking duplicate active ingredients.`
      );
    } else {
      exactSeen.set(expanded, comp.name);
    }
  }

  for (const fam of DUPLICATE_THERAPEUTIC_FAMILIES) {
    const matchedComps = cleanCompositions.filter((comp) => {
      const expanded = expandMedicationWithGeneric(comp.name);
      return fam.patterns.some((p) => p.test(expanded));
    });
    if (matchedComps.length >= 2) {
      duplicateFamilyWarnings.push(
        `${fam.familyName} overlap (${matchedComps.map((c) => c.name).join(' + ')}): ${fam.warning}`
      );
    }
  }

  const internalCompositionWarnings = evaluateDeterministicInteractions(
    cleanCompositions.map((c) => c.name)
  );

  const hasMajorInternal =
    internalCompositionWarnings.some((w) => w.severity === 'major') ||
    duplicateFamilyWarnings.length > 0;
  const hasModerateInternal = internalCompositionWarnings.some((w) => w.severity === 'moderate');

  checks.push({
    id: 'combined-compatibility',
    label: `Multi-Composition Compatibility (${cleanCompositions.length} Ingredients)`,
    status: hasMajorInternal ? 'alert' : hasModerateInternal ? 'warning' : 'pass',
    detail:
      duplicateFamilyWarnings.length > 0
        ? duplicateFamilyWarnings.join(' ')
        : internalCompositionWarnings.length > 0
          ? internalCompositionWarnings
              .map((w) => `${w.pair.join(' + ')} (${w.severity.toUpperCase()}): ${w.summary}`)
              .join(' ')
          : `No duplicate therapeutic class overlap or major internal drug-to-drug conflict detected among ${combinedLabel}.`,
  });

  // 4. Optional Weight Protocol
  if (weightKg === null) {
    const needsWeightForKids = ageYears < 12;
    checks.push({
      id: 'weight-protocol',
      label: 'Optional Weight Stratification',
      status: needsWeightForKids ? 'warning' : 'info',
      detail: needsWeightForKids
        ? 'Weight was omitted for a child under 12. Entering patient weight is strongly recommended so every composition stays within safe mg/kg ceilings.'
        : 'Weight omitted (optional). Standard adult/adolescent combined age-based dosing protocol applied.',
    });
  } else {
    const seemsPlausible =
      (ageYears < 1 && weightKg >= 2 && weightKg <= 15) ||
      (ageYears >= 1 && ageYears < 12 && weightKg >= 6 && weightKg <= 70) ||
      (ageYears >= 12 && weightKg >= 25 && weightKg <= 250);
    checks.push({
      id: 'weight-protocol',
      label: 'Weight-Based Dosing & Plausibility',
      status: seemsPlausible ? 'pass' : 'warning',
      detail: seemsPlausible
        ? `Weight verified at ${weightKg} kg across all ${cleanCompositions.length} compositions for mg/kg safety ceilings.`
        : `Entered weight (${weightKg} kg) is unusual for age ${params.ageValue} ${params.ageUnit}. Double-check kg vs. lbs unit selection.`,
    });
  }

  // 5. Active Profile Medication Cross-Check across all compositions
  const activeMedWarnings: DeterministicInteractionWarning[] = [];
  if (params.currentMedications.length > 0) {
    const compTokens = new Set(cleanCompositions.map((c) => normalizeToken(c.name)));
    const combinedList = [
      ...cleanCompositions.map((c) => c.name),
      ...params.currentMedications.filter((m) => !compTokens.has(normalizeToken(m))),
    ];
    const allCross = evaluateDeterministicInteractions(combinedList).filter((w) => {
      const aInComp = compTokens.has(normalizeToken(w.pair[0]));
      const bInComp = compTokens.has(normalizeToken(w.pair[1]));
      return (aInComp && !bInComp) || (!aInComp && bInComp);
    });
    activeMedWarnings.push(...allCross);
  }

  checks.push(
    params.currentMedications.length === 0
      ? {
          id: 'active-meds',
          label: 'Active Medication Cross-Check',
          status: 'info',
          detail:
            'No current medications listed in your profile. Add current medications to screen automatically.',
        }
      : activeMedWarnings.length > 0
        ? {
            id: 'active-meds',
            label: 'Active Medication Cross-Check',
            status: activeMedWarnings.some((w) => w.severity === 'major') ? 'alert' : 'warning',
            detail: `${activeMedWarnings.length} potential interaction(s) flagged between these compositions and your active profile medications.`,
          }
        : {
            id: 'active-meds',
            label: 'Active Medication Cross-Check',
            status: 'pass',
            detail: `Screened all ${cleanCompositions.length} compositions against ${params.currentMedications.length} active profile medication(s) with no major deterministic conflict.`,
          }
  );

  // 6. Sex-Specific Clinical Screening across every composition
  let worstSexStatus: 'pass' | 'info' | 'warning' | 'alert' = 'pass';
  const sexDetails: string[] = [];
  const sexStatusRank: Record<string, number> = { pass: 0, info: 1, warning: 2, alert: 3 };
  for (const comp of cleanCompositions) {
    const sCheck = evaluateSexSpecificSafety(comp.name, params.sex, ageYears);
    if (sexStatusRank[sCheck.status] > sexStatusRank[worstSexStatus]) {
      worstSexStatus = sCheck.status;
    }
    if (sCheck.status !== 'pass') {
      sexDetails.push(`${comp.name}: ${sCheck.detail}`);
    }
  }

  checks.push({
    id: 'sex-protocol',
    label: `Sex-Specific Clinical Safety (${cleanCompositions.length} Compositions)`,
    status: worstSexStatus,
    detail:
      sexDetails.length > 0
        ? sexDetails.join(' ')
        : `Evaluated all ${cleanCompositions.length} compositions for ${params.sex === 'female' ? 'Female' : 'Male'} patient (${params.ageValue} ${params.ageUnit}). No automated sex-specific contraindication triggered.`,
  });

  // Overall status
  let verificationStatus: VerificationStatus = 'verified';
  if (
    worstAllergy.severity === 'critical' ||
    worstAgeStatus === 'alert' ||
    worstSexStatus === 'alert' ||
    hasMajorInternal
  ) {
    verificationStatus = 'contraindicated';
  } else if (
    worstAllergy.severity === 'caution' ||
    worstAgeStatus === 'warning' ||
    checks.some((c) => c.status === 'warning' || c.status === 'alert')
  ) {
    verificationStatus = 'caution';
  }

  return {
    compositions: cleanCompositions,
    ageYears,
    ageGroupLabel,
    weightKg,
    sex: params.sex ?? null,
    allergyAlert: worstAllergy,
    verificationChecks: checks,
    verificationStatus,
    activeMedWarnings,
    internalCompositionWarnings,
    duplicateFamilyWarnings,
  };
}

/**
 * Payload sanitization matching firebase-blueprint.json verbatim boundaries.
 */
export function sanitizeString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function sanitizeStringList(items: string[], maxItems: number, maxItemLength: number): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const clean = item.trim().slice(0, maxItemLength);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
    if (unique.length >= maxItems) break;
  }
  return unique;
}
