import {
  buildStructuredReport,
  formatKeyValueRows,
  formatNumberedList,
  wrapText,
} from './reportFormatter.ts';

export type RabiesRegimenId =
  | 'pep-4-im'
  | 'pep-5-im'
  | 'pep-id-who'
  | 'pep-booster'
  | 'prep-2';

export type RabiesExposureCategory = 'cat-1' | 'cat-2' | 'cat-3';

export interface RabiesRegimenDefinition {
  id: RabiesRegimenId;
  shortLabel: string;
  title: string;
  route: string;
  audience: string;
  dayOffsets: number[];
  standardRef: string;
  clinicalNote: string;
}

export interface RabiesDoseDateItem {
  doseNumber: number;
  dayOffset: number;
  dayLabel: string;
  isoDate: string;
  formattedDate: string;
  weekday: string;
  status: 'past' | 'today' | 'upcoming';
  daysFromToday: number;
  instruction: string;
}

export interface RabiesSchedulePlan {
  regimen: RabiesRegimenDefinition;
  startDateIso: string;
  exposureCategory: RabiesExposureCategory;
  rigRecommendation: string;
  rigUrgent: boolean;
  doses: RabiesDoseDateItem[];
  completionIsoDate: string;
}

export const RABIES_REGIMENS: RabiesRegimenDefinition[] = [
  {
    id: 'pep-4-im',
    shortLabel: 'PEP 4-Dose IM (Days 0, 3, 7, 14)',
    title: 'Post-Exposure 4-Dose Intramuscular (Essen / CDC Standard)',
    route: '1 Intramuscular (IM) dose per visit (deltoid in adults, thigh in young children)',
    audience: 'Previously unvaccinated healthy (immunocompetent) patients after animal bite or scratch',
    dayOffsets: [0, 3, 7, 14],
    standardRef: 'CDC ACIP & WHO Updated Essen Regimen',
    clinicalNote:
      'Never inject rabies vaccine in the gluteal (buttock) area, as this reduces immune protection.',
  },
  {
    id: 'pep-5-im',
    shortLabel: 'PEP 5-Dose IM (Days 0, 3, 7, 14, 28)',
    title: 'Post-Exposure 5-Dose Intramuscular (Extended / Immunocompromised)',
    route: '1 Intramuscular (IM) dose per visit (deltoid or anterolateral thigh)',
    audience: 'Immunocompromised patients or national protocols requiring the full 5-dose Essen course',
    dayOffsets: [0, 3, 7, 14, 28],
    standardRef: 'WHO Classic Essen & CDC Immunocompromised Protocol',
    clinicalNote:
      'Recommended for immunocompromised patients (along with antibody titer testing after Day 28) or clinics following the 5-dose standard.',
  },
  {
    id: 'pep-id-who',
    shortLabel: 'WHO Intradermal (Days 0, 3, 7)',
    title: 'WHO 1-Week 2-Site Intradermal Schedule (IPC Regimen)',
    route: '2 Intradermal (ID) injections (0.1 mL at 2 deltoid sites) on each visit',
    audience: 'Clinics offering WHO 2018 dose-sparing intradermal rabies vaccination',
    dayOffsets: [0, 3, 7],
    standardRef: 'WHO 2018 Rabies Vaccine Position Paper (IPC)',
    clinicalNote:
      'Must be administered strictly intradermally by a trained clinician at two sites per visit.',
  },
  {
    id: 'pep-booster',
    shortLabel: 'Previously Vaccinated (Days 0, 3)',
    title: 'Post-Exposure Booster (Previously Vaccinated Patient)',
    route: '1 IM (or 1-site ID) booster dose on Day 0 and Day 3',
    audience: 'Patients who have documented complete prior rabies vaccination (PrEP or prior PEP)',
    dayOffsets: [0, 3],
    standardRef: 'WHO & CDC Previously Immunized Booster Guideline',
    clinicalNote:
      'Rabies Immunoglobulin (RIG) is NOT required if you have a documented complete prior rabies vaccine series.',
  },
  {
    id: 'prep-2',
    shortLabel: 'Pre-Exposure PrEP (Days 0, 7)',
    title: 'Pre-Exposure Prophylaxis (Preventive 2-Dose Schedule)',
    route: '1 IM (or 2-site ID) dose on Day 0 and Day 7',
    audience: 'Travelers, veterinarians, animal handlers, and residents in rabies-endemic areas',
    dayOffsets: [0, 7],
    standardRef: 'WHO 2018 & CDC 2022 2-Dose PrEP Recommendation',
    clinicalNote:
      'Even after PrEP, any future bite/scratch still requires immediate wound washing and 2 booster doses (Days 0 & 3).',
  },
];

