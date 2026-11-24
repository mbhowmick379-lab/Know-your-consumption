export type AgeUnit = 'years' | 'months';
export type WeightUnit = 'kg' | 'lbs';
export type PatientSex = 'male' | 'female';

export type AllergySeverity = 'clear' | 'caution' | 'critical';
export type VerificationStatus = 'verified' | 'caution' | 'contraindicated';
export type InteractionSeverity = 'none' | 'minor' | 'moderate' | 'major';

export type AppSection =
  | 'home'
  | 'dosage'
  | 'ml-calculator'
  | 'vitals'
  | 'interactions'
  | 'records'
  | 'safety';

export interface VerifiedClinicalSource {
  title: string;
  url: string;
  sourceType: 'fda' | 'nih' | 'web';
}

export interface LiveEvidenceSummary {
  internetConnected: boolean;
  fdaLabelFound: boolean;
  rxNormMatched: boolean;
  googleSearchUsed: boolean;
  searchQueriesUsed: string[];
}

export interface VerificationCheck {
  id: string;
  label: string;
  status: 'pass' | 'warning' | 'alert' | 'info';
  detail: string;
}

export interface AllergyAlert {
  severity: AllergySeverity;
  headline: string;
  matchedAllergens: string[];
  explanation: string;
  recommendedAction: string;
}

export interface DeterministicInteractionWarning {
  pair: [string, string];
  severity: InteractionSeverity;
  summary: string;
  guidance: string;
}

export interface CompositionItem {
  name: string;
  strength?: string;
}

export interface CompositionBreakdownItem {
  compositionName: string;
  genericName: string;
  role: string;
  perDoseAmount: string;
  maxDailyLimit: string;
  safetyStatus: 'safe' | 'caution' | 'avoid';
  note: string;
}

export interface ExtractedMedicineImageResult {
  brandName: string;
  dosageForm: string;
  compositions: CompositionItem[];
  liquidStrengthMg: number | null;
  liquidPerMl: number | null;
  indicationHint: string;
  confidence: 'high' | 'medium' | 'low';
  extractedSummary: string;
  warnings: string[];
}

export type DosageFormOption = 'tablet' | 'capsule' | 'liquid';
export type MultiContainerBasis = 'liquid' | 'tablet' | 'capsule';

export interface DosageRequest {
  medicationName: string;
  dosageForm?: DosageFormOption;
  unitStrengthMg?: number | null;
  compositions?: CompositionItem[];
  multiContainerBasis?: MultiContainerBasis;
  multiContainerMl?: number | null;
  multiTotalMg?: number | null;
  ageValue: number;
  ageUnit: AgeUnit;
  sex: PatientSex;
  weightValue?: number | null;
  weightUnit?: WeightUnit;
  allergies: string[];
  currentMedications: string[];
  indication?: string;
  concentrationMg?: number | null;
  concentrationPerMl?: number | null;
}

export interface DosageAnalysisResult {
  medicationName: string;
  genericName: string;
  recognizedBrandName?: string;
  matchedAs?: 'brand' | 'generic' | 'combination';
  commonBrandNames?: string[];
  drugCategory: string;
  isAntibiotic: boolean;
  ageGroupLabel: string;
  patientSex?: PatientSex;
  sexSpecificGuidance?: string;
  dosingBasis: 'weight-based' | 'age-based' | 'contraindicated';
  recommendedDose: string;
  recommendedDoseMl: string;
  liquidCalculationDetail: string;
  weightCalculationDetail: string;
  frequency: string;
  maxDailyLimit: string;
  typicalDuration: string;
  administrationTips: string[];
  antibioticCourseNote: string;
  allergyAlert: AllergyAlert;
  verificationStatus: VerificationStatus;
  verificationChecks: VerificationCheck[];
  activeMedicationInteractions: {
    medication: string;
    severity: InteractionSeverity;
    explanation: string;
  }[];
  isCombinedComposition?: boolean;
  combinedCompositionsCount?: number;
  combinedContainerSummary?: string;
  compositionBreakdown?: CompositionBreakdownItem[];
  combinedSynergyAndOverlapSummary?: string;
  watchOutSymptoms: string[];
  clinicalReferences: string[];
  verifiedSources?: VerifiedClinicalSource[];
  liveEvidenceUsed?: LiveEvidenceSummary;
  patientDisclaimer: string;
  generatedAt: string;
}

export interface InteractionPairResult {
  drugA: string;
  drugB: string;
  severity: InteractionSeverity;
  headline: string;
  plainLanguageExplanation: string;
  symptomsToWatch: string[];
  managementGuidance: string;
}

export interface InteractionAnalysisResult {
  medications: string[];
  resolvedMedications?: { inputName: string; genericName: string; brandOrGeneric: string }[];
  overallSeverity: InteractionSeverity;
  executiveSummary: string;
  pairs: InteractionPairResult[];
  foodAndAlcoholNotes: string[];
  actionGuidance: string;
  clinicalReferences: string[];
  verifiedSources?: VerifiedClinicalSource[];
  liveEvidenceUsed?: LiveEvidenceSummary;
  generatedAt: string;
}

export interface PatientProfile {
  userId: string;
  displayName: string;
  sex: PatientSex | null;
  ageValue: number | null;
  ageUnit: AgeUnit;
  weightValue: number | null;
  weightUnit: WeightUnit;
  allergies: string[];
  currentMedications: string[];
  updatedAt?: string;
}

export interface SavedDosageRecord {
  id: string;
  userId: string;
  medicationName: string;
  drugCategory: string;
  sexDisplay?: string;
  ageDisplay: string;
  weightDisplay: string;
  recommendedDose: string;
  frequency: string;
  maxDailyLimit: string;
  duration: string;
  allergyStatus: AllergySeverity;
  verificationStatus: VerificationStatus;
  summaryNotes: string;
  allergiesChecked: string[];
  createdAt: string;
  source: 'cloud' | 'local';
}

export interface SavedInteractionRecord {
  id: string;
  userId: string;
  medications: string[];
  overallSeverity: InteractionSeverity;
  summary: string;
  actionGuidance: string;
  createdAt: string;
  source: 'cloud' | 'local';
}
