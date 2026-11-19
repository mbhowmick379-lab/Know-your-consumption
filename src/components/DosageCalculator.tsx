import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Download,
  Droplets,
  ExternalLink,
  Globe,
  HeartPulse,
  Info,
  Layers,
  Pill,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  ShieldCheck,
  Syringe,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AgeUnit,
  CompositionItem,
  DosageAnalysisResult,
  DosageFormOption,
  ExtractedMedicineImageResult,
  MultiContainerBasis,
  PatientSex,
  WeightUnit,
} from '../types/clinical';
import {
  COMBINED_COMPOSITION_PRESETS,
  COMMON_ALLERGENS,
  evaluateAllergyConflict,
} from '../utils/clinicalSafety';
import {
  resolveDrugIdentity,
  searchDrugCatalog,
  type DrugCategory,
} from '../utils/drugCatalog';
import {
  formatSingleMedicineFromScan,
  mergeCompositionsIntoRows,
} from '../utils/imageComposition';
import { LIQUID_STRENGTH_PRESETS } from '../utils/liquidDose';
import {
  computeMultiCompositionTotalMg,
  formatMultiContainerSummary,
} from '../utils/multiCompositionVolume';
import { formatDosageSummaryText, triggerFileDownload } from '../utils/recordExport';
import { usePatient } from '../contexts/PatientContext';
import { MedicineImageScanner } from './MedicineImageScanner';

const HERO_IMAGE_PATH = '/src/assets/images/clinical_care_hero_1795065409579.jpg';

const DRUG_CATEGORIES: Array<{
  id: 'All' | DrugCategory;
  activeBtn: string;
  cardHover: string;
  cardActive: string;
}> = [
  {
    id: 'All',
    activeBtn: 'bg-indigo-600 text-white shadow-xs',
    cardHover: 'hover:border-indigo-500/60 hover:bg-indigo-950/40',
    cardActive: 'border-indigo-500 bg-indigo-950/60 text-indigo-100 font-semibold',
  },
  {
    id: 'Antibiotics',
    activeBtn: 'bg-teal-600 text-white shadow-xs',
    cardHover: 'hover:border-teal-500/60 hover:bg-teal-950/40',
    cardActive: 'border-teal-500 bg-teal-950/60 text-teal-100 font-semibold',
  },
  {
    id: 'Pain & Fever',
    activeBtn: 'bg-rose-600 text-white shadow-xs',
    cardHover: 'hover:border-rose-500/60 hover:bg-rose-950/40',
    cardActive: 'border-rose-500 bg-rose-950/60 text-rose-100 font-semibold',
  },
  {
    id: 'Allergy & Respiratory',
    activeBtn: 'bg-sky-600 text-white shadow-xs',
    cardHover: 'hover:border-sky-500/60 hover:bg-sky-950/40',
    cardActive: 'border-sky-500 bg-sky-950/60 text-sky-100 font-semibold',
  },
  {
    id: 'Heart & Metabolism',
    activeBtn: 'bg-amber-600 text-white shadow-xs',
    cardHover: 'hover:border-amber-500/60 hover:bg-amber-950/40',
    cardActive: 'border-amber-500 bg-amber-950/60 text-amber-100 font-semibold',
  },
  {
    id: 'Digestive & Other',
    activeBtn: 'bg-violet-600 text-white shadow-xs',
    cardHover: 'hover:border-violet-500/60 hover:bg-violet-950/40',
    cardActive: 'border-violet-500 bg-violet-950/60 text-violet-100 font-semibold',
  },
];

interface DosageCalculatorProps {
  onPrintDosage: (
    result: DosageAnalysisResult,
    meta: { sexDisplay: string; ageDisplay: string; weightDisplay: string; allergies: string[] }
  ) => void;
  onNavigateInteractions: (prefillDrugs: string[]) => void;
  onOpenMlCalculator: (prefill?: {
    medicationName?: string;
    targetDoseMg?: number;
    strengthMg?: number;
    strengthPerMl?: number;
  }) => void;
  onOpenVitals?: () => void;
  onJumpToRabies?: () => void;
}

