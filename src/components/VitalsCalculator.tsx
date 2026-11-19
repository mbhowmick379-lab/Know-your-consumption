import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Droplet,
  HeartPulse,
  Info,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  evaluateCombinedVitals,
  formatVitalsSummaryText,
  type BloodPressureResult,
  type BloodSugarResult,
  type CombinedVitalsEvaluation,
  type SugarTestType,
  type SugarUnit,
  type VitalStatus,
} from '../utils/vitalsCalculator';
import { triggerFileDownload } from '../utils/recordExport';
import { usePatient } from '../contexts/PatientContext';

const STATUS_BADGE_STYLES: Record<
  VitalStatus,
  { badge: string; border: string; bg: string; barDot: string; iconColor: string }
> = {
  low: {
    badge: 'bg-sky-500/20 text-sky-200 border border-sky-400/50',
    border: 'border-sky-500/45',
    bg: 'bg-sky-950/35',
    barDot: 'bg-sky-300 ring-sky-400/50',
    iconColor: 'text-sky-300',
  },
  normal: {
    badge: 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/50',
    border: 'border-emerald-500/45',
    bg: 'bg-emerald-950/30',
    barDot: 'bg-emerald-300 ring-emerald-400/50',
    iconColor: 'text-emerald-300',
  },
  high: {
    badge: 'bg-rose-500/20 text-rose-200 border border-rose-400/50',
    border: 'border-rose-500/45',
    bg: 'bg-rose-950/35',
    barDot: 'bg-rose-400 ring-rose-400/50',
    iconColor: 'text-rose-300',
  },
};

function StatusIcon({ status }: { status: VitalStatus }) {
  if (status === 'normal') return <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />;
  if (status === 'low') return <TrendingDown className="w-4 h-4 shrink-0" aria-hidden="true" />;
  return <TrendingUp className="w-4 h-4 shrink-0" aria-hidden="true" />;
}

function getMeterLeftClass(percent: number): string {
  if (percent <= 10) return 'left-[6%]';
  if (percent <= 22) return 'left-[18%]';
  if (percent <= 35) return 'left-[32%]';
  if (percent <= 46) return 'left-[42%]';
  if (percent <= 58) return 'left-[54%]';
  if (percent <= 72) return 'left-[68%]';
  if (percent <= 86) return 'left-[82%]';
  return 'left-[94%]';
}

