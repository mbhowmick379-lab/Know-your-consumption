import {
  buildStructuredReport,
  formatBulletList,
  formatKeyValueRows,
  formatNumberedList,
} from './reportFormatter.ts';

export interface LiquidStrengthPreset {
  id: string;
  label: string;
  medicationHint: string;
  mg: number;
  perMl: number;
}

export const LIQUID_STRENGTH_PRESETS: LiquidStrengthPreset[] = [
  { id: 'amox-125-5', label: '125 mg / 5 mL', medicationHint: 'Amoxicillin / Cephalexin (mild)', mg: 125, perMl: 5 },
  { id: 'amox-250-5', label: '250 mg / 5 mL', medicationHint: 'Amoxicillin / Cephalexin (standard)', mg: 250, perMl: 5 },
  { id: 'amox-400-5', label: '400 mg / 5 mL', medicationHint: 'Amoxicillin / Augmentin (high-dose)', mg: 400, perMl: 5 },
  { id: 'azith-200-5', label: '200 mg / 5 mL', medicationHint: 'Azithromycin suspension', mg: 200, perMl: 5 },
  { id: 'ibu-100-5', label: '100 mg / 5 mL', medicationHint: 'Children’s Ibuprofen', mg: 100, perMl: 5 },
  { id: 'acet-160-5', label: '160 mg / 5 mL', medicationHint: 'Children’s Acetaminophen', mg: 160, perMl: 5 },
  { id: 'cet-10-10', label: '10 mg / 10 mL', medicationHint: 'Cetirizine / Loratadine syrup', mg: 10, perMl: 10 },
  { id: 'custom-10-10', label: '100 mg / 10 mL', medicationHint: '10 mL bottle concentration', mg: 100, perMl: 10 },
];

export interface LiquidDoseInput {
  targetDoseMg: number;
  strengthMg: number;
  strengthPerMl: number;
  dosesPerDay?: number;
  courseDays?: number;
}

export interface LiquidDoseCalculation {
  singleDoseMl: number;
  singleDoseTeaspoons: number;
  concentrationMgPerMl: number;
  dailyVolumeMl: number | null;
  totalCourseVolumeMl: number | null;
  syringeCapacityMl: number;
  formulaText: string;
  safetyWarnings: string[];
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToHundredth(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateLiquidDoseMl(input: LiquidDoseInput): LiquidDoseCalculation | null {
  const { targetDoseMg, strengthMg, strengthPerMl, dosesPerDay, courseDays } = input;
  if (
    !Number.isFinite(targetDoseMg) ||
    !Number.isFinite(strengthMg) ||
    !Number.isFinite(strengthPerMl) ||
    targetDoseMg <= 0 ||
    strengthMg <= 0 ||
    strengthPerMl <= 0
  ) {
    return null;
  }

  const concentrationMgPerMl = strengthMg / strengthPerMl;
  const rawMl = (targetDoseMg * strengthPerMl) / strengthMg;
  const singleDoseMl = rawMl < 1 ? roundToHundredth(rawMl) : roundToTenth(rawMl);
  const singleDoseTeaspoons = roundToHundredth(singleDoseMl / 5);

  const validDosesPerDay =
    dosesPerDay !== undefined && Number.isFinite(dosesPerDay) && dosesPerDay > 0
      ? dosesPerDay
      : null;
  const validCourseDays =
    courseDays !== undefined && Number.isFinite(courseDays) && courseDays > 0
      ? courseDays
      : null;

  const dailyVolumeMl = validDosesPerDay ? roundToTenth(singleDoseMl * validDosesPerDay) : null;
  const totalCourseVolumeMl =
    dailyVolumeMl !== null && validCourseDays ? roundToTenth(dailyVolumeMl * validCourseDays) : null;

  let syringeCapacityMl = 5;
  if (singleDoseMl > 15) syringeCapacityMl = Math.ceil(singleDoseMl / 5) * 5;
  else if (singleDoseMl > 10) syringeCapacityMl = 15;
  else if (singleDoseMl > 5) syringeCapacityMl = 10;

  const safetyWarnings: string[] = [];
  if (singleDoseMl > 20) {
    safetyWarnings.push(
      `Calculated volume (${singleDoseMl} mL) is unusually large for a single oral dose. Double-check the bottle strength (${strengthMg} mg per ${strengthPerMl} mL) and target dose (${targetDoseMg} mg).`
    );
  }
  if (singleDoseMl < 0.25) {
    safetyWarnings.push(
      `Very small volume (${singleDoseMl} mL). Use a precision 1 mL pediatric oral syringe and confirm with your pharmacist.`
    );
  }
  if (strengthPerMl !== 5 && strengthPerMl !== 10 && strengthPerMl !== 1) {
    safetyWarnings.push(
      `Confirm your bottle label lists ${strengthMg} mg per ${strengthPerMl} mL (most syrups list mg per 5 mL or per 10 mL).`
    );
  }

  const formulaText = `(${targetDoseMg} mg × ${strengthPerMl} mL) ÷ ${strengthMg} mg = ${singleDoseMl} mL`;

  return {
    singleDoseMl,
    singleDoseTeaspoons,
    concentrationMgPerMl: roundToHundredth(concentrationMgPerMl),
    dailyVolumeMl,
    totalCourseVolumeMl,
    syringeCapacityMl,
    formulaText,
    safetyWarnings,
  };
}

/**
 * Extracts a single mg or mg range (e.g., "250 mg", "200 mg to 400 mg", "500mg")
 * and formats an exact mL dose string given bottle strength.
 */
export function computeMlRangeFromDoseText(
  doseText: string,
  strengthMg: number,
  strengthPerMl: number
): { formattedMl: string; formulaDetail: string } | null {
  if (
    !doseText ||
    !Number.isFinite(strengthMg) ||
    !Number.isFinite(strengthPerMl) ||
    strengthMg <= 0 ||
    strengthPerMl <= 0
  ) {
    return null;
  }

  // Match patterns like "200 mg to 400 mg", "200-400 mg", or single "250 mg"
  const rangeMatch = doseText.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:mg)?\s*(?:to|-|–)\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*mg/i);
  if (rangeMatch) {
    const lowMg = Number(rangeMatch[1].replace(/,/g, ''));
    const highMg = Number(rangeMatch[2].replace(/,/g, ''));
    const lowCalc = calculateLiquidDoseMl({ targetDoseMg: lowMg, strengthMg, strengthPerMl });
    const highCalc = calculateLiquidDoseMl({ targetDoseMg: highMg, strengthMg, strengthPerMl });
    if (lowCalc && highCalc) {
      return {
        formattedMl: `${lowCalc.singleDoseMl} mL to ${highCalc.singleDoseMl} mL`,
        formulaDetail: `Using ${strengthMg} mg per ${strengthPerMl} mL: ${lowMg} mg = ${lowCalc.singleDoseMl} mL; ${highMg} mg = ${highCalc.singleDoseMl} mL.`,
      };
    }
  }

