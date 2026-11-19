import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BookmarkCheck,
  BookmarkPlus,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Plus,
  ShieldAlert,
  X,
} from 'lucide-react';
import type {
  ExtractedMedicineImageResult,
  InteractionAnalysisResult,
  InteractionSeverity,
} from '../types/clinical';
import {
  EXAMPLE_INTERACTION_SETS,
  evaluateDeterministicInteractions,
} from '../utils/clinicalSafety';
import { resolveDrugIdentity } from '../utils/drugCatalog';
import { formatInteractionSummaryText, triggerFileDownload } from '../utils/recordExport';
import { usePatient } from '../contexts/PatientContext';
import { MedicineImageScanner } from './MedicineImageScanner';

interface InteractionCheckerProps {
  prefillDrugs?: string[];
}

function severityLabel(severity: InteractionSeverity): string {
  switch (severity) {
    case 'major':
      return 'Major Interaction — Avoid or Consult Doctor First';
    case 'moderate':
      return 'Moderate Interaction — Monitoring or Adjustment Needed';
    case 'minor':
      return 'Minor Interaction — Low Risk';
    default:
      return 'No Clinically Significant Interactions Found';
  }
}

function severityStyles(severity: InteractionSeverity): string {
  switch (severity) {
    case 'major':
      return 'bg-red-950/60 border-red-500/50 text-red-100';
    case 'moderate':
      return 'bg-amber-950/50 border-amber-500/50 text-amber-100';
    case 'minor':
      return 'bg-slate-800/80 border-slate-700 text-slate-100';
    default:
      return 'bg-emerald-950/45 border-emerald-500/40 text-emerald-100';
  }
}