function RangeMeter({ percent, status }: { percent: number; status: VitalStatus }) {
  const style = STATUS_BADGE_STYLES[status];
  return (
    <div className="space-y-1.5">
      <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 via-40% via-amber-400 via-70% to-rose-600 overflow-visible">
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-slate-950 ring-4 transition-all ${style.barDot} ${getMeterLeftClass(percent)}`}
          aria-hidden="true"
        />
      </div>
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        <span className="text-sky-300">Low</span>
        <span className="text-emerald-300">Normal</span>
        <span className="text-amber-300">Elevated</span>
        <span className="text-rose-300">High</span>
      </div>
    </div>
  );
}

function BpResultCard({ bp }: { bp: BloodPressureResult }) {
  const theme = STATUS_BADGE_STYLES[bp.status];
  return (
    <div
      data-testid="bp-result-card"
      className={`rounded-2xl border p-5 space-y-4 ${theme.border} ${theme.bg}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <HeartPulse className={`w-4 h-4 ${theme.iconColor}`} aria-hidden="true" />
            <span>Blood Pressure Result</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-white">
              {bp.systolic}/{bp.diastolic}
            </span>
            <span className="text-xs font-mono font-semibold text-slate-300">mmHg</span>
            {bp.pulse !== null && (
              <span className="text-xs font-mono text-slate-300 ml-2">
                · Pulse {bp.pulse} bpm
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-100">{bp.category}</p>
        </div>

        <span
          data-testid="bp-status-badge"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg ${theme.badge}`}
        >
          <StatusIcon status={bp.status} />
          {bp.statusLabel}
        </span>
      </div>

      <RangeMeter percent={bp.meterPercent} status={bp.status} />

      <p className="text-sm text-slate-200 leading-relaxed">{bp.summary}</p>

      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-slate-400">Mean Arterial Pressure</div>
          <div className="font-mono font-bold text-slate-100 text-sm mt-0.5 tabular-nums">
            {bp.meanArterialPressure} mmHg
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <div className="text-slate-400">Pulse Pressure</div>
          <div className="font-mono font-bold text-slate-100 text-sm mt-0.5 tabular-nums">
            {bp.pulsePressure} mmHg
          </div>
        </div>
      </div>

      {bp.pulseNote && (
        <div className="p-3 rounded-xl bg-slate-950/75 border border-slate-800 text-xs text-slate-200 flex items-start gap-2">
          <Activity className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{bp.pulseNote}</span>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">
          Recommended Blood Pressure Advice
        </h3>
        <ul className="space-y-1.5 text-xs text-slate-200 leading-relaxed">
          {bp.advice.map((tip, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-1">
        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          When to Seek Medical Care
        </div>
        <ul className="list-disc pl-4 text-[11px] text-slate-300 space-y-0.5">
          {bp.warningSigns.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
        <p className="text-[10px] text-slate-400 pt-1">{bp.referenceRange}</p>
      </div>
    </div>
  );
}

function SugarResultCard({ sugar }: { sugar: BloodSugarResult }) {
  const theme = STATUS_BADGE_STYLES[sugar.status];
  return (
    <div
      data-testid="sugar-result-card"
      className={`rounded-2xl border p-5 space-y-4 ${theme.border} ${theme.bg}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Droplet className={`w-4 h-4 ${theme.iconColor}`} aria-hidden="true" />
            <span>Blood Sugar Result · {sugar.testTypeLabel}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono tabular-nums text-white">
              {sugar.mgDl}
            </span>
            <span className="text-xs font-mono font-semibold text-slate-300">mg/dL</span>
            <span className="text-xs font-mono text-slate-400">
              ({sugar.mmolL} mmol/L)
            </span>
          </div>
          <p className="text-sm font-bold text-slate-100">{sugar.category}</p>
        </div>

        <span
          data-testid="sugar-status-badge"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg ${theme.badge}`}
        >
          <StatusIcon status={sugar.status} />
          {sugar.statusLabel}
        </span>
      </div>

      <RangeMeter percent={sugar.meterPercent} status={sugar.status} />

      <p className="text-sm text-slate-200 leading-relaxed">{sugar.summary}</p>

      {sugar.hba1cAssessment && (
        <div className="p-3 rounded-xl bg-slate-950/75 border border-violet-500/35 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-violet-200">
              HbA1c: {sugar.hba1cAssessment.percent}%
            </span>
            <span className="font-semibold text-slate-300">
              {sugar.hba1cAssessment.category}
            </span>
          </div>
          <p className="text-slate-400">
            Estimated 3-month average glucose (eAG):{' '}
            <strong className="font-mono text-slate-100">
              ~{sugar.hba1cAssessment.estimatedAvgMgDl} mg/dL
            </strong>
          </p>
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-slate-800/80">
        <h3 className="text-xs font-bold uppercase tracking-wider text-teal-300">
          Recommended Blood Sugar Advice
        </h3>
        <ul className="space-y-1.5 text-xs text-slate-200 leading-relaxed">
          {sugar.advice.map((tip, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-md bg-slate-900 border border-slate-700 text-[10px] font-mono font-bold text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-1">
        <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          When to Seek Medical Care
        </div>
        <ul className="list-disc pl-4 text-[11px] text-slate-300 space-y-0.5">
          {sugar.warningSigns.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
        <p className="text-[10px] text-slate-400 pt-1">{sugar.referenceRange}</p>
      </div>
    </div>
  );
}

export function VitalsCalculator() {
  const { profile } = usePatient();
  const [systolicInput, setSystolicInput] = useState('');
  const [diastolicInput, setDiastolicInput] = useState('');
  const [pulseInput, setPulseInput] = useState('');

  const [sugarInput, setSugarInput] = useState('');
  const [sugarUnit, setSugarUnit] = useState<SugarUnit>('mg/dL');
  const [testType, setTestType] = useState<SugarTestType>('fasting');
  const [hba1cInput, setHba1cInput] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<CombinedVitalsEvaluation | null>(null);

  const runCalculation = (override?: {
    systolic?: string;
    diastolic?: string;
    pulse?: string;
    sugar?: string;
    unit?: SugarUnit;
    testType?: SugarTestType;
    hba1c?: string;
  }) => {
    setErrorMsg(null);
    const sStr = (override?.systolic ?? systolicInput).trim();
    const dStr = (override?.diastolic ?? diastolicInput).trim();
    const pStr = (override?.pulse ?? pulseInput).trim();
    const gStr = (override?.sugar ?? sugarInput).trim();
    const u = override?.unit ?? sugarUnit;
    const t = override?.testType ?? testType;
    const a1cStr = (override?.hba1c ?? hba1cInput).trim();

    const hasAnyBp = sStr !== '' || dStr !== '';
    const hasSugar = gStr !== '';

    if (!hasAnyBp && !hasSugar) {
      setErrorMsg('Enter your Blood Pressure (Systolic & Diastolic), Blood Sugar reading, or both.');
      return;
    }

    if (hasAnyBp && (sStr === '' || dStr === '')) {
      setErrorMsg('Enter both Systolic (top) and Diastolic (bottom) blood pressure numbers.');
      return;
    }

    try {
      const nextEval = evaluateCombinedVitals({
        bp: hasAnyBp
          ? {
              systolic: Number(sStr),
              diastolic: Number(dStr),
              pulse: pStr !== '' ? Number(pStr) : null,
            }
          : null,
        sugar: hasSugar
          ? {
              value: Number(gStr),
              unit: u,
              testType: t,
              hba1c: a1cStr !== '' ? Number(a1cStr) : null,
            }
          : null,
      });
      setEvaluation(nextEval);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Please check your entered values.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runCalculation();
  };

  const applySample = (sample: {
    systolic: string;
    diastolic: string;
    pulse: string;
    sugar: string;
    testType: SugarTestType;
  }) => {
    setSystolicInput(sample.systolic);
    setDiastolicInput(sample.diastolic);
    setPulseInput(sample.pulse);
    setSugarInput(sample.sugar);
    setSugarUnit('mg/dL');
    setTestType(sample.testType);
    setHba1cInput('');
    runCalculation({
      systolic: sample.systolic,
      diastolic: sample.diastolic,
      pulse: sample.pulse,
      sugar: sample.sugar,
      unit: 'mg/dL',
      testType: sample.testType,
      hba1c: '',
    });
  };

  const handleReset = () => {
    setSystolicInput('');
    setDiastolicInput('');
    setPulseInput('');
    setSugarInput('');
    setHba1cInput('');
    setErrorMsg(null);
    setEvaluation(null);
  };

  const handleDownloadReport = () => {
    if (!evaluation) return;
    const text = formatVitalsSummaryText(evaluation, profile.displayName || undefined);
    triggerFileDownload('kyc-bp-sugar-report.txt', text, 'text/plain;charset=utf-8');
  };

  return (
    <div className="space-y-8">
      {/* Header Intro */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold text-emerald-400">
            ACC/AHA Blood Pressure &amp; ADA/WHO Blood Sugar Assessment
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50 text-balance">
            Blood Pressure &amp; Blood Sugar{' '}
            <span className="bg-gradient-to-r from-emerald-300 via-teal-300 to-rose-400 bg-clip-text text-transparent">
              Calculator
            </span>
          </h1>
          <p className="text-[15px] text-slate-300 leading-relaxed">
            Enter your Blood Pressure (mmHg), Blood Sugar (mg/dL or mmol/L), or both together to
            instantly check if your levels are <strong>Low</strong>, <strong>Normal</strong>, or{' '}
            <strong>High</strong> — along with clear, practical medical advice tailored to your
            exact result.
          </p>
        </div>

        {evaluation && (
          <button
            type="button"
            onClick={handleDownloadReport}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 self-start md:self-auto"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            Download Report (.txt)
          </button>
        )}
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Input Form */}
        <section
          aria-label="Blood pressure and blood sugar calculator form"
          className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5"
        >
          {/* Quick Sample Presets */}
          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-300">
              Quick Example Readings
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                {
                  label: 'Normal (118/76 · 92)',
                  systolic: '118',
                  diastolic: '76',
                  pulse: '72',
                  sugar: '92',
                  testType: 'fasting' as const,
                  accent: 'hover:border-emerald-400/60 text-emerald-200',
                },
                {
                  label: 'High (154/96 · 186)',
                  systolic: '154',
                  diastolic: '96',
                  pulse: '84',
                  sugar: '186',
                  testType: 'fasting' as const,
                  accent: 'hover:border-rose-400/60 text-rose-200',
                },
                {
                  label: 'Low (84/54 · 62)',
                  systolic: '84',
                  diastolic: '54',
                  pulse: '88',
                  sugar: '62',
                  testType: 'fasting' as const,
                  accent: 'hover:border-sky-400/60 text-sky-200',
                },
                {
                  label: 'Borderline (128/82 · 155)',
                  systolic: '128',
                  diastolic: '82',
                  pulse: '76',
                  sugar: '155',
                  testType: 'postprandial' as const,
                  accent: 'hover:border-amber-400/60 text-amber-200',
                },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => applySample(s)}
                  className={`text-left px-2.5 py-2 text-[11px] font-semibold bg-slate-950/80 border border-slate-800 rounded-lg transition-colors ${s.accent}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Blood Pressure Card */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/35 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-rose-100">
                  <HeartPulse className="w-4 h-4 text-rose-400" aria-hidden="true" />
                  Blood Pressure (BP)
                </span>
                <span className="text-[11px] text-rose-300 font-medium">mmHg</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="bp-systolic"
                    className="block text-xs font-semibold text-slate-200"
                  >
                    Systolic (Top)
                  </label>
                  <div className="relative">
                    <input
                      id="bp-systolic"
                      type="number"
                      min={40}
                      max={300}
                      value={systolicInput}
                      onChange={(e) => {
                        setSystolicInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="e.g., 120"
                      className="w-full pl-3 pr-12 py-2.5 text-sm font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:font-sans placeholder:text-slate-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                      mmHg
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="bp-diastolic"
                    className="block text-xs font-semibold text-slate-200"
                  >
                    Diastolic (Bottom)
                  </label>
                  <div className="relative">
                    <input
                      id="bp-diastolic"
                      type="number"
                      min={25}
                      max={200}
                      value={diastolicInput}
                      onChange={(e) => {
                        setDiastolicInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="e.g., 80"
                      className="w-full pl-3 pr-12 py-2.5 text-sm font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:font-sans placeholder:text-slate-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400">
                      mmHg
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-baseline justify-between">
                  <label
                    htmlFor="bp-pulse"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    Heart Rate / Pulse
                  </label>
                  <span className="text-[11px] text-slate-400">Optional</span>
                </div>
                <div className="relative">
                  <input
                    id="bp-pulse"
                    type="number"
                    min={25}
                    max={240}
                    value={pulseInput}
                    onChange={(e) => {
                      setPulseInput(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="e.g., 72"
                    className="w-full pl-3 pr-12 py-2 text-xs font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:font-sans placeholder:text-slate-500"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400">
                    bpm
                  </span>
                </div>
              </div>
            </div>

            {/* Blood Sugar Card */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/35 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-100">
                  <Droplet className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                  Blood Sugar (Glucose)
                </span>
                <div
                  className="flex p-0.5 bg-slate-950 border border-slate-700 rounded-lg"
                  role="group"
                  aria-label="Blood sugar unit"
                >
                  {(['mg/dL', 'mmol/L'] as SugarUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      aria-pressed={sugarUnit === u}
                      onClick={() => setSugarUnit(u)}
                      className={`px-2 py-1 text-[11px] font-bold rounded-md transition-colors ${
                        sugarUnit === u
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Timing Selector */}
              <div className="space-y-1">
                <span className="block text-xs font-semibold text-slate-200">
                  Test Timing
                </span>
                <div
                  className="grid grid-cols-3 gap-1.5"
                  role="group"
                  aria-label="Blood sugar test timing"
                >
                  {(
                    [
                      { id: 'fasting' as const, label: 'Fasting' },
                      { id: 'postprandial' as const, label: 'After Meal' },
                      { id: 'random' as const, label: 'Random' },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={testType === opt.id}
                      onClick={() => setTestType(opt.id)}
                      className={`py-2 px-2 text-xs font-bold rounded-lg border transition-all ${
                        testType === opt.id
                          ? 'bg-emerald-600 border-emerald-400 text-white shadow-xs'
                          : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-emerald-500/60 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="blood-sugar-value"
                    className="block text-xs font-semibold text-slate-200"
                  >
                    Blood Sugar Level
                  </label>
                  <div className="relative">
                    <input
                      id="blood-sugar-value"
                      type="number"
                      step="any"
                      min={1}
                      max={900}
                      value={sugarInput}
                      onChange={(e) => {
                        setSugarInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder={sugarUnit === 'mmol/L' ? 'e.g., 5.2' : 'e.g., 95'}
                      className="w-full pl-3 pr-14 py-2.5 text-sm font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:font-sans placeholder:text-slate-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-emerald-300">
                      {sugarUnit}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor="blood-sugar-hba1c"
                      className="block text-xs font-semibold text-slate-300"
                    >
                      HbA1c
                    </label>
                    <span className="text-[11px] text-slate-400">Optional</span>
                  </div>
                  <div className="relative">
                    <input
                      id="blood-sugar-hba1c"
                      type="number"
                      step="0.1"
                      min={3}
                      max={20}
                      value={hba1cInput}
                      onChange={(e) => {
                        setHba1cInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="e.g., 5.6"
                      className="w-full pl-3 pr-8 py-2.5 text-sm font-mono font-semibold tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:font-sans placeholder:text-slate-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">
                      %
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-xs font-semibold text-rose-200 flex items-center gap-2"
              >
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 py-3 px-4 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-600 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-500 rounded-xl shadow-xs transition-all"
              >
                Calculate BP &amp; Blood Sugar
              </button>
              <button
                type="button"
                onClick={handleReset}
                aria-label="Reset blood pressure and blood sugar form"
                className="px-3.5 py-3 text-slate-300 bg-slate-950 border border-slate-700 hover:border-slate-500 hover:text-white rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </form>
        </section>

        {/* Right Column: Live Results & Advice OR Reference Chart */}
        <section
          aria-label="Blood pressure and blood sugar analysis results"
          className="lg:col-span-7 space-y-5"
        >
          {evaluation ? (
            <>
              {evaluation.urgentAlert && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-red-950/75 border-2 border-red-500/70 text-red-100 space-y-1"
                >
                  <div className="flex items-center gap-2 text-sm font-extrabold text-red-200">
                    <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" aria-hidden="true" />
                    <span>Immediate Safety Attention Needed</span>
                  </div>
                  <p className="text-xs leading-relaxed text-red-100">{evaluation.urgentAlert}</p>
                </div>
              )}

              {/* Overall Combined Verdict Banner */}
              <div
                data-testid="vitals-overall-summary"
                className={`rounded-2xl border p-5 space-y-2 ${STATUS_BADGE_STYLES[evaluation.overallStatus].border} bg-slate-900/95`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-white">
                    {evaluation.overallHeadline}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold uppercase tracking-wider rounded-lg ${STATUS_BADGE_STYLES[evaluation.overallStatus].badge}`}
                  >
                    <StatusIcon status={evaluation.overallStatus} />
                    {evaluation.overallStatus}
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {evaluation.combinedInsight}
                </p>
              </div>

              {evaluation.bp && <BpResultCard bp={evaluation.bp} />}
              {evaluation.sugar && <SugarResultCard sugar={evaluation.sugar} />}

              <p className="text-xs text-slate-400 flex items-start gap-2 px-1">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Based on ACC/AHA Blood Pressure and ADA/WHO Blood Glucose clinical reference
                  ranges. Single readings can fluctuate with stress, posture, recent meals, or
                  dehydration — always confirm diagnosis or medication changes with your physician.
                </span>
              </p>
            </>
          ) : (
            /* Helpful Clinical Reference Guide Before Entry */
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="space-y-1.5">
                <h2 className="text-xl font-extrabold text-slate-50">
                  Instant Low · Normal · High Analysis &amp; Advice
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Enter your Blood Pressure, Blood Sugar, or both on the left (or tap any quick
                  example reading) to see your exact clinical category, visual range meter, and
                  step-by-step action advice.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-300 uppercase tracking-wider">
                    <HeartPulse className="w-4 h-4" aria-hidden="true" />
                    Blood Pressure Ranges (mmHg)
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2 text-sky-300">
                      <span>Low (Hypotension)</span>
                      <span className="font-mono font-semibold">&lt; 90 / &lt; 60</span>
                    </div>
                    <div className="flex justify-between gap-2 text-emerald-300 font-semibold">
                      <span>Normal</span>
                      <span className="font-mono">90–119 / 60–79</span>
                    </div>
                    <div className="flex justify-between gap-2 text-amber-300">
                      <span>Elevated</span>
                      <span className="font-mono font-semibold">120–129 / &lt; 80</span>
                    </div>
                    <div className="flex justify-between gap-2 text-orange-300">
                      <span>High (Stage 1)</span>
                      <span className="font-mono font-semibold">130–139 / 80–89</span>
                    </div>
                    <div className="flex justify-between gap-2 text-rose-300">
                      <span>High (Stage 2)</span>
                      <span className="font-mono font-semibold">≥ 140 / ≥ 90</span>
                    </div>
                    <div className="flex justify-between gap-2 text-red-400 font-bold">
                      <span>Crisis (Urgent)</span>
                      <span className="font-mono">≥ 180 / ≥ 120</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-300 uppercase tracking-wider">
                    <Droplet className="w-4 h-4" aria-hidden="true" />
                    Blood Sugar Ranges (mg/dL)
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2 text-sky-300">
                      <span>Low (Hypoglycemia)</span>
                      <span className="font-mono font-semibold">&lt; 70 mg/dL</span>
                    </div>
                    <div className="flex justify-between gap-2 text-emerald-300 font-semibold">
                      <span>Normal (Fasting)</span>
                      <span className="font-mono">70–99 mg/dL</span>
                    </div>
                    <div className="flex justify-between gap-2 text-emerald-200">
                      <span>Normal (2h Post-Meal)</span>
                      <span className="font-mono">70–139 mg/dL</span>
                    </div>
                    <div className="flex justify-between gap-2 text-amber-300">
                      <span>Prediabetes (Fasting)</span>
                      <span className="font-mono font-semibold">100–125 mg/dL</span>
                    </div>
                    <div className="flex justify-between gap-2 text-rose-300">
                      <span>High (Fasting Diabetes)</span>
                      <span className="font-mono font-semibold">≥ 126 mg/dL</span>
                    </div>
                    <div className="flex justify-between gap-2 text-red-400 font-bold">
                      <span>High (Post-Meal / Random)</span>
                      <span className="font-mono">≥ 200 mg/dL</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
