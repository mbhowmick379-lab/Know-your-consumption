import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Download,
  ShieldAlert,
  Syringe,
} from 'lucide-react';
import {
  EXPOSURE_CATEGORY_INFO,
  RABIES_REGIMENS,
  addUtcDays,
  buildRabiesSchedule,
  buildRabiesScheduleIcs,
  formatRabiesScheduleText,
  getTodayIsoDate,
  type RabiesExposureCategory,
  type RabiesRegimenId,
} from '../utils/rabiesSchedule';
import { triggerFileDownload } from '../utils/recordExport';
import { usePatient } from '../contexts/PatientContext';

const STORAGE_KEY = 'kyc_rabies_schedule_state_v1';

const REGIMEN_COLORS: Record<RabiesRegimenId, string> = {
  'pep-4-im': 'bg-rose-600 text-white border-rose-500 shadow-xs',
  'pep-5-im': 'bg-amber-600 text-white border-amber-500 shadow-xs',
  'pep-id-who': 'bg-teal-600 text-white border-teal-500 shadow-xs',
  'pep-booster': 'bg-sky-600 text-white border-sky-500 shadow-xs',
  'prep-2': 'bg-sky-600 text-white border-sky-500 shadow-xs',
};

export function RabiesScheduleSection() {
  const { profile } = usePatient();
  const todayIso = useMemo(() => getTodayIsoDate(), []);

  const [startDateIso, setStartDateIso] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.startDateIso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.startDateIso)) {
          return parsed.startDateIso;
        }
      }
    } catch {
      // ignore
    }
    return todayIso;
  });

  const [regimenId, setRegimenId] = useState<RabiesRegimenId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (RABIES_REGIMENS.some((r) => r.id === parsed.regimenId)) {
          return parsed.regimenId;
        }
      }
    } catch {
      // ignore
    }
    return 'pep-4-im';
  });

  const [exposureCategory, setExposureCategory] = useState<RabiesExposureCategory>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.exposureCategory === 'cat-1' || parsed.exposureCategory === 'cat-2' || parsed.exposureCategory === 'cat-3') {
          return parsed.exposureCategory;
        }
      }
    } catch {
      // ignore
    }
    return 'cat-2';
  });

  const [completedOffsets, setCompletedOffsets] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.completedOffsets)) {
          return parsed.completedOffsets.filter((n: unknown): n is number => typeof n === 'number');
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ startDateIso, regimenId, exposureCategory, completedOffsets })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [startDateIso, regimenId, exposureCategory, completedOffsets]);

  const schedulePlan = useMemo(
    () =>
      buildRabiesSchedule({
        startDateIso,
        regimenId,
        exposureCategory,
        referenceTodayIso: todayIso,
      }),
    [startDateIso, regimenId, exposureCategory, todayIso]
  );

  const toggleDoseCompleted = (dayOffset: number) => {
    setCompletedOffsets((prev) =>
      prev.includes(dayOffset) ? prev.filter((d) => d !== dayOffset) : [...prev, dayOffset]
    );
  };

  const handleDownloadTxt = () => {
    if (!schedulePlan) return;
    const content = formatRabiesScheduleText(schedulePlan, profile.displayName || undefined);
    triggerFileDownload(
      `kyc-rabies-schedule-${schedulePlan.startDateIso}.txt`,
      content,
      'text/plain;charset=utf-8'
    );
  };

  const handleDownloadIcs = () => {
    if (!schedulePlan) return;
    const ics = buildRabiesScheduleIcs(schedulePlan, profile.displayName || undefined);
    triggerFileDownload(
      `kyc-rabies-vaccine-dates-${schedulePlan.startDateIso}.ics`,
      ics,
      'text/calendar;charset=utf-8'
    );
  };

  return (
    <section
      id="rabies-schedule"
      aria-label="Rabies vaccination schedule and dates calculator"
      className="no-print scroll-mt-20 max-w-[1280px] w-full mx-auto px-4 sm:px-6 pb-10 pt-2"
    >
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold text-rose-700">
              WHO &amp; CDC Rabies Prophylaxis · Post-Exposure (PEP) &amp; Pre-Exposure (PrEP) Dates
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 text-balance">
              Rabies Vaccination Schedule &amp; Exact Dose Dates
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Select your Day 0 (first vaccine visit) date and protocol to calculate every exact
              rabies vaccination appointment date, track completed doses, and export calendar
              reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadTxt}
              disabled={!schedulePlan}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              Download Schedule (.txt)
            </button>
            <button
              type="button"
              onClick={handleDownloadIcs}
              disabled={!schedulePlan}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 rounded-lg transition-all whitespace-nowrap disabled:opacity-50"
            >
              <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Export Calendar Dates (.ics)
            </button>
          </div>
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Controls: Date, Regimen, Exposure Category */}
          <div className="lg:col-span-5 space-y-5">
            {/* Day 0 Date Input */}
            <div className="space-y-2">
              <label htmlFor="rabies-day0-date" className="block text-sm font-bold text-slate-900">
                Day 0 Date (First Vaccine Dose)
              </label>
              <div className="flex flex-wrap gap-2">
                <div className="relative flex-1 min-w-[180px]">
                  <Calendar
                    className="w-4 h-4 text-rose-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="rabies-day0-date"
                    type="date"
                    value={startDateIso}
                    onChange={(e) => setStartDateIso(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 text-sm font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStartDateIso(todayIso)}
                    className="px-3 py-2 text-xs font-semibold bg-teal-600/20 hover:bg-teal-600/35 text-teal-800 border border-teal-200 rounded-lg whitespace-nowrap transition-colors"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setStartDateIso(addUtcDays(todayIso, -1) || todayIso)}
                    className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg whitespace-nowrap transition-colors"
                  >
                    Yesterday
                  </button>
                </div>
              </div>
            </div>

            {/* Vaccination Protocol Selector */}
            <div className="space-y-2">
              <span className="block text-sm font-bold text-slate-900">
                Rabies Vaccination Protocol
              </span>
              <div
                role="radiogroup"
                aria-label="Select rabies vaccination protocol"
                className="flex flex-col gap-2"
              >
                {RABIES_REGIMENS.map((reg) => {
                  const active = regimenId === reg.id;
                  return (
                    <button
                      key={reg.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setRegimenId(reg.id);
                        setCompletedOffsets([]);
                      }}
                      className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition-all ${
                        active
                          ? REGIMEN_COLORS[reg.id]
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-900'
                      }`}
                    >
                      <div className="font-bold flex items-center justify-between gap-2">
                        <span>{reg.shortLabel}</span>
                        <span className="font-mono text-[11px] opacity-90 shrink-0">
                          {reg.dayOffsets.length} doses
                        </span>
                      </div>
                      <p
                        className={`text-[11px] mt-0.5 leading-snug ${
                          active ? 'text-white/90' : 'text-slate-500'
                        }`}
                      >
                        {reg.audience}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* WHO Exposure Category Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <span className="block text-sm font-bold text-slate-900">
                WHO Exposure Category (For RIG Check)
              </span>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="WHO exposure category">
                {(
                  [
                    { id: 'cat-1', label: 'Cat I', sub: 'Intact skin', activeCls: 'bg-sky-600 text-white border-sky-500' },
                    { id: 'cat-2', label: 'Cat II', sub: 'Minor scratch', activeCls: 'bg-amber-600 text-white border-amber-500' },
                    { id: 'cat-3', label: 'Cat III', sub: 'Bleeding bite', activeCls: 'bg-rose-600 text-white border-rose-500' },
                  ] as const
                ).map((cat) => {
                  const active = exposureCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setExposureCategory(cat.id)}
                      className={`px-2.5 py-2 rounded-lg border text-center transition-colors ${
                        active
                          ? cat.activeCls
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{cat.label}</div>
                      <div className={`text-[10px] ${active ? 'text-white/90' : 'text-slate-500'}`}>
                        {cat.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {EXPOSURE_CATEGORY_INFO[exposureCategory].description}
              </p>
            </div>
          </div>

          {/* Right Panel: Calculated Exact Vaccination Dates & Safety Guidance */}
          <div className="lg:col-span-7 space-y-5">
            {!schedulePlan ? (
              <div className="p-6 rounded-xl bg-white border border-slate-200 text-center text-sm text-slate-500">
                Select a valid Day 0 calendar date on the left to generate your rabies vaccination
                dates.
              </div>
            ) : (
              <>
                {/* Protocol Summary Bar */}
                <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-teal-700">
                      <Syringe className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{schedulePlan.regimen.standardRef}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {schedulePlan.regimen.title}
                    </h3>
                    <p className="text-xs text-slate-500">{schedulePlan.regimen.route}</p>
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-[11px] text-slate-500">Course Completion</p>
                    <p
                      data-testid="rabies-completion-date"
                      className="text-sm font-mono font-bold tabular-nums text-emerald-700"
                    >
                      {schedulePlan.doses[schedulePlan.doses.length - 1]?.formattedDate}
                    </p>
                  </div>
                </div>

                {/* RIG & Emergency First Aid Banner */}
                <div
                  role={schedulePlan.rigUrgent ? 'alert' : 'status'}
                  className={`rounded-xl border p-4 space-y-1.5 text-xs ${
                    schedulePlan.rigUrgent
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-sm">
                    {schedulePlan.rigUrgent ? (
                      <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {schedulePlan.rigUrgent
                        ? 'Urgent Category III Notice: Rabies Immunoglobulin (RIG) + Vaccine Needed'
                        : 'Wound Care & Immunoglobulin (RIG) Guidance'}
                    </span>
                  </div>
                  <p className="leading-relaxed opacity-95">{schedulePlan.rigRecommendation}</p>
                  <p className="text-[11px] opacity-85">
                    <strong>Immediate first aid:</strong> Flush any bite or scratch thoroughly with
                    soap and running water for at least 15 minutes and apply antiseptic right away.
                  </p>
                </div>

                {/* Exact Dates Schedule Table */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
                    <span className="text-xs font-bold text-slate-700">
                      Exact Vaccination Dates ({schedulePlan.doses.length} Visits)
                    </span>
                    <span className="text-xs font-mono tabular-nums text-emerald-700">
                      {completedOffsets.filter((o) => schedulePlan.regimen.dayOffsets.includes(o)).length}/
                      {schedulePlan.doses.length} completed
                    </span>
                  </div>

                  <ul className="divide-y divide-slate-200/90" data-testid="rabies-dose-list">
                    {schedulePlan.doses.map((dose) => {
                      const isDone = completedOffsets.includes(dose.dayOffset);
                      const timingText = isDone
                        ? 'Completed'
                        : dose.status === 'today'
                          ? 'Due Today'
                          : dose.status === 'past'
                            ? `${Math.abs(dose.daysFromToday)}d ago`
                            : `In ${dose.daysFromToday} day${dose.daysFromToday === 1 ? '' : 's'}`;

                      return (
                        <li
                          key={dose.dayOffset}
                          className={`px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                            isDone ? 'bg-emerald-50' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleDoseCompleted(dose.dayOffset)}
                              aria-pressed={isDone}
                              aria-label={`Mark Dose ${dose.doseNumber} (${dose.dayLabel}) as ${
                                isDone ? 'incomplete' : 'completed'
                              }`}
                              className={`mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                                isDone
                                  ? 'bg-emerald-600 border-emerald-500 text-slate-900'
                                  : 'bg-white border-slate-300 text-transparent hover:border-emerald-300'
                              }`}
                            >
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            </button>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-sm font-bold ${
                                    isDone ? 'line-through text-slate-500' : 'text-slate-900'
                                  }`}
                                >
                                  Dose {dose.doseNumber} · {dose.dayLabel}
                                </span>
                                <span aria-hidden="true" className="text-slate-500">
                                  /
                                </span>
                                <span className="text-sm font-mono font-bold tabular-nums text-teal-700">
                                  {dose.weekday}, {dose.formattedDate}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                {dose.instruction}
                              </p>
                            </div>
                          </div>

                          <div className="pl-9 sm:pl-0 flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                isDone
                                  ? 'text-emerald-700'
                                  : dose.status === 'today'
                                    ? 'text-amber-700'
                                    : dose.status === 'past'
                                      ? 'text-rose-700'
                                      : 'text-sky-700'
                              }`}
                            >
                              {timingText}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums text-slate-500">
                              {dose.isoDate}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  <strong className="text-slate-700">Clinical note:</strong>{' '}
                  {schedulePlan.regimen.clinicalNote} If you ever miss a scheduled day, do NOT
                  restart from scratch—contact your clinic immediately to resume your next dose.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