export function InteractionChecker({ prefillDrugs }: InteractionCheckerProps) {
  const { profile, saveInteractionCheck } = usePatient();
  const [medications, setMedications] = useState<string[]>(() =>
    prefillDrugs && prefillDrugs.length >= 2 ? prefillDrugs : ['Warfarin', 'Augmentin']
  );
  const [drugInput, setDrugInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<InteractionAnalysisResult | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prefillDrugs && prefillDrugs.length >= 2) {
      setMedications(prefillDrugs);
      setResult(null);
      setSaved(false);
    }
  }, [prefillDrugs]);

  const inputIdentity = useMemo(() => resolveDrugIdentity(drugInput), [drugInput]);

  const instantWarnings = useMemo(
    () => evaluateDeterministicInteractions(medications),
    [medications]
  );

  const handleAddMedication = () => {
    const clean = drugInput.trim();
    if (!clean) return;
    if (medications.length >= 15) {
      setErrorMsg('You can screen up to 15 medications at one time.');
      return;
    }
    if (!medications.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      setMedications((prev) => [...prev, clean.slice(0, 120)]);
      setErrorMsg(null);
    }
    setDrugInput('');
  };

  const handleRemoveMedication = (target: string) => {
    setMedications((prev) => prev.filter((m) => m !== target));
  };

  const handleImportProfileMeds = () => {
    if (profile.currentMedications.length === 0) return;
    const merged = Array.from(new Set([...medications, ...profile.currentMedications])).slice(0, 15);
    setMedications(merged);
  };

  const handleImageExtractedForInteractions = (extracted: ExtractedMedicineImageResult) => {
    const incomingNames =
      extracted.compositions.length > 0
        ? extracted.compositions.map((c) => c.name.trim()).filter(Boolean)
        : extracted.brandName.trim()
          ? [extracted.brandName.trim()]
          : [];
    if (incomingNames.length === 0) return;

    setMedications((prev) => {
      const next = [...prev];
      const existingLower = new Set(next.map((m) => m.toLowerCase()));
      for (const name of incomingNames) {
        if (next.length >= 15) break;
        if (!existingLower.has(name.toLowerCase())) {
          existingLower.add(name.toLowerCase());
          next.push(name.slice(0, 120));
        }
      }
      return next;
    });
    setErrorMsg(null);
  };

  const handleCheckInteractions = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaved(false);

    if (medications.length < 2) {
      setErrorMsg('Add at least 2 medications to run a drug-to-drug interaction check.');
      return;
    }

    setLoading(true);
    try {
      const ageDisplay =
        profile.ageValue !== null && profile.ageValue !== undefined
          ? `${profile.ageValue} ${profile.ageUnit}`
          : '';

      const response = await fetch('/api/clinical/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medications,
          ageDisplay,
          sex: profile.sex || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Could not complete interaction screening.');
      }
      setResult(payload as InteractionAnalysisResult);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to reach the interaction screening service. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await saveInteractionCheck(result);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const text = formatInteractionSummaryText(result);
    triggerFileDownload('kyc-drug-interactions-report.txt', text, 'text/plain;charset=utf-8');
  };

  return (
    <div className="space-y-8">
      <div className="max-w-2xl space-y-2 pb-6 border-b border-slate-800">
        <p className="text-xs font-semibold text-rose-400">
          Know Your Consumption(KYC) · Live Internet-Verified Drug Interactions
        </p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50 text-balance">
          Check how your medications interact together
        </h1>
        <p className="text-[15px] text-slate-300 leading-relaxed">
          Enter two or more brand-name or generic antibiotics, daily prescriptions, OTC medicines,
          or mineral supplements to identify harmful combinations, duplicate ingredients, and
          symptoms to watch for.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Medication List Builder */}
        <section
          aria-label="Medication list for interaction check"
          className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6"
        >
          <form onSubmit={handleCheckInteractions} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="interaction-drug-input" className="block text-sm font-bold text-slate-100">
                Add a Brand or Generic Medication
              </label>
              <div className="flex gap-2">
                <input
                  id="interaction-drug-input"
                  type="text"
                  value={drugInput}
                  onChange={(e) => setDrugInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMedication();
                    }
                  }}
                  placeholder="e.g., Advil, Coumadin, Augmentin, Lipitor, Metformin"
                  className="flex-1 px-3.5 py-2.5 text-sm text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Add
                </button>
              </div>
              {inputIdentity && (
                <p className="text-xs text-teal-300 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    {inputIdentity.matchedAs === 'brand'
                      ? `Brand "${inputIdentity.matchedTerm}" → Generic: ${inputIdentity.genericName}`
                      : `Generic: ${inputIdentity.genericName} (Brands: ${inputIdentity.brandNames.slice(0, 3).join(', ')})`}
                  </span>
                </p>
              )}
            </div>

            {/* Camera Capture & Image Upload Scanner for Multi-Medicine Interactions */}
            <MedicineImageScanner
              mode="interactions"
              onExtracted={handleImageExtractedForInteractions}
            />

            {/* Active List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Medications to Screen ({medications.length})
                </span>
                {medications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMedications([]);
                      setResult(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-100"
                  >
                    Clear list
                  </button>
                )}
              </div>

              {medications.length === 0 ? (
                <p className="text-xs text-slate-400 bg-slate-950/60 border border-dashed border-slate-700 rounded-lg p-4 text-center">
                  Add at least 2 medications above or choose a common example below.
                </p>
              ) : (
                <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                  {medications.map((med) => {
                    const resolved = resolveDrugIdentity(med);
                    return (
                      <li
                        key={med}
                        className="px-3.5 py-2.5 bg-slate-950/80 flex items-center justify-between gap-2 text-sm text-slate-100"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold block truncate">{med}</span>
                          {resolved && resolved.matchedAs === 'brand' && (
                            <span className="text-[11px] text-teal-400 block truncate">
                              Generic: {resolved.genericName}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(med)}
                          aria-label={`Remove ${med}`}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {profile.currentMedications.length > 0 && (
              <button
                type="button"
                onClick={handleImportProfileMeds}
                className="w-full py-2 px-3 text-xs font-semibold text-teal-200 bg-teal-950/60 hover:bg-teal-900/60 border border-teal-500/40 rounded-lg transition-colors"
              >
                Import My {profile.currentMedications.length} Active Profile Medications
              </button>
            )}

            {/* Instant Deterministic Pre-Screen Preview */}
            {instantWarnings.length > 0 && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-amber-500/45 bg-amber-950/50 text-amber-100 text-xs space-y-1.5"
              >
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>
                    Instant safety flag: {instantWarnings.length} known interaction(s) detected
                  </span>
                </div>
                {instantWarnings.map((w) => (
                  <p key={w.pair.join('-')} className="leading-relaxed">
                    <span className="font-semibold text-amber-200">
                      {w.pair[0]} + {w.pair[1]} ({w.severity.toUpperCase()}):
                    </span>{' '}
                    {w.summary}
                  </p>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || medications.length < 2}
              className="w-full py-3.5 px-5 text-sm font-bold text-white bg-gradient-to-r from-orange-500 via-rose-600 to-pink-600 hover:from-orange-400 hover:via-rose-500 hover:to-pink-500 rounded-xl shadow-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-50"
            >
              {loading
                ? 'Verifying Live FDA Labels & Drug Interactions...'
                : 'Check Live-Verified Drug Interactions'}
            </button>
          </form>

          {/* Common Patient Example Combinations */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <p className="text-xs font-bold text-slate-300">Common Patient Combinations</p>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLE_INTERACTION_SETS.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    setMedications(ex.drugs);
                    setErrorMsg(null);
                    setResult(null);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-200 bg-rose-950/60 hover:bg-rose-900/70 border border-rose-500/40 rounded-lg transition-colors"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Right: Interaction Results */}
        <section aria-label="Interaction analysis results" className="lg:col-span-7 space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="bg-red-950/60 border border-red-500/40 rounded-xl p-5 flex items-start gap-3 text-red-100"
            >
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">Interaction check notice</h2>
                <p className="text-sm text-red-200">{errorMsg}</p>
              </div>
            </div>
          )}

          {loading && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5 animate-pulse">
              <div className="h-6 w-56 bg-slate-800 rounded" />
              <div className="h-20 bg-slate-800/80 rounded-lg" />
              <div className="h-32 bg-slate-800/80 rounded-lg" />
              <div className="h-32 bg-slate-800/80 rounded-lg" />
            </div>
          )}

          {!loading && !result && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 space-y-5">
              <h2 className="text-lg font-bold text-slate-50">
                Why screening drug reactions protects you
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Antibiotics frequently interact with blood thinners, cholesterol statins, blood
                pressure medicines, and everyday mineral supplements like calcium or iron. Enter
                either brand names (like Advil, Coumadin, Augmentin) or generic names to see a
                plain-language breakdown of every pair.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800 text-xs">
                <div className="space-y-1">
                  <p className="font-bold text-rose-400">Major</p>
                  <p className="text-slate-300 leading-relaxed">
                    High risk of serious harm; avoid combining unless closely managed by your doctor.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-amber-400">Moderate</p>
                  <p className="text-slate-300 leading-relaxed">
                    May require dose spacing, lab monitoring, or choosing a safer alternative.
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-emerald-400">Minor / Clear</p>
                  <p className="text-slate-300 leading-relaxed">
                    Minimal clinical impact; follow standard prescription label instructions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!loading && result && (
            <article className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-800">
                <div className="space-y-1.5">
                  <p className="text-xs text-slate-400">
                    Screened {result.medications.length} Medications ·{' '}
                    {new Date(result.generatedAt).toLocaleDateString()}
                  </p>
                  <h2 className="text-xl font-bold text-slate-50">
                    {result.medications.join(' + ')}
                  </h2>
                  {result.resolvedMedications && result.resolvedMedications.length > 0 && (
                    <p className="text-xs text-slate-400">
                      <span className="text-slate-300 font-semibold">Resolved active generics: </span>
                      {result.resolvedMedications
                        .map((m) => `${m.inputName} (${m.genericName})`)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || saved}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      saved
                        ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {saved ? (
                      <>
                        <BookmarkCheck className="w-3.5 h-3.5" aria-hidden="true" />
                        Saved
                      </>
                    ) : (
                      <>
                        <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        {saving ? 'Saving...' : 'Save Report'}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    Download Report
                  </button>
                </div>
              </div>

              {/* Overall Severity Banner */}
              <div
                role={result.overallSeverity === 'none' ? 'status' : 'alert'}
                className={`rounded-xl border p-4 space-y-1.5 ${severityStyles(result.overallSeverity)}`}
              >
                <div className="flex items-center gap-2.5">
                  {result.overallSeverity === 'major' ? (
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
                  ) : result.overallSeverity === 'moderate' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                  )}
                  <h3 className="text-sm font-bold">{severityLabel(result.overallSeverity)}</h3>
                </div>
                <p className="text-sm leading-relaxed opacity-90">{result.executiveSummary}</p>
              </div>

              {/* Pair-by-Pair Breakdown */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-100">Pair-by-Pair Details</h3>
                {result.pairs.length === 0 ? (
                  <p className="text-sm text-slate-300">
                    No significant pairwise interactions were identified among these medications.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                    {result.pairs.map((pair, idx) => (
                      <div key={`${pair.drugA}-${pair.drugB}-${idx}`} className="p-4 sm:p-5 bg-slate-950/75 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-sm font-bold text-slate-100">
                            {pair.drugA} + {pair.drugB}
                          </h4>
                          <span
                            className={`text-xs font-bold uppercase tracking-wide ${
                              pair.severity === 'major'
                                ? 'text-red-400'
                                : pair.severity === 'moderate'
                                  ? 'text-amber-400'
                                  : pair.severity === 'minor'
                                    ? 'text-slate-300'
                                    : 'text-emerald-400'
                            }`}
                          >
                            Severity: {pair.severity}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-slate-200">{pair.headline}</p>
                        <p className="text-sm text-slate-300 leading-relaxed">
                          {pair.plainLanguageExplanation}
                        </p>
                        {pair.symptomsToWatch.length > 0 && (
                          <p className="text-xs text-slate-300">
                            <span className="font-semibold text-slate-100">Watch for: </span>
                            {pair.symptomsToWatch.join(', ')}
                          </p>
                        )}
                        <p className="text-xs text-teal-100 bg-teal-950/50 border border-teal-500/35 rounded-lg px-3.5 py-2.5">
                          <span className="font-semibold text-teal-300">What to do: </span>
                          {pair.managementGuidance}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Food / Alcohol & Next Steps */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 border-t border-slate-800">
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-100">Food, Drink &amp; Alcohol Notes</h3>
                  <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed list-disc pl-4">
                    {result.foodAndAlcoholNotes.map((note, idx) => (
                      <li key={idx}>{note}</li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-100">Recommended Next Steps</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{result.actionGuidance}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-3 text-xs text-slate-400">
                {result.verifiedSources && result.verifiedSources.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-teal-300">
                        <Globe className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Live Internet-Verified Interaction Sources</span>
                      </div>
                      {result.liveEvidenceUsed && (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-300">
                          {result.liveEvidenceUsed.fdaLabelFound && (
                            <span className="text-emerald-300">U.S. FDA OpenFDA</span>
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

                <div>
                  <span className="font-medium text-slate-200">References: </span>
                  {result.clinicalReferences.join(' · ')}
                </div>
              </div>
            </article>
          )}
        </section>
      </div>
    </div>
  );
}