export function DosageCalculator({
  onPrintDosage,
  onNavigateInteractions,
  onOpenMlCalculator,
  onOpenVitals,
  onJumpToRabies,
}: DosageCalculatorProps) {
  const { profile, saveDosageCheck } = usePatient();

  const [entryMode, setEntryMode] = useState<'single' | 'multi'>('single');
  const [medicationName, setMedicationName] = useState('');
  const [compositions, setCompositions] = useState<CompositionItem[]>([
    { name: '', strength: '' },
    { name: '', strength: '' },
    { name: '', strength: '' },
  ]);
  const [multiContainerBasis, setMultiContainerBasis] = useState<MultiContainerBasis>('liquid');
  const [multiContainerMl, setMultiContainerMl] = useState('5');
  const [multiTotalMgOverride, setMultiTotalMgOverride] = useState('');
  const [indication, setIndication] = useState('');
  const [sex, setSex] = useState<PatientSex | null>(profile.sex || null);
  const [ageInput, setAgeInput] = useState(() =>
    profile.ageValue !== null && profile.ageValue !== undefined ? String(profile.ageValue) : ''
  );
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(profile.ageUnit || 'years');
  const [weightInput, setWeightInput] = useState(() =>
    profile.weightValue !== null && profile.weightValue !== undefined ? String(profile.weightValue) : ''
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weightUnit || 'kg');
  const [singleDosageForm, setSingleDosageForm] = useState<DosageFormOption>('tablet');
  const [unitStrengthMg, setUnitStrengthMg] = useState('');
  const [concentrationMg, setConcentrationMg] = useState('');
  const [concentrationPerMl, setConcentrationPerMl] = useState('5');
  const [allergies, setAllergies] = useState<string[]>(profile.allergies || []);
  const [customAllergy, setCustomAllergy] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | DrugCategory>('Antibiotics');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<{
    medication?: string;
    sex?: string;
    age?: string;
    weight?: string;
    liquid?: string;
  }>({});
  const [result, setResult] = useState<DosageAnalysisResult | null>(null);
  const [lastQueryMeta, setLastQueryMeta] = useState<{
    sexDisplay: string;
    ageDisplay: string;
    weightDisplay: string;
    allergies: string[];
  } | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);

  useEffect(() => {
    if (!sex && profile.sex) {
      setSex(profile.sex);
    }
    if (!ageInput && profile.ageValue !== null && profile.ageValue !== undefined) {
      setAgeInput(String(profile.ageValue));
      setAgeUnit(profile.ageUnit);
    }
    if (!weightInput && profile.weightValue !== null && profile.weightValue !== undefined) {
      setWeightInput(String(profile.weightValue));
      setWeightUnit(profile.weightUnit);
    }
    if (allergies.length === 0 && profile.allergies.length > 0) {
      setAllergies(profile.allergies);
    }
  }, [profile]);

  const activeCategoryTheme =
    DRUG_CATEGORIES.find((c) => c.id === selectedCategory) || DRUG_CATEGORIES[1];

  // Instant Brand & Generic Recognition
  const recognizedDrug = useMemo(() => resolveDrugIdentity(medicationName), [medicationName]);

  const filteredCatalogMeds = useMemo(() => {
    const queryTrimmed = medicationName.trim();
    // If user is typing a brand name that belongs to another category, search across All automatically
    const effectiveCategory =
      queryTrimmed && recognizedDrug && recognizedDrug.category !== selectedCategory
        ? 'All'
        : selectedCategory;
    return searchDrugCatalog(queryTrimmed, effectiveCategory, 8);
  }, [selectedCategory, medicationName, recognizedDrug]);

  const liveAllergyPreview = useMemo(() => {
    if (allergies.length === 0) return null;
    if (entryMode === 'multi') {
      const filled = compositions.map((c) => c.name.trim()).filter(Boolean);
      if (filled.length === 0) return null;
      for (const name of filled) {
        const alert = evaluateAllergyConflict(name, allergies);
        if (alert.severity === 'critical') return alert;
      }
      for (const name of filled) {
        const alert = evaluateAllergyConflict(name, allergies);
        if (alert.severity === 'caution') return alert;
      }
      return null;
    }
    if (!medicationName.trim()) return null;
    const alert = evaluateAllergyConflict(medicationName, allergies);
    return alert.severity === 'clear' ? null : alert;
  }, [entryMode, medicationName, compositions, allergies]);

  const handleCompositionChange = (index: number, field: 'name' | 'strength', value: string) => {
    setCompositions((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
    if (formErrors.medication) setFormErrors((f) => ({ ...f, medication: undefined }));
  };

  const handleAddCompositionRow = () => {
    if (compositions.length >= 8) return;
    setCompositions((prev) => [...prev, { name: '', strength: '' }]);
  };

  const handleRemoveCompositionRow = (index: number) => {
    if (compositions.length <= 2) return;
    setCompositions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const multiMgSummary = useMemo(
    () => computeMultiCompositionTotalMg(compositions),
    [compositions]
  );

  const effectiveMultiTotalMgValue = useMemo(() => {
    if (multiTotalMgOverride.trim() !== '') {
      const n = Number(multiTotalMgOverride);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    return multiMgSummary.autoTotalMg > 0 ? multiMgSummary.autoTotalMg : null;
  }, [multiTotalMgOverride, multiMgSummary.autoTotalMg]);

  const liveMultiContainerSummary = useMemo(
    () =>
      formatMultiContainerSummary({
        compositions,
        basis: multiContainerBasis,
        perMl: multiContainerBasis === 'liquid' ? Number(multiContainerMl) : null,
        totalMg: effectiveMultiTotalMgValue,
      }),
    [compositions, multiContainerBasis, multiContainerMl, effectiveMultiTotalMgValue]
  );

  const applyOptionalScanMetadata = (extracted: ExtractedMedicineImageResult) => {
    if (extracted.liquidStrengthMg && extracted.liquidPerMl) {
      setSingleDosageForm('liquid');
      setConcentrationMg(String(extracted.liquidStrengthMg));
      setConcentrationPerMl(String(extracted.liquidPerMl));
    }
    if (extracted.liquidPerMl) {
      setSingleDosageForm('liquid');
      setMultiContainerBasis('liquid');
      setMultiContainerMl(String(extracted.liquidPerMl));
    } else if (extracted.dosageForm && /capsule/i.test(extracted.dosageForm)) {
      setSingleDosageForm('capsule');
      setMultiContainerBasis('capsule');
    } else if (extracted.dosageForm && /tablet|caplet|pill/i.test(extracted.dosageForm)) {
      setSingleDosageForm('tablet');
      setMultiContainerBasis('tablet');
    }
    if (!indication.trim() && extracted.indicationHint) {
      setIndication(extracted.indicationHint);
    }
    setFormErrors((f) => ({ ...f, medication: undefined }));
  };

  const handleImageExtracted = (extracted: ExtractedMedicineImageResult) => {
    applyOptionalScanMetadata(extracted);

    if (entryMode === 'multi') {
      const incoming =
        extracted.compositions.length > 0
          ? extracted.compositions
          : extracted.brandName
            ? [{ name: extracted.brandName, strength: '' }]
            : [];
      if (incoming.length > 0) {
        setCompositions((prev) => mergeCompositionsIntoRows(prev, incoming, 8, 3));
        setMultiTotalMgOverride('');
      }
    } else {
      const singleName = formatSingleMedicineFromScan(extracted);
      if (singleName) {
        setMedicationName(singleName);
      }
    }
  };

  const handleSwitchToMultiWithExtracted = (extracted: ExtractedMedicineImageResult) => {
    applyOptionalScanMetadata(extracted);
    setEntryMode('multi');
    setMultiTotalMgOverride('');
    if (extracted.compositions.length > 0) {
      setCompositions(mergeCompositionsIntoRows([], extracted.compositions, 8, 3));
    }
  };

  const toggleAllergen = (allergen: string) => {
    setAllergies((prev) =>
      prev.some((a) => a.toLowerCase() === allergen.toLowerCase())
        ? prev.filter((a) => a.toLowerCase() !== allergen.toLowerCase())
        : [...prev, allergen]
    );
  };

  const handleAddCustomAllergy = () => {
    const clean = customAllergy.trim();
    if (!clean) return;
    if (!allergies.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      setAllergies((prev) => [...prev, clean.slice(0, 80)]);
    }
    setCustomAllergy('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedNotice(false);

    const nextErrors: {
      medication?: string;
      sex?: string;
      age?: string;
      weight?: string;
      liquid?: string;
    } = {};
    const cleanMed = medicationName.trim();
    const validCompositions = compositions
      .map((c) => ({ name: c.name.trim(), strength: c.strength?.trim() || '' }))
      .filter((c) => c.name.length > 0);
    const parsedAge = ageInput.trim() === '' ? NaN : Number(ageInput);
    const parsedWeight = weightInput.trim() === '' ? null : Number(weightInput);
    const parsedUnitStrengthMg =
      entryMode === 'single' && singleDosageForm !== 'liquid' && unitStrengthMg.trim() !== ''
        ? Number(unitStrengthMg)
        : null;
    const parsedConcMg =
      entryMode === 'single' && singleDosageForm === 'liquid' && concentrationMg.trim() !== ''
        ? Number(concentrationMg)
        : null;
    const parsedConcMl =
      entryMode === 'single' && singleDosageForm === 'liquid' && concentrationMg.trim() !== ''
        ? Number(concentrationPerMl)
        : null;
    const parsedMultiMl =
      entryMode === 'multi' && multiContainerBasis === 'liquid' && multiContainerMl.trim() !== ''
        ? Number(multiContainerMl)
        : null;
    const parsedMultiTotalMg =
      entryMode === 'multi' && effectiveMultiTotalMgValue !== null
        ? effectiveMultiTotalMgValue
        : null;

    if (entryMode === 'single') {
      if (!cleanMed) {
        nextErrors.medication = 'Enter any brand or generic antibiotic/medication name to check.';
      }
    } else {
      if (validCompositions.length < 2) {
        nextErrors.medication =
          'Enter at least 2 active compositions (you can add 3, 4, or up to 8 compositions at the same time).';
      } else if (
        multiContainerBasis === 'liquid' &&
        (parsedMultiMl === null || !Number.isFinite(parsedMultiMl) || parsedMultiMl <= 0 || parsedMultiMl > 500)
      ) {
        nextErrors.medication =
          'Enter a valid positive liquid volume in mL (e.g., 5 mL or 10 mL) for your multi-composition syrup.';
      } else if (
        multiTotalMgOverride.trim() !== '' &&
        (!Number.isFinite(Number(multiTotalMgOverride)) || Number(multiTotalMgOverride) <= 0)
      ) {
        nextErrors.medication = 'Total mg contained must be a positive number (or leave blank to auto-sum).';
      }
    }
    if (!sex) {
      nextErrors.sex = 'Select patient sex (Male or Female) for sex-specific clinical safety checks.';
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 0 || parsedAge > 120) {
      nextErrors.age = 'Enter a valid age between 0 and 120.';
    }
    if (parsedWeight !== null && (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 350)) {
      nextErrors.weight = 'Enter a realistic weight or leave blank (optional).';
    }
    if (
      entryMode === 'single' &&
      singleDosageForm !== 'liquid' &&
      parsedUnitStrengthMg !== null &&
      (!Number.isFinite(parsedUnitStrengthMg) || parsedUnitStrengthMg <= 0 || parsedUnitStrengthMg > 10000)
    ) {
      nextErrors.liquid = `Enter a valid positive mg strength per ${singleDosageForm} (e.g., 500 mg), or leave blank.`;
    }
    if (
      entryMode === 'single' &&
      singleDosageForm === 'liquid' &&
      parsedConcMg !== null &&
      (!Number.isFinite(parsedConcMg) ||
        parsedConcMg <= 0 ||
        parsedConcMl === null ||
        !Number.isFinite(parsedConcMl) ||
        parsedConcMl <= 0)
    ) {
      nextErrors.liquid = 'Enter valid positive numbers for both mg and mL (e.g., 250 mg per 5 mL).';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !sex) return;

    setLoading(true);
    try {
      const requestBody =
        entryMode === 'multi'
          ? {
              medicationName: validCompositions.map((c) => c.name).join(' + '),
              compositions: validCompositions,
              multiContainerBasis,
              multiContainerMl: multiContainerBasis === 'liquid' ? parsedMultiMl : null,
              multiTotalMg: parsedMultiTotalMg,
              sex,
              ageValue: parsedAge,
              ageUnit,
              weightValue: parsedWeight,
              weightUnit,
              allergies,
              currentMedications: profile.currentMedications,
              indication: indication.trim(),
            }
          : {
              medicationName: cleanMed,
              dosageForm: singleDosageForm,
              unitStrengthMg: singleDosageForm !== 'liquid' ? parsedUnitStrengthMg : null,
              sex,
              ageValue: parsedAge,
              ageUnit,
              weightValue: parsedWeight,
              weightUnit,
              allergies,
              currentMedications: profile.currentMedications,
              indication: indication.trim(),
              concentrationMg: singleDosageForm === 'liquid' ? parsedConcMg : null,
              concentrationPerMl: singleDosageForm === 'liquid' ? parsedConcMl : null,
            };

      const response = await fetch('/api/clinical/dosage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not retrieve clinical dosage guidance.');
      }

      const sexDisplay = sex === 'female' ? 'Female' : 'Male';
      const ageDisplay = `${parsedAge} ${ageUnit}`;
      const weightDisplay =
        parsedWeight !== null ? `${parsedWeight} ${weightUnit}` : 'Not provided (Optional)';

      setResult(payload as DosageAnalysisResult);
      setLastQueryMeta({
        sexDisplay,
        ageDisplay,
        weightDisplay,
        allergies: [...allergies],
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to reach the clinical dosing service. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveResult = async () => {
    if (!result || !lastQueryMeta) return;
    setSavingRecord(true);
    try {
      await saveDosageCheck(result, {
        sexDisplay: lastQueryMeta.sexDisplay,
        ageDisplay: lastQueryMeta.ageDisplay,
        weightDisplay: lastQueryMeta.weightDisplay,
        allergiesChecked: lastQueryMeta.allergies,
      });
      setSavedNotice(true);
    } finally {
      setSavingRecord(false);
    }
  };

  const handleDownloadSummary = () => {
    if (!result || !lastQueryMeta) return;
    const text = formatDosageSummaryText(result, {
      patientName: profile.displayName || undefined,
      sexDisplay: lastQueryMeta.sexDisplay,
      ageDisplay: lastQueryMeta.ageDisplay,
      weightDisplay: lastQueryMeta.weightDisplay,
      allergies: lastQueryMeta.allergies,
    });
    const safeSlug = result.medicationName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerFileDownload(`kyc-${safeSlug}-summary.txt`, text, 'text/plain;charset=utf-8');
  };

  const handleOpenMlWithResult = () => {
    if (!result) {
      onOpenMlCalculator();
      return;
    }
    const mgMatch = result.recommendedDose.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*mg/i);
    const extractedMg = mgMatch ? Number(mgMatch[1].replace(/,/g, '')) : undefined;
    onOpenMlCalculator({
      medicationName: result.medicationName,
      targetDoseMg: extractedMg,
      strengthMg: concentrationMg ? Number(concentrationMg) : 250,
      strengthPerMl: concentrationPerMl ? Number(concentrationPerMl) : 5,
    });
  };

  return (
    <div className="space-y-8">
      {/* Dark Vibrant Patient Header Intro */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold text-teal-400">
            Know Your Consumption(KYC) · Live Internet-Verified Brand &amp; Generic Dosing
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50 text-balance">
            Verify safe dosage in{' '}
            <span className="bg-gradient-to-r from-teal-300 via-sky-400 to-violet-400 bg-clip-text text-transparent">
              mg &amp; mL
            </span>{' '}
            for any brand or generic drug
          </h1>
          <p className="text-[15px] text-slate-300 leading-relaxed">
            Type any brand name (like Augmentin, Calpol, Dolo 650, Azithral, Advil, Zithromax) or
            generic medicine to cross-check live U.S. FDA drug labels, NIH RxNorm, and medical
            guidelines by sex, age, optional weight, allergies, and exact liquid mL volume.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={() => onOpenMlCalculator()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0"
          >
            <Droplets className="w-4 h-4" aria-hidden="true" />
            How Much mL to Give?
          </button>
          {onOpenVitals && (
            <button
              type="button"
              onClick={onOpenVitals}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-emerald-100 bg-emerald-600/20 hover:bg-emerald-600/35 border border-emerald-500/50 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <HeartPulse className="w-4 h-4 text-emerald-400" aria-hidden="true" />
              BP &amp; Sugar Check
            </button>
          )}
          {onJumpToRabies && (
            <button
              type="button"
              onClick={onJumpToRabies}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-rose-100 bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/50 rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              <Syringe className="w-4 h-4 text-rose-400" aria-hidden="true" />
              Rabies Dates
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Dark Colourful Structured Patient Form */}
        <section
          aria-label="Medication dosage calculator form"
          className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6"
        >
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Mode Switcher: Single Medicine vs Multi-Composition (3+ Ingredients Combined) */}
            <div className="space-y-2">
              <div
                className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 border border-slate-800 rounded-xl"
                role="tablist"
                aria-label="Medication entry mode"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={entryMode === 'single'}
                  onClick={() => {
                    setEntryMode('single');
                    setFormErrors((f) => ({ ...f, medication: undefined }));
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    entryMode === 'single'
                      ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Single Medicine
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={entryMode === 'multi'}
                  onClick={() => {
                    setEntryMode('multi');
                    setFormErrors((f) => ({ ...f, medication: undefined }));
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                    entryMode === 'multi'
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  Multi-Composition (3+)
                </button>
              </div>
            </div>

            {/* Camera Capture & Image Upload Scanner (Available in Both Single & Multi-Composition Modes) */}
            <MedicineImageScanner
              mode={entryMode}
              onExtracted={handleImageExtracted}
              onSwitchToMultiWithExtracted={handleSwitchToMultiWithExtracted}
            />

            {entryMode === 'multi' ? (
              /* Multi-Composition Builder (2, 3, 4, up to 8 Compositions Simultaneously) */
              <div className="space-y-3 p-4 rounded-xl bg-fuchsia-950/20 border border-fuchsia-500/35">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-slate-100">
                    Active Compositions ({compositions.filter((c) => c.name.trim()).length}/
                    {compositions.length})
                  </span>
                  <span className="text-[11px] font-medium text-fuchsia-300">
                    Add 2 to 8 compositions for combined results
                  </span>
                </div>

                <div className="space-y-2">
                  {compositions.map((comp, idx) => {
                    const compMatch = comp.name.trim() ? resolveDrugIdentity(comp.name) : null;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-6 h-6 rounded-md bg-fuchsia-600/30 border border-fuchsia-500/40 text-fuchsia-200 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={comp.name}
                            onChange={(e) => handleCompositionChange(idx, 'name', e.target.value)}
                            aria-label={`Composition ${idx + 1} name`}
                            placeholder={
                              idx === 0
                                ? 'e.g., Paracetamol'
                                : idx === 1
                                  ? 'e.g., Phenylephrine'
                                  : idx === 2
                                    ? 'e.g., Chlorpheniramine'
                                    : `Composition ${idx + 1} (brand or generic)`
                            }
                            className="min-w-0 flex-1 px-3 py-2 text-xs text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder:text-slate-500"
                          />
                          <input
                            type="text"
                            value={comp.strength || ''}
                            onChange={(e) => handleCompositionChange(idx, 'strength', e.target.value)}
                            aria-label={`Composition ${idx + 1} strength`}
                            placeholder="500 mg"
                            className="w-24 px-2.5 py-2 text-xs font-mono text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder:font-sans placeholder:text-slate-500"
                          />
                          {compositions.length > 2 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveCompositionRow(idx)}
                              aria-label={`Remove composition ${idx + 1}`}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {compMatch && compMatch.matchedAs === 'brand' && (
                          <p className="pl-7 text-[11px] text-teal-300">
                            Brand &ldquo;{compMatch.matchedTerm}&rdquo; → Generic:{' '}
                            <strong>{compMatch.genericName}</strong>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleAddCompositionRow}
                    disabled={compositions.length >= 8}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-lg transition-all disabled:opacity-45"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    Add Composition ({compositions.length}/8)
                  </button>
                  {compositions.some((c) => c.name.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompositions([
                          { name: '', strength: '' },
                          { name: '', strength: '' },
                          { name: '', strength: '' },
                        ]);
                        setMultiTotalMgOverride('');
                      }}
                      className="text-xs font-medium text-slate-400 hover:text-slate-100"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Total mg & Per-Volume Contains (In 5 mL, 10 mL, Tablet, or Capsule) */}
                <div className="pt-3 border-t border-fuchsia-500/25 space-y-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-1.5">
                    <span className="text-xs font-bold text-fuchsia-100">
                      Total mg Contained Per Volume / Form
                    </span>
                    <span className="text-[11px] font-medium text-fuchsia-300">
                      In 5 mL, 10 mL, 1 Tablet, or 1 Capsule
                    </span>
                  </div>

                  {/* Quick Unit / Volume Chips */}
                  <div
                    className="flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Multi-composition volume or unit basis"
                  >
                    {[
                      { label: 'In 5 mL', basis: 'liquid' as const, ml: '5' },
                      { label: 'In 10 mL', basis: 'liquid' as const, ml: '10' },
                      { label: 'In 1 mL', basis: 'liquid' as const, ml: '1' },
                      { label: 'In 15 mL', basis: 'liquid' as const, ml: '15' },
                      { label: 'Per 1 Tablet', basis: 'tablet' as const, ml: '' },
                      { label: 'Per 1 Capsule', basis: 'capsule' as const, ml: '' },
                    ].map((opt) => {
                      const active =
                        opt.basis === 'liquid'
                          ? multiContainerBasis === 'liquid' && multiContainerMl === opt.ml
                          : multiContainerBasis === opt.basis;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setMultiContainerBasis(opt.basis);
                            if (opt.basis === 'liquid') {
                              setMultiContainerMl(opt.ml);
                            }
                            setFormErrors((f) => ({ ...f, medication: undefined }));
                          }}
                          className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                            active
                              ? 'bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white shadow-xs'
                              : 'bg-slate-950/80 text-slate-300 border border-slate-700 hover:border-fuchsia-400/60 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom mL Volume + Total mg Contains Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {multiContainerBasis === 'liquid' && (
                      <div className="space-y-1">
                        <label
                          htmlFor="multi-container-ml"
                          className="block text-[11px] font-semibold text-slate-300"
                        >
                          Each Volume Contains (mL)
                        </label>
                        <div className="relative">
                          <input
                            id="multi-container-ml"
                            type="number"
                            min={0.1}
                            max={500}
                            step="any"
                            value={multiContainerMl}
                            onChange={(e) => {
                              setMultiContainerMl(e.target.value);
                              setFormErrors((f) => ({ ...f, medication: undefined }));
                            }}
                            placeholder="e.g., 5 or 10"
                            className="w-full pl-3 pr-10 py-2 text-xs font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-fuchsia-500/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-fuchsia-300">
                            mL
                          </span>
                        </div>
                      </div>
                    )}

                    <div
                      className={`space-y-1 ${
                        multiContainerBasis !== 'liquid' ? 'sm:col-span-2' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label
                          htmlFor="multi-total-mg"
                          className="block text-[11px] font-semibold text-slate-300"
                        >
                          Total mg Contained{' '}
                          {multiContainerBasis === 'liquid' && multiContainerMl
                            ? `(in ${multiContainerMl} mL)`
                            : multiContainerBasis === 'capsule'
                              ? '(per 1 Capsule)'
                              : '(per 1 Tablet)'}
                        </label>
                        {multiTotalMgOverride.trim() !== '' && multiMgSummary.autoTotalMg > 0 && (
                          <button
                            type="button"
                            onClick={() => setMultiTotalMgOverride('')}
                            className="text-[10px] font-semibold text-fuchsia-300 hover:text-fuchsia-200"
                          >
                            Auto ({multiMgSummary.autoTotalMg} mg)
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          id="multi-total-mg"
                          type="number"
                          min={0.1}
                          max={50000}
                          step="any"
                          value={
                            multiTotalMgOverride !== ''
                              ? multiTotalMgOverride
                              : multiMgSummary.autoTotalMg > 0
                                ? String(multiMgSummary.autoTotalMg)
                                : ''
                          }
                          onChange={(e) => {
                            setMultiTotalMgOverride(e.target.value);
                            setFormErrors((f) => ({ ...f, medication: undefined }));
                          }}
                          placeholder={
                            multiMgSummary.autoTotalMg > 0
                              ? String(multiMgSummary.autoTotalMg)
                              : 'Auto-sums from mg above'
                          }
                          className="w-full pl-3 pr-14 py-2 text-xs font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-fuchsia-500/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500 placeholder:font-sans placeholder:text-slate-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-amber-300">
                          total mg
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Live Container Composition Summary */}
                  {liveMultiContainerSummary && (
                    <div
                      data-testid="multi-container-summary"
                      className="p-2.5 rounded-lg bg-slate-950/90 border border-fuchsia-500/35 text-[11px] text-fuchsia-100 leading-relaxed"
                    >
                      <span className="font-bold text-amber-300">Contains: </span>
                      <span>{liveMultiContainerSummary}</span>
                    </div>
                  )}
                </div>

                {formErrors.medication && (
                  <p role="alert" className="text-xs font-semibold text-rose-400">
                    {formErrors.medication}
                  </p>
                )}

                {/* Quick 3- & 4-Composition Real-World Presets */}
                <div className="pt-2 border-t border-fuchsia-500/25 space-y-2">
                  <span className="block text-[11px] font-semibold text-slate-300">
                    Quick Multi-Composition Examples (3+ Ingredients)
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {COMBINED_COMPOSITION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setCompositions(preset.compositions.map((c) => ({ ...c })));
                          setMultiTotalMgOverride('');
                          if (preset.containerBasis === 'liquid') {
                            setMultiContainerBasis('liquid');
                            setMultiContainerMl(String(preset.containerMl || 5));
                          } else if (preset.containerBasis === 'capsule') {
                            setMultiContainerBasis('capsule');
                          } else {
                            setMultiContainerBasis('tablet');
                          }
                          if (!indication.trim()) setIndication(preset.indication);
                          setFormErrors((f) => ({ ...f, medication: undefined }));
                        }}
                        className="text-left px-2.5 py-2 rounded-lg border border-fuchsia-500/30 bg-slate-950/80 hover:border-fuchsia-400 hover:bg-fuchsia-950/40 transition-colors"
                      >
                        <div className="text-xs font-bold text-fuchsia-200 truncate">
                          {preset.label}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {preset.compositions.map((c) => c.name).join(' + ')}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Single Medication Input with Brand & Generic Recognition */
              <div className="space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor="medication-input" className="block text-sm font-bold text-slate-100">
                    Brand or Generic Medication Name
                  </label>
                  <span className="text-[11px] font-medium text-teal-400">
                    All global brands &amp; generics
                  </span>
                </div>
                <div className="relative">
                  <Search
                    className="w-4 h-4 text-teal-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="medication-input"
                    type="text"
                    value={medicationName}
                    onChange={(e) => {
                      setMedicationName(e.target.value);
                      if (formErrors.medication) setFormErrors((f) => ({ ...f, medication: undefined }));
                    }}
                    placeholder="e.g., Augmentin, Calpol, Dolo 650, Azithral, Amoxicillin, Advil"
                    className="w-full pl-10 pr-9 py-2.5 text-sm text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder:text-slate-500"
                  />
                  {medicationName && (
                    <button
                      type="button"
                      onClick={() => setMedicationName('')}
                      aria-label="Clear medication name"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {formErrors.medication && (
                  <p role="alert" className="text-xs font-semibold text-rose-400">
                    {formErrors.medication}
                  </p>
                )}

              {/* Live Brand ↔ Generic Drug Recognition Card */}
              {recognizedDrug && (
                <div
                  data-testid="brand-generic-match"
                  className="p-3.5 rounded-xl bg-teal-950/50 border border-teal-500/40 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-teal-200">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-teal-400 shrink-0" aria-hidden="true" />
                      <span>
                        {recognizedDrug.matchedAs === 'brand'
                          ? `Brand Name Recognized: ${recognizedDrug.matchedTerm}`
                          : `Generic Drug Recognized: ${recognizedDrug.genericName}`}
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-teal-300">
                      {recognizedDrug.drugClass}
                    </span>
                  </div>
                  <p className="text-slate-200">
                    <span className="text-slate-400">Active Generic Ingredient: </span>
                    <strong className="text-white">{recognizedDrug.genericName}</strong>
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    <span className="text-slate-400">Common Brands: </span>
                    {recognizedDrug.brandNames.join(', ')}
                  </p>
                  {recognizedDrug.typicalLiquidMg && recognizedDrug.typicalLiquidPerMl && (
                    <button
                      type="button"
                      onClick={() => {
                        setSingleDosageForm('liquid');
                        setConcentrationMg(String(recognizedDrug.typicalLiquidMg));
                        setConcentrationPerMl(String(recognizedDrug.typicalLiquidPerMl));
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-violet-100 bg-violet-600/80 hover:bg-violet-500 rounded-md transition-colors"
                    >
                      <Droplets className="w-3 h-3" aria-hidden="true" />
                      Use typical liquid bottle ({recognizedDrug.typicalLiquidMg} mg /{' '}
                      {recognizedDrug.typicalLiquidPerMl} mL)
                    </button>
                  )}
                </div>
              )}

              {/* Colourful Category Filter Tabs + Brand/Generic Medication Picker */}
              <div className="pt-1 space-y-2.5">
                <div
                  role="tablist"
                  aria-label="Filter common medications by category"
                  className="flex flex-wrap gap-1.5 p-1.5 bg-slate-950/90 border border-slate-800 rounded-xl"
                >
                  {DRUG_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                        selectedCategory === cat.id
                          ? cat.activeBtn
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                      }`}
                    >
                      {cat.id}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {filteredCatalogMeds.map((med) => {
                    const isSelected =
                      medicationName.toLowerCase() === med.genericName.toLowerCase() ||
                      med.brandNames.some((b) => b.toLowerCase() === medicationName.toLowerCase());
                    return (
                      <button
                        key={med.genericName}
                        type="button"
                        onClick={() => {
                          setMedicationName(med.genericName);
                          setFormErrors((f) => ({ ...f, medication: undefined }));
                        }}
                        className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                          isSelected
                            ? activeCategoryTheme.cardActive
                            : `border-slate-800 bg-slate-950/60 text-slate-200 ${activeCategoryTheme.cardHover}`
                        }`}
                      >
                        <div className="truncate font-semibold">{med.genericName}</div>
                        <div className="truncate text-[11px] text-slate-400 mt-0.5">
                          {med.brandNames.slice(0, 3).join(', ')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            )}

            {/* Live Instant Allergy Pre-Warning */}
            {liveAllergyPreview && (
              <div
                role="alert"
                className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                  liveAllergyPreview.severity === 'critical'
                    ? 'bg-red-950/60 border-red-500/50 text-red-100'
                    : 'bg-amber-950/50 border-amber-500/50 text-amber-100'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" aria-hidden="true" />
                  <span>{liveAllergyPreview.headline}</span>
                </div>
                <p className="leading-relaxed opacity-90">{liveAllergyPreview.explanation}</p>
              </div>
            )}

            {/* Patient Sex (Male / Female) Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-baseline justify-between gap-2">
                <span className="block text-sm font-bold text-slate-100">Patient Sex</span>
                <span className="text-[11px] font-medium text-sky-400">
                  Required for sex-specific safety rules
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-2"
                role="group"
                aria-label="Patient sex"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSex('male');
                    if (formErrors.sex) setFormErrors((f) => ({ ...f, sex: undefined }));
                  }}
                  aria-pressed={sex === 'male'}
                  className={`py-2.5 px-4 text-sm font-bold rounded-xl border transition-all ${
                    sex === 'male'
                      ? 'bg-sky-600 border-sky-400 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-sky-500/60 hover:text-sky-200'
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSex('female');
                    if (formErrors.sex) setFormErrors((f) => ({ ...f, sex: undefined }));
                  }}
                  aria-pressed={sex === 'female'}
                  className={`py-2.5 px-4 text-sm font-bold rounded-xl border transition-all ${
                    sex === 'female'
                      ? 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-xs'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-fuchsia-500/60 hover:text-fuchsia-200'
                  }`}
                >
                  Female
                </button>
              </div>
              {formErrors.sex && (
                <p role="alert" className="text-xs font-semibold text-rose-400">
                  {formErrors.sex}
                </p>
              )}
            </div>

            {/* Age & Optional Weight Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="patient-age" className="block text-sm font-bold text-slate-100">
                  Patient Age
                </label>
                <div className="flex gap-1.5">
                  <input
                    id="patient-age"
                    type="number"
                    min={0}
                    max={120}
                    step="any"
                    value={ageInput}
                    onChange={(e) => {
                      setAgeInput(e.target.value);
                      if (formErrors.age) setFormErrors((f) => ({ ...f, age: undefined }));
                    }}
                    placeholder="e.g., 34"
                    className="min-w-0 flex-1 px-3 py-2.5 text-sm font-mono tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder:font-sans placeholder:text-slate-500"
                  />
                  <div className="flex p-0.5 bg-slate-950 border border-slate-700 rounded-lg shrink-0" role="group" aria-label="Age unit">
                    {(['years', 'months'] as AgeUnit[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setAgeUnit(u)}
                        aria-pressed={ageUnit === u}
                        className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          ageUnit === u ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {u === 'years' ? 'Yrs' : 'Mos'}
                      </button>
                    ))}
                  </div>
                </div>
                {formErrors.age && (
                  <p role="alert" className="text-xs font-semibold text-rose-400">
                    {formErrors.age}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor="patient-weight" className="block text-sm font-bold text-slate-100">
                    Weight
                  </label>
                  <span className="text-xs font-medium text-slate-400">Optional</span>
                </div>
                <div className="flex gap-1.5">
                  <input
                    id="patient-weight"
                    type="number"
                    min={0.5}
                    max={350}
                    step="any"
                    value={weightInput}
                    onChange={(e) => {
                      setWeightInput(e.target.value);
                      if (formErrors.weight) setFormErrors((f) => ({ ...f, weight: undefined }));
                    }}
                    placeholder="Optional"
                    className="min-w-0 flex-1 px-3 py-2.5 text-sm font-mono tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder:font-sans placeholder:text-slate-500"
                  />
                  <div className="flex p-0.5 bg-slate-950 border border-slate-700 rounded-lg shrink-0" role="group" aria-label="Weight unit">
                    {(['kg', 'lbs'] as WeightUnit[]).map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setWeightUnit(u)}
                        aria-pressed={weightUnit === u}
                        className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                          weightUnit === u ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                {formErrors.weight ? (
                  <p role="alert" className="text-xs font-semibold text-rose-400">
                    {formErrors.weight}
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Adds mg/kg precision for children and weight-sensitive antibiotics.
                  </p>
                )}
              </div>
            </div>

            {/* Dosage Form & Strength (Tablet, Capsule, or Liquid / Syrup) — Single Medicine Mode Only */}
            {entryMode === 'single' && (
              <div className="p-4 rounded-xl bg-violet-950/35 border border-violet-500/40 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-violet-100">
                    Dosage Form &amp; Strength
                  </span>
                  <span className="text-[11px] font-medium text-violet-300">
                    Tablet · Capsule · Liquid
                  </span>
                </div>

                {/* Form Selector: Tablet | Capsule | Liquid / Syrup */}
                <div
                  className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/90 border border-slate-800 rounded-xl"
                  role="group"
                  aria-label="Medication dosage form"
                >
                  {(
                    [
                      {
                        id: 'tablet' as const,
                        label: 'Tablet',
                        activeClass: 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-xs',
                      },
                      {
                        id: 'capsule' as const,
                        label: 'Capsule',
                        activeClass:
                          'bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white shadow-xs',
                      },
                      {
                        id: 'liquid' as const,
                        label: 'Liquid / Syrup',
                        activeClass:
                          'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs',
                      },
                    ]
                  ).map((formOpt) => {
                    const isActive = singleDosageForm === formOpt.id;
                    return (
                      <button
                        key={formOpt.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => {
                          setSingleDosageForm(formOpt.id);
                          if (formErrors.liquid) setFormErrors((f) => ({ ...f, liquid: undefined }));
                        }}
                        className={`inline-flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                          isActive
                            ? formOpt.activeClass
                            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                        }`}
                      >
                        {formOpt.id === 'liquid' ? (
                          <Droplets className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Pill className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        )}
                        <span>{formOpt.label}</span>
                      </button>
                    );
                  })}
                </div>

                {singleDosageForm === 'liquid' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="relative">
                        <input
                          id="dosage-conc-mg"
                          type="number"
                          min={0.1}
                          max={10000}
                          step="any"
                          aria-label="Liquid bottle strength in mg"
                          value={concentrationMg}
                          onChange={(e) => {
                            setConcentrationMg(e.target.value);
                            if (formErrors.liquid) setFormErrors((f) => ({ ...f, liquid: undefined }));
                          }}
                          placeholder="e.g., 250"
                          className="w-full pr-10 pl-3 py-2 text-xs font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-violet-500/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:font-sans placeholder:text-slate-500"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-violet-300">
                          mg
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <div className="relative flex-1 min-w-0">
                          <input
                            id="dosage-conc-ml"
                            type="number"
                            min={0.1}
                            max={500}
                            step="any"
                            aria-label="Per liquid volume in mL"
                            value={concentrationPerMl}
                            onChange={(e) => {
                              setConcentrationPerMl(e.target.value);
                              if (formErrors.liquid) setFormErrors((f) => ({ ...f, liquid: undefined }));
                            }}
                            placeholder="5"
                            className="w-full pr-9 pl-2.5 py-2 text-xs font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-violet-500/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-violet-300">
                            mL
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setConcentrationPerMl(concentrationPerMl === '5' ? '10' : '5')}
                          className="px-2 py-1.5 text-[11px] font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg whitespace-nowrap shrink-0"
                          title="Toggle between per 5 mL and per 10 mL"
                        >
                          {concentrationPerMl === '5' ? '/ 10 mL' : '/ 5 mL'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {LIQUID_STRENGTH_PRESETS.slice(0, 5).map((p) => {
                        const selected =
                          concentrationMg === String(p.mg) && concentrationPerMl === String(p.perMl);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setConcentrationMg(String(p.mg));
                              setConcentrationPerMl(String(p.perMl));
                              setFormErrors((f) => ({ ...f, liquid: undefined }));
                            }}
                            className={`px-2 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors ${
                              selected
                                ? 'bg-violet-600 text-white'
                                : 'bg-slate-950/80 text-violet-200 border border-violet-500/30 hover:bg-violet-900/50'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                      {concentrationMg && (
                        <button
                          type="button"
                          onClick={() => setConcentrationMg('')}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-100"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <label
                        htmlFor="dosage-unit-mg"
                        className="text-[11px] font-semibold text-slate-200"
                      >
                        Strength per {singleDosageForm === 'capsule' ? 'Capsule' : 'Tablet'} (Optional)
                      </label>
                      <span className="text-[11px] text-slate-400">
                        For exact {singleDosageForm} count
                      </span>
                    </div>

                    <div className="relative">
                      <input
                        id="dosage-unit-mg"
                        type="number"
                        min={0.1}
                        max={10000}
                        step="any"
                        value={unitStrengthMg}
                        onChange={(e) => {
                          setUnitStrengthMg(e.target.value);
                          if (formErrors.liquid) setFormErrors((f) => ({ ...f, liquid: undefined }));
                        }}
                        placeholder={
                          singleDosageForm === 'capsule'
                            ? 'e.g., 250 or 500 mg per capsule'
                            : 'e.g., 500 or 650 mg per tablet'
                        }
                        className="w-full pr-24 pl-3 py-2 text-xs font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-violet-500/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:font-sans placeholder:text-slate-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-teal-300">
                        mg / {singleDosageForm === 'capsule' ? 'cap' : 'tab'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {(singleDosageForm === 'capsule'
                        ? [100, 200, 250, 500]
                        : [250, 500, 650, 1000]
                      ).map((mgVal) => {
                        const selected = unitStrengthMg === String(mgVal);
                        return (
                          <button
                            key={mgVal}
                            type="button"
                            onClick={() => {
                              setUnitStrengthMg(String(mgVal));
                              setFormErrors((f) => ({ ...f, liquid: undefined }));
                            }}
                            className={`px-2.5 py-1 text-[11px] font-mono font-semibold rounded-md transition-colors ${
                              selected
                                ? singleDosageForm === 'capsule'
                                  ? 'bg-fuchsia-600 text-white'
                                  : 'bg-teal-600 text-white'
                                : 'bg-slate-950/80 text-slate-200 border border-slate-700 hover:border-teal-400/60 hover:text-white'
                            }`}
                          >
                            {mgVal} mg
                          </button>
                        );
                      })}
                      {unitStrengthMg && (
                        <button
                          type="button"
                          onClick={() => setUnitStrengthMg('')}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-400 hover:text-slate-100"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {formErrors.liquid && (
                  <p role="alert" className="text-xs font-semibold text-rose-400">
                    {formErrors.liquid}
                  </p>
                )}
              </div>
            )}

            {/* Optional Reason / Condition */}
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor="indication-input" className="block text-sm font-bold text-slate-100">
                  Condition or Reason
                </label>
                <span className="text-xs text-slate-400">Optional</span>
              </div>
              <input
                id="indication-input"
                type="text"
                value={indication}
                onChange={(e) => setIndication(e.target.value)}
                placeholder="e.g., Ear infection, strep throat, fever, urinary infection"
                className="w-full px-3.5 py-2.5 text-sm text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 placeholder:text-slate-500"
              />
            </div>

            {/* Known Allergies Section */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-100">Known Drug Allergies</span>
                <span className="text-xs font-semibold text-rose-400 tabular-nums">
                  {allergies.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Select common drug allergies">
                {COMMON_ALLERGENS.map((allergen) => {
                  const active = allergies.some((a) => a.toLowerCase() === allergen.toLowerCase());
                  return (
                    <button
                      key={allergen}
                      type="button"
                      onClick={() => toggleAllergen(allergen)}
                      aria-pressed={active}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? 'bg-rose-600 border-rose-500 text-white shadow-xs'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-rose-500/50 hover:text-rose-200'
                      }`}
                    >
                      {allergen}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customAllergy}
                  onChange={(e) => setCustomAllergy(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomAllergy();
                    }
                  }}
                  aria-label="Add another drug allergy"
                  placeholder="Add another allergy (e.g., Latex, Erythromycin)"
                  className="flex-1 px-3 py-2 text-xs text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleAddCustomAllergy}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add
                </button>
              </div>

              {allergies.some(
                (a) => !COMMON_ALLERGENS.some((ca) => ca.toLowerCase() === a.toLowerCase())
              ) && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {allergies
                    .filter((a) => !COMMON_ALLERGENS.some((ca) => ca.toLowerCase() === a.toLowerCase()))
                    .map((custom) => (
                      <button
                        key={custom}
                        type="button"
                        onClick={() => toggleAllergen(custom)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 text-white"
                        aria-label={`Remove allergy ${custom}`}
                      >
                        <span>{custom}</span>
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    ))}
                </div>
              )}
            </div>

            {profile.currentMedications.length > 0 && (
              <div className="pt-2 border-t border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-indigo-300">Automatic interaction screen:</span>{' '}
                Checking against your {profile.currentMedications.length} active profile medication(s) (
                {profile.currentMedications.join(', ')}).
              </div>
            )}

            {/* Vibrant Primary Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-5 text-sm font-bold text-white bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600 hover:from-teal-400 hover:via-cyan-500 hover:to-blue-500 rounded-xl shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-60"
            >
              {loading
                ? 'Verifying Live FDA/NIH & Clinical Guidelines...'
                : entryMode === 'multi'
                  ? `Calculate Combined Dosage (${compositions.filter((c) => c.name.trim()).length || compositions.length} Compositions)`
                  : 'Calculate Live-Verified Dosage (mg & mL)'}
            </button>
          </form>
        </section>

        {/* Right Column: Editorial Welcome / Loading / Full Verified Clinical Report */}
        <section aria-label="Dosage analysis results" className="lg:col-span-7 space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="bg-red-950/60 border border-red-500/40 rounded-2xl p-5 flex items-start gap-3 text-red-100"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="text-sm font-bold">Unable to complete clinical lookup</h2>
                <p className="text-sm text-red-200">{errorMsg}</p>
              </div>
            </div>
          )}

          {loading && (
            <div
              aria-busy="true"
              aria-label="Calculating verified dosage"
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6 animate-pulse"
            >
              <div className="space-y-2">
                <div className="h-4 w-40 bg-teal-900/60 rounded" />
                <div className="h-7 w-72 bg-slate-800 rounded" />
              </div>
              <div className="h-20 w-full bg-violet-950/50 rounded-xl" />
              <div className="grid grid-cols-2 gap-4">
                <div className="h-24 bg-slate-800/80 rounded-xl" />
                <div className="h-24 bg-slate-800/80 rounded-xl" />
                <div className="h-24 bg-slate-800/80 rounded-xl" />
                <div className="h-24 bg-slate-800/80 rounded-xl" />
              </div>
              <div className="h-32 bg-slate-800/80 rounded-xl" />
            </div>
          )}

          {!loading && !result && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              {!heroImgFailed ? (
                <div className="relative aspect-[16/8] w-full bg-slate-950 overflow-hidden border-b border-slate-800">
                  <img
                    src={HERO_IMAGE_PATH}
                    alt="Home medication care setup with clear water glass and frosted glass bottle"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent"
                  />
                </div>
              ) : (
                <div className="aspect-[16/8] w-full bg-gradient-to-br from-teal-950 via-slate-900 to-violet-950 border-b border-slate-800 flex items-center justify-center">
                  <ShieldCheck className="w-12 h-12 text-teal-400/70" aria-hidden="true" />
                </div>
              )}

              <div className="p-6 sm:p-8 space-y-6">
                <div className="space-y-2">
                  <h2 className="text-2xl font-extrabold text-slate-50">
                    Live internet-verified dosing — by brand or generic name
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Enter any brand-name prescription or generic drug on the left (e.g., Augmentin,
                    Calpol, Dolo 650, Azithral, Zolpidem, or Amoxicillin), select patient sex (Male
                    or Female), age, and optional weight or bottle strength to cross-check live U.S.
                    FDA labels, NIH RxNorm, and current clinical guidelines.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 pt-4 border-t border-slate-800">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-teal-400">Live FDA &amp; Web Evidence</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Queries live U.S. FDA OpenFDA drug labels, NIH RxNorm, and real-time medical
                      search grounding for every calculation.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-violet-400">Sex, Age, Weight &amp; mL</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Applies Male &amp; Female clinical dosing rules, age-band protections,
                      optional mg/kg checks, and exact syrup mL volumes.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-rose-400">Allergy &amp; Rabies Care</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Screens Penicillin, Sulfa, and NSAID cross-reactivity—plus a WHO/CDC rabies
                      vaccination date planner at the bottom.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!loading && result && lastQueryMeta && (
            <article className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-7">
              {/* Report Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {result.isCombinedComposition && (
                      <>
                        <span className="font-bold text-fuchsia-300">
                          Combined Result ({result.combinedCompositionsCount || result.compositionBreakdown?.length || 2} Compositions)
                        </span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span className="font-bold text-teal-400">
                      {result.isAntibiotic ? 'Antibiotic' : result.drugCategory}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-fuchsia-300">
                      Sex: {lastQueryMeta.sexDisplay}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{result.ageGroupLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      Age {lastQueryMeta.ageDisplay}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-slate-300">
                      Weight {lastQueryMeta.weightDisplay}
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-50 tracking-tight">
                    {result.medicationName}
                  </h2>

                  {/* Brand ↔ Generic Recognition Summary */}
                  <div className="text-xs text-slate-300 space-y-1 pt-0.5">
                    <p>
                      <span className="text-slate-400">Generic Active Ingredient: </span>
                      <span className="font-bold text-teal-300">{result.genericName}</span>
                      {result.recognizedBrandName && (
                        <>
                          <span aria-hidden="true" className="mx-1.5 text-slate-600">
                            ·
                          </span>
                          <span className="text-slate-400">Matched Brand: </span>
                          <span className="font-semibold text-sky-300">
                            {result.recognizedBrandName}
                          </span>
                        </>
                      )}
                    </p>
                    {result.commonBrandNames && result.commonBrandNames.length > 0 && (
                      <p className="text-slate-400">
                        <span className="font-semibold text-slate-300">Common Brands: </span>
                        {result.commonBrandNames.join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Colourful Action Bar */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleSaveResult()}
                    disabled={savingRecord || savedNotice}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      savedNotice
                        ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/50'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {savedNotice ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Saved to Records
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        {savingRecord ? 'Saving...' : 'Save Record'}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSummary}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Download Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrintDosage(result, lastQueryMeta)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                    Print / PDF
                  </button>
                </div>
              </div>

              {/* Prominent Allergy Screening Alert Banner */}
              <div
                role={result.allergyAlert.severity === 'clear' ? 'status' : 'alert'}
                className={`rounded-xl border p-4 space-y-2 ${
                  result.allergyAlert.severity === 'critical'
                    ? 'bg-red-950/60 border-red-500/50 text-red-100'
                    : result.allergyAlert.severity === 'caution'
                      ? 'bg-amber-950/50 border-amber-500/50 text-amber-100'
                      : 'bg-emerald-950/45 border-emerald-500/40 text-emerald-100'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {result.allergyAlert.severity === 'critical' ? (
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
                  ) : result.allergyAlert.severity === 'caution' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                  )}
                  <h3 className="text-sm font-bold">{result.allergyAlert.headline}</h3>
                </div>
                <p className="text-sm leading-relaxed opacity-90">{result.allergyAlert.explanation}</p>
                <p className="text-xs font-bold pt-0.5">{result.allergyAlert.recommendedAction}</p>
              </div>

              {/* Core Tabular Dosing Grid including Liquid Volume (mL) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-100">Dosage Guidance (mg &amp; mL)</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      Basis:{' '}
                      {result.dosingBasis === 'weight-based'
                        ? 'Weight-based (mg/kg)'
                        : result.dosingBasis === 'contraindicated'
                          ? 'Safety Hold / Contraindicated'
                          : 'Standard age-stratified'}
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenMlWithResult}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Droplets className="w-3 h-3" aria-hidden="true" />
                      Adjust mL Bottle
                    </button>
                  </div>
                </div>

                {/* Highlighted Liquid mL Callout */}
                <div
                  className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    result.dosingBasis === 'contraindicated'
                      ? 'bg-red-950/50 border-red-500/40'
                      : 'bg-gradient-to-r from-violet-950/75 via-indigo-950/70 to-sky-950/60 border-violet-500/45'
                  }`}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-violet-300">
                      Liquid / Syrup Volume (mL)
                    </p>
                    <p
                      className={`text-lg font-extrabold leading-snug ${
                        result.dosingBasis === 'contraindicated'
                          ? 'text-red-300'
                          : 'font-mono tabular-nums text-white'
                      }`}
                    >
                      {result.recommendedDoseMl}
                    </p>
                    {result.liquidCalculationDetail && (
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {result.liquidCalculationDetail}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="bg-slate-950/85 p-4 space-y-1">
                    <p className="text-xs font-semibold text-teal-400">Recommended Dose (mg)</p>
                    <p
                      className={`text-base font-bold leading-snug ${
                        result.dosingBasis === 'contraindicated'
                          ? 'text-red-400'
                          : result.recommendedDose.length <= 60
                            ? 'font-mono tabular-nums text-slate-50'
                            : 'text-slate-50'
                      }`}
                    >
                      {result.recommendedDose}
                    </p>
                  </div>
                  <div className="bg-slate-950/85 p-4 space-y-1">
                    <p className="text-xs font-semibold text-sky-400">Schedule / Frequency</p>
                    <p className="text-base font-bold font-mono tabular-nums text-slate-50 leading-snug">
                      {result.frequency}
                    </p>
                  </div>
                  <div className="bg-slate-950/85 p-4 space-y-1">
                    <p className="text-xs font-semibold text-amber-400">Maximum Daily Limit</p>
                    <p className="text-base font-bold font-mono tabular-nums text-slate-50 leading-snug">
                      {result.maxDailyLimit}
                    </p>
                  </div>
                  <div className="bg-slate-950/85 p-4 space-y-1">
                    <p className="text-xs font-semibold text-violet-400">Typical Course Duration</p>
                    <p className="text-base font-bold font-mono tabular-nums text-slate-50 leading-snug">
                      {result.typicalDuration}
                    </p>
                  </div>
                </div>

                {result.weightCalculationDetail && (
                  <p className="text-xs text-sky-100 bg-sky-950/45 border border-sky-500/35 rounded-xl px-4 py-3 leading-relaxed">
                    <span className="font-bold text-sky-300">Calculation detail: </span>
                    {result.weightCalculationDetail}
                  </p>
                )}

                {result.sexSpecificGuidance && (
                  <div className="text-xs text-fuchsia-100 bg-fuchsia-950/40 border border-fuchsia-500/40 rounded-xl px-4 py-3 leading-relaxed">
                    <span className="font-bold text-fuchsia-300">
                      Sex-Specific Clinical Guidance ({lastQueryMeta.sexDisplay}):{' '}
                    </span>
                    {result.sexSpecificGuidance}
                  </div>
                )}

                {/* Combined Multi-Composition Synergy & Per-Composition Breakdown */}
                {result.isCombinedComposition && (
                  <div className="space-y-4 pt-3 border-t border-slate-800">
                    {(result.combinedSynergyAndOverlapSummary || result.combinedContainerSummary) && (
                      <div className="p-4 rounded-xl bg-violet-950/45 border border-violet-500/40 text-xs text-violet-100 space-y-2 leading-relaxed">
                        <div className="flex items-center gap-1.5 font-bold text-violet-300">
                          <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            Combined Multi-Composition Overview (
                            {result.combinedCompositionsCount || result.compositionBreakdown?.length || 2}{' '}
                            Ingredients)
                          </span>
                        </div>
                        {result.combinedContainerSummary && (
                          <div className="px-3 py-2 rounded-lg bg-slate-950/75 border border-fuchsia-500/35 text-fuchsia-100 font-medium">
                            <span className="text-amber-300 font-bold">Formulation Contains: </span>
                            {result.combinedContainerSummary}
                          </div>
                        )}
                        {result.combinedSynergyAndOverlapSummary && (
                          <p>{result.combinedSynergyAndOverlapSummary}</p>
                        )}
                      </div>
                    )}

                    {result.compositionBreakdown && result.compositionBreakdown.length > 0 && (
                      <div className="space-y-2.5">
                        <h3 className="text-sm font-bold text-slate-100">
                          Per-Composition Combined Breakdown
                        </h3>
                        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                          {result.compositionBreakdown.map((item, idx) => (
                            <div
                              key={`${item.compositionName}-${idx}`}
                              className="p-4 bg-slate-950/75 space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <span className="text-sm font-bold text-slate-50">
                                    {idx + 1}. {item.compositionName}
                                  </span>
                                  {item.genericName &&
                                    item.genericName.toLowerCase() !==
                                      item.compositionName.toLowerCase() && (
                                      <span className="ml-2 text-xs text-teal-300">
                                        ({item.genericName})
                                      </span>
                                    )}
                                  <span className="block text-[11px] text-slate-400">
                                    {item.role}
                                  </span>
                                </div>
                                <span
                                  className={`text-[11px] font-bold uppercase tracking-wide ${
                                    item.safetyStatus === 'avoid'
                                      ? 'text-red-400'
                                      : item.safetyStatus === 'caution'
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                  }`}
                                >
                                  {item.safetyStatus === 'avoid'
                                    ? 'Avoid / Hold'
                                    : item.safetyStatus === 'caution'
                                      ? 'Caution'
                                      : 'Safe'}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                                  <span className="text-[11px] text-slate-400 block">
                                    Per-Dose Amount
                                  </span>
                                  <span className="font-mono font-semibold text-slate-100">
                                    {item.perDoseAmount}
                                  </span>
                                </div>
                                <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
                                  <span className="text-[11px] text-slate-400 block">
                                    Max Daily Ceiling
                                  </span>
                                  <span className="font-mono font-semibold text-amber-300">
                                    {item.maxDailyLimit}
                                  </span>
                                </div>
                              </div>
                              {item.note && (
                                <p className="text-xs text-slate-300 leading-relaxed">
                                  {item.note}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Automated Verification Protocol Table */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-100">
                    Automated Verification Protocol
                  </h3>
                  <span
                    className={`text-xs font-bold ${
                      result.verificationStatus === 'contraindicated'
                        ? 'text-red-400'
                        : result.verificationStatus === 'caution'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {result.verificationStatus === 'contraindicated'
                      ? 'Safety Alert — Clinician Review Required'
                      : result.verificationStatus === 'caution'
                        ? 'Passed With Cautions'
                        : 'All Automated Checks Passed'}
                  </span>
                </div>

                <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                  {result.verificationChecks.map((check) => (
                    <li
                      key={check.id}
                      className="px-4 py-3 bg-slate-950/70 flex items-start gap-3 text-sm"
                    >
                      {check.status === 'pass' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      {check.status === 'warning' && (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      {check.status === 'alert' && (
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      {check.status === 'info' && (
                        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-100 text-xs">{check.label}</span>
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wide ${
                              check.status === 'alert'
                                ? 'text-red-400'
                                : check.status === 'warning'
                                  ? 'text-amber-400'
                                  : check.status === 'pass'
                                    ? 'text-emerald-400'
                                    : 'text-sky-400'
                            }`}
                          >
                            {check.status === 'alert'
                              ? 'Alert'
                              : check.status === 'warning'
                                ? 'Caution'
                                : check.status === 'pass'
                                  ? 'Verified'
                                  : 'Note'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{check.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Active Profile Medication Interaction Results (if any) */}
              {result.activeMedicationInteractions.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-100">
                      Interactions With Your Active Medications
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateInteractions([
                          result.medicationName,
                          ...result.activeMedicationInteractions.map((i) => i.medication),
                        ])
                      }
                      className="text-xs font-bold text-rose-400 hover:underline whitespace-nowrap"
                    >
                      Open full interaction check
                    </button>
                  </div>
                  <div className="space-y-2">
                    {result.activeMedicationInteractions.map((item) => (
                      <div
                        key={item.medication}
                        className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                          item.severity === 'major'
                            ? 'bg-red-950/60 border-red-500/40 text-red-100'
                            : item.severity === 'moderate'
                              ? 'bg-amber-950/50 border-amber-500/40 text-amber-100'
                              : 'bg-slate-950/80 border-slate-700 text-slate-200'
                        }`}
                      >
                        <div className="font-bold">
                          {result.medicationName} + {item.medication} · Severity:{' '}
                          {item.severity.toUpperCase()}
                        </div>
                        <p className="leading-relaxed opacity-90">{item.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How to Take + Antibiotic Stewardship + Watch-Out Symptoms */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-800">
                <div className="space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-100">How to Take Safely</h3>
                  <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                    {result.administrationTips.map((tip, idx) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                  {result.antibioticCourseNote && (
                    <div className="mt-3 p-3.5 rounded-xl bg-teal-950/50 border border-teal-500/40 text-xs text-teal-100 leading-relaxed">
                      <span className="font-bold text-teal-300">Antibiotic course guidance: </span>
                      {result.antibioticCourseNote}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-100">
                    When to Contact a Doctor Immediately
                  </h3>
                  <ul className="space-y-2 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                    {result.watchOutSymptoms.map((symptom, idx) => (
                      <li key={idx}>{symptom}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Live Internet-Verified Sources & Clinical References */}
              <div className="pt-4 border-t border-slate-800 space-y-3 text-xs text-slate-400">
                {result.verifiedSources && result.verifiedSources.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-teal-300">
                        <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Live Internet-Verified Clinical Sources</span>
                      </div>
                      {result.liveEvidenceUsed && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-300">
                          {result.liveEvidenceUsed.fdaLabelFound && (
                            <span className="text-emerald-300">U.S. FDA OpenFDA</span>
                          )}
                          {result.liveEvidenceUsed.rxNormMatched && (
                            <span className="text-sky-300">NIH RxNorm</span>
                          )}
                          {result.liveEvidenceUsed.googleSearchUsed && (
                            <span className="text-violet-300">Live Web Grounding</span>
                          )}
                        </div>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {result.verifiedSources.map((src, idx) => (
                        <li key={`${src.url}-${idx}`} className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide shrink-0 ${
                              src.sourceType === 'fda'
                                ? 'text-emerald-400'
                                : src.sourceType === 'nih'
                                  ? 'text-sky-400'
                                  : 'text-violet-400'
                            }`}
                          >
                            {src.sourceType === 'fda'
                              ? 'FDA Label'
                              : src.sourceType === 'nih'
                                ? 'NIH RxNorm'
                                : 'Web Source'}
                          </span>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-200 hover:text-teal-300 underline decoration-slate-600 underline-offset-2 truncate"
                          >
                            <span className="truncate">{src.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 opacity-75" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p>
                  <span className="font-semibold text-slate-200">Clinical reference standards: </span>
                  {result.clinicalReferences.join(' · ')}
                </p>
                <p className="leading-relaxed">{result.patientDisclaimer}</p>
              </div>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
