import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Download,
  Droplets,
  RotateCcw,
} from 'lucide-react';
import {
  LIQUID_STRENGTH_PRESETS,
  calculateLiquidDoseMl,
  formatLiquidPlanText,
} from '../utils/liquidDose';
import { resolveDrugIdentity } from '../utils/drugCatalog';
import { triggerFileDownload } from '../utils/recordExport';
import { usePatient } from '../contexts/PatientContext';

interface MlDoseCalculatorProps {
  prefill?: {
    medicationName?: string;
    targetDoseMg?: number;
    strengthMg?: number;
    strengthPerMl?: number;
  } | null;
}

export function MlDoseCalculator({ prefill }: MlDoseCalculatorProps) {
  const { profile } = usePatient();

  const [medicationName, setMedicationName] = useState(prefill?.medicationName || 'Amoxicillin Suspension');
  const [targetDoseMg, setTargetDoseMg] = useState(
    prefill?.targetDoseMg ? String(prefill.targetDoseMg) : '250'
  );
  const [strengthMg, setStrengthMg] = useState(
    prefill?.strengthMg ? String(prefill.strengthMg) : '125'
  );
  const [strengthPerMl, setStrengthPerMl] = useState(
    prefill?.strengthPerMl ? String(prefill.strengthPerMl) : '5'
  );
  const [dosesPerDay, setDosesPerDay] = useState('3');
  const [courseDays, setCourseDays] = useState('7');

  useEffect(() => {
    if (!prefill) return;
    if (prefill.medicationName) setMedicationName(prefill.medicationName);
    if (prefill.targetDoseMg) setTargetDoseMg(String(prefill.targetDoseMg));
    if (prefill.strengthMg) setStrengthMg(String(prefill.strengthMg));
    if (prefill.strengthPerMl) setStrengthPerMl(String(prefill.strengthPerMl));
  }, [prefill]);

  const recognizedSyrup = useMemo(() => resolveDrugIdentity(medicationName), [medicationName]);

  const parsedTarget = Number(targetDoseMg);
  const parsedStrengthMg = Number(strengthMg);
  const parsedStrengthMl = Number(strengthPerMl);
  const parsedDosesPerDay = dosesPerDay.trim() === '' ? undefined : Number(dosesPerDay);
  const parsedCourseDays = courseDays.trim() === '' ? undefined : Number(courseDays);

  const calculation = useMemo(
    () =>
      calculateLiquidDoseMl({
        targetDoseMg: parsedTarget,
        strengthMg: parsedStrengthMg,
        strengthPerMl: parsedStrengthMl,
        dosesPerDay: parsedDosesPerDay,
        courseDays: parsedCourseDays,
      }),
    [parsedTarget, parsedStrengthMg, parsedStrengthMl, parsedDosesPerDay, parsedCourseDays]
  );

  const fillPercent = calculation
    ? Math.min(100, Math.max(4, (calculation.singleDoseMl / calculation.syringeCapacityMl) * 100))
    : 0;

  const handleDownloadSheet = () => {
    if (!calculation) return;
    const text = formatLiquidPlanText({
      medicationName,
      patientName: profile.displayName || undefined,
      targetDoseMg: parsedTarget,
      strengthMg: parsedStrengthMg,
      strengthPerMl: parsedStrengthMl,
      dosesPerDay: parsedDosesPerDay,
      courseDays: parsedCourseDays,
      calc: calculation,
    });
    const slug = (medicationName || 'liquid-dose').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    triggerFileDownload(`kyc-ml-measurement-${slug}.txt`, text, 'text/plain;charset=utf-8');
  };

  const handleReset = () => {
    setMedicationName('');
    setTargetDoseMg('');
    setStrengthMg('250');
    setStrengthPerMl('5');
    setDosesPerDay('2');
    setCourseDays('7');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold text-sky-700">
            Liquid &amp; Syrup Measurement Converter · mg per 5 mL, 10 mL &amp; Custom Bottles
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
            How much mL should I give to the patient?
          </h1>
          <p className="text-[15px] text-slate-500 leading-relaxed">
            Check the concentration printed on your syrup or oral suspension bottle (for example,
            how many mg are in every 5 mL or 10 mL) and instantly see the exact mL volume to draw up.
          </p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="self-start md:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-50 border border-sky-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Reset Fields
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form: Bottle Strength & Target Dose */}
        <section
          aria-label="Liquid mL calculator inputs"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-6"
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="ml-med-name" className="block text-sm font-bold text-slate-900">
                Brand or Generic Syrup Name
              </label>
              <input
                id="ml-med-name"
                type="text"
                value={medicationName}
                onChange={(e) => setMedicationName(e.target.value)}
                placeholder="e.g., Calpol, Augmentin Duo, Ibugesic, Amoxicillin"
                className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder:text-slate-500"
              />
              {recognizedSyrup && (
                <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-teal-800">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-teal-700" aria-hidden="true" />
                    <span>
                      Generic: <strong className="text-slate-900">{recognizedSyrup.genericName}</strong>
                    </span>
                  </span>
                  {recognizedSyrup.typicalLiquidMg && recognizedSyrup.typicalLiquidPerMl && (
                    <button
                      type="button"
                      onClick={() => {
                        setStrengthMg(String(recognizedSyrup.typicalLiquidMg));
                        setStrengthPerMl(String(recognizedSyrup.typicalLiquidPerMl));
                      }}
                      className="px-2 py-1 text-[11px] font-semibold bg-teal-600 hover:bg-teal-500 text-white rounded"
                    >
                      Set {recognizedSyrup.typicalLiquidMg} mg / {recognizedSyrup.typicalLiquidPerMl} mL
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="ml-target-mg" className="block text-sm font-bold text-slate-900">
                Dose Needed per Intake (mg)
              </label>
              <div className="relative">
                <input
                  id="ml-target-mg"
                  type="number"
                  min={0.1}
                  max={10000}
                  step="any"
                  value={targetDoseMg}
                  onChange={(e) => setTargetDoseMg(e.target.value)}
                  placeholder="e.g., 250"
                  className="w-full pr-12 pl-3.5 py-2.5 text-base font-mono font-semibold tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-sky-700">
                  mg
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[100, 125, 200, 250, 400, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTargetDoseMg(String(val))}
                    className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md transition-colors ${
                      targetDoseMg === String(val)
                        ? 'bg-sky-600 text-slate-900'
                        : 'bg-white border border-slate-200 text-sky-700 hover:bg-sky-50'
                    }`}
                  >
                    {val} mg
                  </button>
                ))}
              </div>
            </div>

            {/* Bottle Concentration: ___ mg per ___ mL */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="space-y-0.5">
                <span className="block text-sm font-bold text-slate-900">
                  Bottle Strength (Check Medicine Label)
                </span>
                <p className="text-xs text-slate-500">
                  Enter how many mg of medicine are in each 5 mL, 10 mL, or 1 mL of liquid.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="bottle-mg" className="block text-xs font-semibold text-slate-500">
                    Drug Amount (mg)
                  </label>
                  <div className="relative">
                    <input
                      id="bottle-mg"
                      type="number"
                      min={0.1}
                      max={10000}
                      step="any"
                      value={strengthMg}
                      onChange={(e) => setStrengthMg(e.target.value)}
                      placeholder="125"
                      className="w-full pr-10 pl-3 py-2.5 text-sm font-mono font-semibold tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-teal-700">
                      mg
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="bottle-ml" className="block text-xs font-semibold text-slate-500">
                    Per Liquid Volume (mL)
                  </label>
                  <div className="relative">
                    <input
                      id="bottle-ml"
                      type="number"
                      min={0.1}
                      max={500}
                      step="any"
                      value={strengthPerMl}
                      onChange={(e) => setStrengthPerMl(e.target.value)}
                      placeholder="5"
                      className="w-full pr-10 pl-3 py-2.5 text-sm font-mono font-semibold tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-semibold text-teal-700">
                      mL
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Volume Selector: per 5 mL / per 10 mL / per 1 mL */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500 mr-1">Quick volume:</span>
                {[
                  { ml: '5', label: 'Per 5 mL (1 tsp)' },
                  { ml: '10', label: 'Per 10 mL' },
                  { ml: '1', label: 'Per 1 mL (Drops)' },
                ].map((opt) => (
                  <button
                    key={opt.ml}
                    type="button"
                    onClick={() => setStrengthPerMl(opt.ml)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                      strengthPerMl === opt.ml
                        ? 'bg-teal-600 text-slate-900'
                        : 'bg-white border border-slate-200 text-teal-700 hover:bg-teal-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Common Bottle Presets */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <span className="block text-xs font-bold text-slate-500">
                Common Antibiotic &amp; Syrup Strengths
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {LIQUID_STRENGTH_PRESETS.map((preset) => {
                  const active =
                    strengthMg === String(preset.mg) && strengthPerMl === String(preset.perMl);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setStrengthMg(String(preset.mg));
                        setStrengthPerMl(String(preset.perMl));
                        if (!medicationName) setMedicationName(preset.medicationHint);
                      }}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        active
                          ? 'bg-sky-600 border-sky-500 text-slate-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-sky-200 hover:bg-sky-50'
                      }`}
                    >
                      <div className="font-mono font-bold tabular-nums">{preset.label}</div>
                      <div
                        className={`truncate text-[11px] mt-0.5 ${
                          active ? 'text-sky-900' : 'text-slate-500'
                        }`}
                      >
                        {preset.medicationHint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Daily & Course Volume */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
              <div className="space-y-1">
                <label htmlFor="ml-doses-day" className="block text-xs font-semibold text-slate-500">
                  Doses per Day (Optional)
                </label>
                <input
                  id="ml-doses-day"
                  type="number"
                  min={1}
                  max={12}
                  value={dosesPerDay}
                  onChange={(e) => setDosesPerDay(e.target.value)}
                  placeholder="e.g., 3"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="ml-course-days" className="block text-xs font-semibold text-slate-500">
                  Course Days (Optional)
                </label>
                <input
                  id="ml-course-days"
                  type="number"
                  min={1}
                  max={90}
                  value={courseDays}
                  onChange={(e) => setCourseDays(e.target.value)}
                  placeholder="e.g., 7"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Right Panel: Live Visual mL Result & Oral Syringe Guide */}
        <section
          aria-label="Calculated mL dosage result"
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-6"
        >
          {!calculation ? (
            <div className="py-12 text-center space-y-2">
              <Droplets className="w-10 h-10 text-sky-700 mx-auto" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-900">
                Enter target mg dose and bottle concentration
              </h2>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Fill in the target dose (mg) and your bottle label strength (mg per 5 mL or 10 mL)
                to see the exact liquid volume to administer.
              </p>
            </div>
          ) : (
            <>
              {/* Hero Result Banner */}
              <div className="rounded-xl bg-gradient-to-r from-sky-600 via-blue-600 to-teal-600 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-sky-900">
                    Exact Liquid Volume to Give · {medicationName || 'Oral Suspension'}
                  </p>
                  <p
                    data-testid="calculated-ml-value"
                    className="text-4xl sm:text-5xl font-extrabold font-mono tabular-nums tracking-tight"
                  >
                    {calculation.singleDoseMl} mL
                  </p>
                  <p className="text-xs text-sky-900 font-medium">
                    Approx. {calculation.singleDoseTeaspoons} measuring teaspoon · Concentration{' '}
                    {calculation.concentrationMgPerMl} mg/mL
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadSheet}
                  className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-slate-900 bg-white hover:bg-sky-50 rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs"
                >
                  <Download className="w-4 h-4" aria-hidden="true" />
                  Download mL Sheet
                </button>
              </div>

              {/* Visual Oral Dosing Syringe Gauge */}
              <div className="space-y-2.5 bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    Oral Syringe Visual Reference (Scale: 0 to {calculation.syringeCapacityMl} mL)
                  </h2>
                  <span className="text-xs font-mono font-bold text-teal-700 tabular-nums">
                    Fill to {calculation.singleDoseMl} mL
                  </span>
                </div>

                <div className="pt-2 pb-1">
                  <div className="relative h-12 rounded-xl bg-white border-2 border-slate-300 overflow-hidden flex items-center">
                    <div
                      className="h-full bg-gradient-to-r from-teal-400 via-teal-500 to-sky-500 transition-all duration-200"
                      style={{ width: `${fillPercent}%` }}
                    />
                    <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                      {Array.from({ length: 11 }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-px ${idx % 2 === 0 ? 'h-4 bg-slate-200/70' : 'h-2.5 bg-slate-400/50'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-1.5 tabular-nums">
                    <span>0 mL</span>
                    <span>{calculation.syringeCapacityMl / 4} mL</span>
                    <span>{calculation.syringeCapacityMl / 2} mL</span>
                    <span>{(calculation.syringeCapacityMl * 3) / 4} mL</span>
                    <span>{calculation.syringeCapacityMl} mL</span>
                  </div>
                </div>
              </div>

              {/* Tabular Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-white p-4 space-y-1">
                  <p className="text-xs font-medium text-slate-500">Single Dose Volume</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-sky-700">
                    {calculation.singleDoseMl} mL
                  </p>
                </div>
                <div className="bg-white p-4 space-y-1">
                  <p className="text-xs font-medium text-slate-500">Total Daily Volume</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-teal-700">
                    {calculation.dailyVolumeMl !== null ? `${calculation.dailyVolumeMl} mL / day` : '—'}
                  </p>
                </div>
                <div className="bg-white p-4 space-y-1">
                  <p className="text-xs font-medium text-slate-500">Full Course Volume</p>
                  <p className="text-lg font-bold font-mono tabular-nums text-sky-700">
                    {calculation.totalCourseVolumeMl !== null
                      ? `${calculation.totalCourseVolumeMl} mL total`
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Transparent Step-by-Step Verification Math */}
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 space-y-1">
                <p className="text-xs font-bold text-sky-700">Verified Dose-to-mL Formula</p>
                <p className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                  {calculation.formulaText}
                </p>
                <p className="text-xs text-sky-800">
                  Bottle concentration: {parsedStrengthMg} mg in every {parsedStrengthMl} mL (
                  {calculation.concentrationMgPerMl} mg per 1 mL).
                </p>
              </div>

              {/* Safety Alerts or Verified Notice */}
              {calculation.safetyWarnings.length > 0 ? (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                    <span>Liquid Volume Verification Notice</span>
                  </div>
                  <ul className="list-disc pl-5 text-xs space-y-1 leading-relaxed">
                    {calculation.safetyWarnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <strong className="text-emerald-800">Measurement verified:</strong> Always shake
                    liquid suspensions well for 10–15 seconds before drawing up with a marked oral
                    syringe or dosing cup. Never use household kitchen spoons.
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