export const EXPOSURE_CATEGORY_INFO: Record<
  RabiesExposureCategory,
  { label: string; description: string }
> = {
  'cat-1': {
    label: 'Category I (Touching / Licks on Intact Skin)',
    description: 'Touching or feeding animals, or licks on unbroken intact skin. Wash skin; vaccine usually not needed.',
  },
  'cat-2': {
    label: 'Category II (Nibbling / Minor Scratch Without Bleeding)',
    description: 'Nibbling of uncovered skin or minor scratches/abrasions without bleeding. Immediate wound wash + vaccine.',
  },
  'cat-3': {
    label: 'Category III (Transdermal Bite / Bleeding Scratch / Mucosa)',
    description: 'Single or multiple bites/scratches breaking skin with bleeding, or saliva on broken skin/mucous membranes. Immediate wound wash + Vaccine + RIG.',
  },
};

function parseIsoDateLocal(isoDate: string): Date | null {
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function addUtcDays(isoDate: string, daysToAdd: number): string | null {
  const base = parseIsoDateLocal(isoDate);
  if (!base || !Number.isFinite(daysToAdd)) return null;
  const next = new Date(base.getTime() + daysToAdd * 86_400_000);
  const y = next.getUTCFullYear();
  const m = String(next.getUTCMonth() + 1).padStart(2, '0');
  const d = String(next.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatUtcDate(isoDate: string): { formattedDate: string; weekday: string } {
  const d = parseIsoDateLocal(isoDate);
  if (!d) return { formattedDate: isoDate, weekday: '' };
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(d);
  return { formattedDate, weekday };
}

export function buildRabiesSchedule(params: {
  startDateIso: string;
  regimenId: RabiesRegimenId;
  exposureCategory: RabiesExposureCategory;
  referenceTodayIso?: string;
}): RabiesSchedulePlan | null {
  const regimen = RABIES_REGIMENS.find((r) => r.id === params.regimenId) ?? RABIES_REGIMENS[0];
  const baseDate = parseIsoDateLocal(params.startDateIso);
  if (!baseDate) return null;

  const todayIso = params.referenceTodayIso || getTodayIsoDate();
  const todayDate = parseIsoDateLocal(todayIso) ?? baseDate;

  const doses: RabiesDoseDateItem[] = regimen.dayOffsets.map((offset, idx) => {
    const isoDate = addUtcDays(params.startDateIso, offset) ?? params.startDateIso;
    const doseDate = parseIsoDateLocal(isoDate) ?? baseDate;
    const diffDays = Math.round((doseDate.getTime() - todayDate.getTime()) / 86_400_000);
    const status: 'past' | 'today' | 'upcoming' =
      diffDays < 0 ? 'past' : diffDays === 0 ? 'today' : 'upcoming';
    const { formattedDate, weekday } = formatUtcDate(isoDate);

    let instruction = 'Visit clinic on schedule for scheduled vaccine dose.';
    if (offset === 0) {
      instruction =
        params.regimenId === 'prep-2'
          ? 'Initial preventive dose (Day 0).'
          : 'Wash wound 15 min with soap & water immediately. Receive Day 0 dose (+ RIG if Category III unvaccinated).';
    } else if (idx === regimen.dayOffsets.length - 1) {
      instruction = 'Final dose of this schedule — keep written vaccination card for lifelong records.';
    }

    return {
      doseNumber: idx + 1,
      dayOffset: offset,
      dayLabel: `Day ${offset}`,
      isoDate,
      formattedDate,
      weekday,
      status,
      daysFromToday: diffDays,
      instruction,
    };
  });

  const isUnvaccinatedPep =
    params.regimenId === 'pep-4-im' ||
    params.regimenId === 'pep-5-im' ||
    params.regimenId === 'pep-id-who';

  let rigUrgent = false;
  let rigRecommendation =
    'Rabies Immunoglobulin (RIG) is not indicated for preventive PrEP or previously vaccinated booster patients.';

  if (isUnvaccinatedPep) {
    if (params.exposureCategory === 'cat-3') {
      rigUrgent = true;
      rigRecommendation =
        'CATEGORY III ALERT: Rabies Immunoglobulin (HRIG/ERIG) is strongly recommended as soon as possible (on Day 0, or within 7 days of first dose) infiltrated into/around the wound alongside the vaccine.';
    } else if (params.exposureCategory === 'cat-2') {
      rigRecommendation =
        'Category II exposure: Immediate 15-minute soap & water wound wash + full vaccine series. RIG is generally not needed unless the patient is severely immunocompromised.';
    } else {
      rigRecommendation =
        'Category I contact (intact skin only): Wash exposed area thoroughly with soap and water. Confirm with a doctor whether vaccination is needed.';
    }
  }

  return {
    regimen,
    startDateIso: params.startDateIso,
    exposureCategory: params.exposureCategory,
    rigRecommendation,
    rigUrgent,
    doses,
    completionIsoDate: doses[doses.length - 1]?.isoDate ?? params.startDateIso,
  };
}

export function formatRabiesScheduleText(plan: RabiesSchedulePlan, patientName?: string): string {
  const doseLines = plan.doses.flatMap((d) => [
    `  ${d.doseNumber}. Dose ${d.doseNumber} (${d.dayLabel}) — ${d.weekday}, ${d.formattedDate} [${d.isoDate}]`,
    ...wrapText(`Action: ${d.instruction}`, 76, '     ', '     '),
  ]);

  return buildStructuredReport({
    reportTitle: 'Rabies Vaccination Schedule & Dates',
    reportCode: 'RABIES',
    sections: [
      {
        title: 'Patient & Regimen Overview',
        lines: formatKeyValueRows([
          { label: 'Patient Name', value: patientName || 'Patient' },
          { label: 'Protocol', value: plan.regimen.title },
          { label: 'Clinical Standard', value: plan.regimen.standardRef },
          { label: 'Administration Route', value: plan.regimen.route },
          { label: 'Day 0 (Start Date)', value: plan.startDateIso },
          { label: 'Course Completion', value: plan.completionIsoDate },
          { label: 'Exposure Category', value: EXPOSURE_CATEGORY_INFO[plan.exposureCategory].label },
          { label: 'Total Visits', value: `${plan.doses.length} scheduled doses` },
        ]),
      },
      {
        title: 'Exact Vaccination Dates (Chronological Sequence)',
        lines: doseLines,
      },
      {
        title: 'Wound Care & Immunoglobulin (RIG) Guidance',
        lines: [
          ...formatNumberedList([
            plan.rigRecommendation,
            `Immediate First Aid: Flush any bite or scratch thoroughly with soap and running water for at least 15 minutes and apply antiseptic (povidone-iodine or 70% ethanol).`,
            `Clinical Note: ${plan.regimen.clinicalNote}`,
          ]),
        ],
      },
    ],
    disclaimer:
      'Always confirm your exact rabies vaccination schedule and immunoglobulin eligibility immediately with an emergency physician or authorized rabies clinic.',
  });
}

export function buildRabiesScheduleIcs(plan: RabiesSchedulePlan, patientName?: string): string {
  const nowStamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const events = plan.doses.map((dose) => {
    const dtStart = dose.isoDate.replace(/-/g, '');
    const nextIso = addUtcDays(dose.isoDate, 1) ?? dose.isoDate;
    const dtEnd = nextIso.replace(/-/g, '');
    const summary = `Rabies Vaccine Dose ${dose.doseNumber} (${dose.dayLabel}) — KYC`;
    const desc = `${plan.regimen.title}. ${dose.instruction} Patient: ${patientName || 'Patient'}.`;
    return [
      'BEGIN:VEVENT',
      `UID:kyc-rabies-${plan.regimen.id}-d${dose.dayOffset}-${dtStart}@kyc`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Know Your Consumption(KYC)//Rabies Schedule//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}