  const singleMatch = doseText.match(/(\d+(?:,\d{3})*(?:\.\d+)?)\s*mg/i);
  if (singleMatch) {
    const mg = Number(singleMatch[1].replace(/,/g, ''));
    const calc = calculateLiquidDoseMl({ targetDoseMg: mg, strengthMg, strengthPerMl });
    if (calc) {
      return {
        formattedMl: `${calc.singleDoseMl} mL per dose`,
        formulaDetail: `Using ${strengthMg} mg per ${strengthPerMl} mL: ${calc.formulaText} (~${calc.singleDoseTeaspoons} tsp).`,
      };
    }
  }

  return null;
}

export function formatLiquidPlanText(params: {
  medicationName: string;
  patientName?: string;
  targetDoseMg: number;
  strengthMg: number;
  strengthPerMl: number;
  dosesPerDay?: number;
  courseDays?: number;
  calc: LiquidDoseCalculation;
}): string {
  const {
    medicationName,
    patientName,
    targetDoseMg,
    strengthMg,
    strengthPerMl,
    dosesPerDay,
    courseDays,
    calc,
  } = params;

  const sections = [
    {
      title: 'Patient & Bottle Parameters',
      lines: formatKeyValueRows([
        { label: 'Patient Name', value: patientName || 'Patient Self-Calculation' },
        { label: 'Medication', value: medicationName || 'Liquid Medication / Suspension' },
        {
          label: 'Bottle Strength',
          value: `${strengthMg} mg per ${strengthPerMl} mL (${calc.concentrationMgPerMl} mg/mL)`,
        },
        { label: 'Target Single Dose', value: `${targetDoseMg} mg` },
      ]),
    },
    {
      title: 'Exact Liquid Volume to Give',
      lines: formatKeyValueRows([
        {
          label: 'Single Dose Volume',
          value: `${calc.singleDoseMl} mL (approx. ${calc.singleDoseTeaspoons} measuring teaspoon)`,
        },
        { label: 'Calculation Formula', value: calc.formulaText },
        { label: 'Recommended Syringe', value: `${calc.syringeCapacityMl} mL oral dosing syringe` },
      ]),
    },
    ...(calc.dailyVolumeMl !== null || calc.totalCourseVolumeMl !== null
      ? [
          {
            title: 'Daily & Full-Course Volume Totals',
            lines: formatKeyValueRows([
              {
                label: 'Doses Per Day',
                value: dosesPerDay ? `${dosesPerDay} doses/day` : null,
              },
              {
                label: 'Total Daily Volume',
                value: calc.dailyVolumeMl !== null ? `${calc.dailyVolumeMl} mL per day` : null,
              },
              {
                label: 'Course Duration',
                value: courseDays ? `${courseDays} days` : null,
              },
              {
                label: 'Total Course Volume',
                value:
                  calc.totalCourseVolumeMl !== null
                    ? `${calc.totalCourseVolumeMl} mL total needed`
                    : null,
              },
            ]),
          },
        ]
      : []),
    {
      title: 'Safe Measuring Instructions & Flags',
      lines: [
        ...(calc.safetyWarnings.length > 0
          ? ['Safety Flags:', ...formatBulletList(calc.safetyWarnings), '']
          : []),
        'Measuring Steps:',
        ...formatNumberedList([
          'Always shake liquid antibiotic suspensions thoroughly before measuring each dose.',
          'Measure using a marked oral mL dosing syringe or pharmacy cup — NEVER a household kitchen spoon.',
          'Double-check the concentration printed on the bottle label before giving every dose.',
        ]),
      ],
    },
  ];

  return buildStructuredReport({
    reportTitle: 'Liquid Dosage (mL) Measurement Sheet',
    reportCode: 'ML',
    sections,
  });
}
