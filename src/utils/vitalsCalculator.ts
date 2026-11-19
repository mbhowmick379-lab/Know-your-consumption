import {
  buildStructuredReport,
  formatBulletList,
  formatKeyValueRows,
  formatNumberedList,
  wrapText,
} from './reportFormatter.ts';

export type VitalStatus = 'low' | 'normal' | 'high';
export type VitalUrgency = 'normal' | 'caution' | 'high' | 'urgent';
export type SugarTestType = 'fasting' | 'postprandial' | 'random';
export type SugarUnit = 'mg/dL' | 'mmol/L';

export interface BloodPressureInput {
  systolic: number;
  diastolic: number;
  pulse?: number | null;
}

export interface BloodPressureResult {
  systolic: number;
  diastolic: number;
  pulse: number | null;
  status: VitalStatus;
  statusLabel: 'Low' | 'Normal' | 'High';
  category: string;
  urgency: VitalUrgency;
  pulsePressure: number;
  meanArterialPressure: number;
  meterPercent: number;
  summary: string;
  pulseNote: string | null;
  advice: string[];
  warningSigns: string[];
  referenceRange: string;
}

export interface BloodSugarInput {
  value: number;
  unit: SugarUnit;
  testType: SugarTestType;
  hba1c?: number | null;
}

export interface BloodSugarResult {
  inputValue: number;
  unit: SugarUnit;
  mgDl: number;
  mmolL: number;
  testType: SugarTestType;
  testTypeLabel: string;
  status: VitalStatus;
  statusLabel: 'Low' | 'Normal' | 'High';
  category: string;
  urgency: VitalUrgency;
  meterPercent: number;
  summary: string;
  hba1cAssessment: {
    percent: number;
    status: VitalStatus;
    category: string;
    estimatedAvgMgDl: number;
  } | null;
  advice: string[];
  warningSigns: string[];
  referenceRange: string;
}

export interface CombinedVitalsEvaluation {
  bp: BloodPressureResult | null;
  sugar: BloodSugarResult | null;
  overallStatus: VitalStatus;
  overallHeadline: string;
  combinedInsight: string;
  urgentAlert: string | null;
  evaluatedAt: string;
}

const MMOL_TO_MGDL = 18.0182;

export function convertSugarToMgDl(value: number, unit: SugarUnit): number {
  if (unit === 'mmol/L') {
    return Number((value * MMOL_TO_MGDL).toFixed(1));
  }
  return Number(value.toFixed(1));
}

export function convertSugarToMmolL(mgDl: number): number {
  return Number((mgDl / MMOL_TO_MGDL).toFixed(1));
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function evaluateBloodPressure(input: BloodPressureInput): BloodPressureResult {
  const systolic = Math.round(input.systolic);
  const diastolic = Math.round(input.diastolic);
  const pulse =
    input.pulse !== null && input.pulse !== undefined && Number.isFinite(input.pulse)
      ? Math.round(input.pulse)
      : null;

  if (!Number.isFinite(systolic) || systolic < 40 || systolic > 300) {
    throw new Error('Systolic blood pressure must be between 40 and 300 mmHg.');
  }
  if (!Number.isFinite(diastolic) || diastolic < 25 || diastolic > 200) {
    throw new Error('Diastolic blood pressure must be between 25 and 200 mmHg.');
  }
  if (systolic <= diastolic) {
    throw new Error('Systolic (top number) must be higher than Diastolic (bottom number).');
  }
  if (pulse !== null && (pulse < 25 || pulse > 240)) {
    throw new Error('Optional heart rate (pulse) must be between 25 and 240 bpm.');
  }

  const pulsePressure = systolic - diastolic;
  const meanArterialPressure = Math.round(diastolic + pulsePressure / 3);

  let pulseNote: string | null = null;
  if (pulse !== null) {
    if (pulse < 60) {
      pulseNote = `Resting pulse ${pulse} bpm is below 60 bpm (bradycardia range — normal in well-trained athletes, but evaluate if dizzy or fatigued).`;
    } else if (pulse > 100) {
      pulseNote = `Resting pulse ${pulse} bpm is above 100 bpm (tachycardia range — recheck after 5 minutes of calm rest, and seek care if accompanied by palpitations or shortness of breath).`;
    } else {
      pulseNote = `Resting pulse ${pulse} bpm is within the normal adult range (60–100 bpm).`;
    }
  }

  // Hypertensive Crisis (ACC/AHA: >= 180 systolic OR >= 120 diastolic)
  if (systolic >= 180 || diastolic >= 120) {
    return {
      systolic,
      diastolic,
      pulse,
      status: 'high',
      statusLabel: 'High',
      category: 'Hypertensive Crisis (Very High)',
      urgency: 'urgent',
      pulsePressure,
      meanArterialPressure,
      meterPercent: 98,
      summary: `Your reading of ${systolic}/${diastolic} mmHg is dangerously high (Hypertensive Crisis threshold ≥ 180/120 mmHg) and needs immediate medical attention.`,
      pulseNote,
      advice: [
        'Sit quietly for 5 minutes and take one confirmatory reading with your arm supported at heart level.',
        'If your reading remains ≥ 180/120 mmHg AND you have any chest pain, shortness of breath, vision changes, weakness, or severe headache, call emergency services immediately.',
        'Even without symptoms, contact a doctor or urgent care clinic right away — do not wait to see if it comes down on its own.',
        'Do NOT take extra unprescribed blood pressure pills without a doctor’s instruction, as dropping BP too fast can also be unsafe.',
      ],
      warningSigns: [
        'Chest pain, tightness, or pressure',
        'Shortness of breath or trouble speaking',
        'Numbness, weakness on one side, or blurred vision',
        'Severe sudden headache or confusion',
      ],
      referenceRange: 'Normal adult BP: 90–119 / 60–79 mmHg (ACC/AHA)',
    };
  }

  // Stage 2 Hypertension (ACC/AHA: >= 140 systolic OR >= 90 diastolic)
  if (systolic >= 140 || diastolic >= 90) {
    return {
      systolic,
      diastolic,
      pulse,
      status: 'high',
      statusLabel: 'High',
      category: 'High Blood Pressure (Stage 2)',
      urgency: 'high',
      pulsePressure,
      meanArterialPressure,
      meterPercent: clamp(74 + ((Math.max(systolic - 140, (diastolic - 90) * 1.5)) / 40) * 20, 74, 94),
      summary: `Your blood pressure of ${systolic}/${diastolic} mmHg falls in the Stage 2 High Blood Pressure range (≥ 140/90 mmHg).`,
      pulseNote,
      advice: [
        'Rest calmly for 5 minutes with feet flat on the floor and recheck; record morning and evening readings for 7 days to share with your physician.',
        'Schedule a prompt doctor visit — Stage 2 hypertension typically benefits from prescription blood pressure therapy alongside lifestyle changes.',
        'Reduce daily sodium intake below 1,500–2,000 mg (avoid packaged snacks, pickles, instant noodles, and excess table salt) and follow a potassium-rich DASH-style diet.',
        'Limit caffeine, alcohol, and NSAID painkillers (like ibuprofen/diclofenac), which can raise blood pressure further.',
      ],
      warningSigns: [
        'Reading rises to ≥ 180/120 mmHg',
        'Chest discomfort, dizziness, or severe headache',
        'New swelling in ankles or shortness of breath',
      ],
      referenceRange: 'Normal adult BP: 90–119 / 60–79 mmHg (ACC/AHA)',
    };
  }

  // Stage 1 Hypertension (ACC/AHA: 130–139 systolic OR 80–89 diastolic)
  if (systolic >= 130 || diastolic >= 80) {
    return {
      systolic,
      diastolic,
      pulse,
      status: 'high',
      statusLabel: 'High',
      category: 'High Blood Pressure (Stage 1)',
      urgency: 'caution',
      pulsePressure,
      meanArterialPressure,
      meterPercent: clamp(58 + ((Math.max(systolic - 130, (diastolic - 80) * 1.2)) / 10) * 14, 58, 72),
      summary: `Your blood pressure of ${systolic}/${diastolic} mmHg is in the Stage 1 High Blood Pressure range (130–139 / 80–89 mmHg).`,
      pulseNote,
      advice: [
        'Track your blood pressure at home 2–3 times per week (at rest, before caffeine or exercise) and review the trend with your healthcare provider.',
        'Adopt heart-healthy daily habits: aim for 30 minutes of brisk walking most days, cut added sodium, and eat more leafy greens, fruits, and whole grains.',
        'Prioritize 7–8 hours of quality sleep and stress reduction (deep breathing or short breaks), as stress and poor sleep spike BP.',
        'If you also have diabetes, kidney disease, or heart disease, ask your doctor whether medication is recommended at Stage 1.',
      ],
      warningSigns: [
        'Repeated readings climbing above 140/90 mmHg',
        'Persistent headaches, visual changes, or chest discomfort',
      ],
      referenceRange: 'Normal adult BP: 90–119 / 60–79 mmHg (ACC/AHA)',
    };
  }

  // Elevated Blood Pressure (ACC/AHA: 120–129 systolic AND < 80 diastolic)
  if (systolic >= 120 && diastolic >= 60) {
    return {
      systolic,
      diastolic,
      pulse,
      status: 'high',
      statusLabel: 'High',
      category: 'Elevated Blood Pressure (Borderline High)',
      urgency: 'caution',
      pulsePressure,
      meanArterialPressure,
      meterPercent: clamp(47 + ((systolic - 120) / 10) * 10, 47, 57),
      summary: `Your blood pressure of ${systolic}/${diastolic} mmHg is slightly above normal (Elevated / Borderline High: 120–129 systolic and < 80 diastolic).`,
      pulseNote,
      advice: [
        'Early lifestyle tweaks now can bring your BP back into the optimal normal range without medication.',
        'Trim salty processed foods, stay active for at least 150 minutes per week, and keep well hydrated.',
        'Re-check your blood pressure once a week after sitting quietly for 5 minutes to ensure it does not drift into Stage 1 (≥ 130/80).',
      ],
      warningSigns: [
        'Readings consistently crossing 130/80 mmHg over several weeks',
      ],
      referenceRange: 'Normal adult BP: 90–119 / 60–79 mmHg (ACC/AHA)',
    };
  }

  // Low Blood Pressure / Hypotension (< 90 systolic OR < 60 diastolic)
  if (systolic < 90 || diastolic < 60) {
    const severeLow = systolic < 80 || diastolic < 50;
    return {
      systolic,
      diastolic,
      pulse,
      status: 'low',
      statusLabel: 'Low',
      category: severeLow ? 'Severely Low Blood Pressure (Hypotension)' : 'Low Blood Pressure (Hypotension)',
      urgency: severeLow ? 'urgent' : 'caution',
      pulsePressure,
      meanArterialPressure,
      meterPercent: severeLow ? 8 : 18,
      summary: severeLow
        ? `Your reading of ${systolic}/${diastolic} mmHg is very low (below 80/50 mmHg) and may reduce blood flow to vital organs.`
        : `Your blood pressure of ${systolic}/${diastolic} mmHg is in the Low Blood Pressure (Hypotension) range (< 90/60 mmHg).`,
      pulseNote,
      advice: [
        'Sit or lie down safely and elevate your legs slightly if you feel lightheaded, dizzy, or faint.',
        'Drink 1–2 glasses of water or an oral rehydration / electrolyte solution slowly to help restore blood volume.',
        'Stand up gradually from sitting or lying positions to prevent sudden dizziness (orthostatic drops).',
        'Review any blood pressure medications, diuretics, or skipped meals with your doctor — never stop prescribed heart medicines abruptly without medical advice.',
      ],
      warningSigns: [
        'Fainting, confusion, or inability to stay alert',
        'Cold, clammy, or pale skin with rapid shallow breathing',
        'Chest pain, very fast heartbeat, or minimal urination',
      ],
      referenceRange: 'Normal adult BP: 90–119 / 60–79 mmHg (ACC/AHA)',
    };
  }

  // Normal Blood Pressure (90–119 systolic AND 60–79 diastolic)
  return {
    systolic,
    diastolic,
    pulse,
    status: 'normal',
    statusLabel: 'Normal',
    category: 'Normal Blood Pressure',
    urgency: 'normal',
    pulsePressure,
    meanArterialPressure,
    meterPercent: clamp(28 + ((systolic - 90) / 30) * 16, 28, 44),
    summary: `Great news — your blood pressure of ${systolic}/${diastolic} mmHg is within the healthy normal range (90–119 / 60–79 mmHg).`,
    pulseNote,
    advice: [
      'Keep up your healthy routine: balanced whole-food meals, regular physical movement (150 min/week), and good sleep.',
      'Continue keeping sodium intake moderate and staying hydrated throughout the day.',
      'Check your blood pressure periodically (every few months, or as advised by your doctor) to maintain this healthy baseline.',
    ],
    warningSigns: [
      'Seek care if you ever develop sudden dizziness, chest pain, or unexpected spikes above 140/90 mmHg.',
    ],
    referenceRange: 'Normal adult BP: 90–119 / 60–79 mmHg (ACC/AHA)',
  };
}

const TEST_TYPE_LABELS: Record<SugarTestType, string> = {
  fasting: 'Fasting (8+ hrs no food)',
  postprandial: 'After Meal (2-hr Postprandial)',
  random: 'Random / Any Time',
};

export function evaluateBloodSugar(input: BloodSugarInput): BloodSugarResult {
  const { unit, testType } = input;
  const rawVal = Number(input.value);

  if (!Number.isFinite(rawVal) || rawVal <= 0) {
    throw new Error('Enter a valid positive blood sugar reading.');
  }

  const mgDl = convertSugarToMgDl(rawVal, unit);
  const mmolL = unit === 'mmol/L' ? Number(rawVal.toFixed(1)) : convertSugarToMmolL(mgDl);

  if (mgDl < 20 || mgDl > 900) {
    throw new Error(
      unit === 'mmol/L'
        ? 'Blood sugar reading must be between 1.1 and 50.0 mmol/L.'
        : 'Blood sugar reading must be between 20 and 900 mg/dL.'
    );
  }

  let hba1cAssessment: BloodSugarResult['hba1cAssessment'] = null;
  if (input.hba1c !== null && input.hba1c !== undefined && Number.isFinite(input.hba1c)) {
    const a1c = Number(input.hba1c.toFixed(1));
    if (a1c < 3 || a1c > 20) {
      throw new Error('Optional HbA1c must be between 3.0% and 20.0%.');
    }
    const estimatedAvgMgDl = Math.round(28.7 * a1c - 46.7);
    if (a1c >= 6.5) {
      hba1cAssessment = {
        percent: a1c,
        status: 'high',
        category: 'Diabetes Range (≥ 6.5%)',
        estimatedAvgMgDl,
      };
    } else if (a1c >= 5.7) {
      hba1cAssessment = {
        percent: a1c,
        status: 'high',
        category: 'Prediabetes Range (5.7%–6.4%)',
        estimatedAvgMgDl,
      };
    } else {
      hba1cAssessment = {
        percent: a1c,
        status: 'normal',
        category: 'Normal 3-Month Average (< 5.7%)',
        estimatedAvgMgDl,
      };
    }
  }

  const testTypeLabel = TEST_TYPE_LABELS[testType];
  const referenceRange =
    testType === 'fasting'
      ? 'Normal Fasting: 70–99 mg/dL (3.9–5.5 mmol/L) · ADA/WHO'
      : 'Normal 2-hr Post-Meal / Random: 70–139 mg/dL (3.9–7.7 mmol/L) · ADA/WHO';

  // Severe Hypoglycemia (< 54 mg/dL / < 3.0 mmol/L)
  if (mgDl < 54) {
    return {
      inputValue: Number(rawVal.toFixed(1)),
      unit,
      mgDl,
      mmolL,
      testType,
      testTypeLabel,
      status: 'low',
      statusLabel: 'Low',
      category: 'Very Low Blood Sugar (Severe Hypoglycemia)',
      urgency: 'urgent',
      meterPercent: 6,
      summary: `Your blood sugar of ${mgDl} mg/dL (${mmolL} mmol/L) is dangerously low (< 54 mg/dL) and requires immediate treatment right now.`,
      hba1cAssessment,
      advice: [
        'Act immediately using the Rule of 15 (if awake and able to swallow safely): take 15–20 grams of fast-acting sugar right now (3–4 glucose tablets, ½ cup fruit juice or regular soda, or 1 tablespoon honey/sugar).',
        'Wait 15 minutes and recheck your blood sugar. Repeat another 15 g of fast-acting carbs if still below 70 mg/dL (3.9 mmol/L).',
        'Once above 70 mg/dL, eat a balanced snack with protein and complex carbs (e.g., crackers with peanut butter or cheese) to prevent another drop.',
        'If the person is confused, drowsy, having a seizure, or cannot swallow, do NOT give food/drink by mouth — administer emergency glucagon if available and call emergency services immediately.',
      ],
      warningSigns: [
        'Confusion, slurred speech, or inability to follow instructions',
        'Extreme drowsiness, fainting, or seizures',
        'Blood sugar remaining below 70 mg/dL after two rounds of fast carbs',
      ],
      referenceRange,
    };
  }

  // Level 1 Hypoglycemia (54 – 69 mg/dL / 3.0 – 3.8 mmol/L)
  if (mgDl < 70) {
    return {
      inputValue: Number(rawVal.toFixed(1)),
      unit,
      mgDl,
      mmolL,
      testType,
      testTypeLabel,
      status: 'low',
      statusLabel: 'Low',
      category: 'Low Blood Sugar (Hypoglycemia)',
      urgency: 'caution',
      meterPercent: 18,
      summary: `Your blood sugar of ${mgDl} mg/dL (${mmolL} mmol/L) is below the normal safe floor of 70 mg/dL (3.9 mmol/L).`,
      hba1cAssessment,
      advice: [
        'Follow the Rule of 15: take 15 g of fast-acting carbohydrates right away (e.g., 4 oz / 120 mL fruit juice, 3–4 glucose tablets, or 1 tbsp sugar in water).',
        'Re-test after 15 minutes to confirm your glucose has climbed back above 70 mg/dL (3.9 mmol/L).',
        'Avoid driving or operating machinery until your blood sugar is safely back in the normal range and symptoms resolve.',
        'If you take insulin or sulfonylureas (e.g., glimepiride, glibenclamide) and get frequent lows, ask your doctor to review your dose.',
      ],
      warningSigns: [
        'Shaking, sweating, fast heartbeat, or sudden anxiety',
        'Worsening dizziness, confusion, or vision blurring',
      ],
      referenceRange,
    };
  }

  // Test-type specific thresholds for Normal / Elevated / High / Very High
  const normalMax = testType === 'fasting' ? 99 : 139;
  const borderlineMax = testType === 'fasting' ? 125 : 199;
  const urgentThreshold = testType === 'fasting' ? 250 : 300;

  // Normal Blood Sugar
  if (mgDl <= normalMax) {
    return {
      inputValue: Number(rawVal.toFixed(1)),
      unit,
      mgDl,
      mmolL,
      testType,
      testTypeLabel,
      status: 'normal',
      statusLabel: 'Normal',
      category: 'Normal Blood Sugar',
      urgency: 'normal',
      meterPercent: clamp(28 + ((mgDl - 70) / (normalMax - 70)) * 18, 28, 46),
      summary: `Your ${testTypeLabel.toLowerCase()} blood sugar of ${mgDl} mg/dL (${mmolL} mmol/L) is right inside the healthy normal range.`,
      hba1cAssessment,
      advice: [
        'Maintain steady blood sugar with fiber-rich vegetables, lean proteins, healthy fats, and whole grains.',
        'A light 10–15 minute walk after meals naturally supports healthy insulin sensitivity.',
        'Stay hydrated with plain water and continue routine periodic health screenings as recommended by your physician.',
      ],
      warningSigns: [
        'Consult a clinician if you ever notice unexplained excessive thirst, frequent urination, or sudden fatigue.',
      ],
      referenceRange,
    };
  }

  // Elevated / Prediabetes / Borderline High
  if (mgDl <= borderlineMax) {
    return {
      inputValue: Number(rawVal.toFixed(1)),
      unit,
      mgDl,
      mmolL,
      testType,
      testTypeLabel,
      status: 'high',
      statusLabel: 'High',
      category:
        testType === 'random'
          ? 'Borderline High Blood Sugar (Recheck Fasting)'
          : 'Elevated Blood Sugar (Prediabetes Range)',
      urgency: 'caution',
      meterPercent: clamp(50 + ((mgDl - normalMax) / (borderlineMax - normalMax)) * 18, 50, 68),
      summary: `Your ${testTypeLabel.toLowerCase()} reading of ${mgDl} mg/dL (${mmolL} mmol/L) is higher than optimal (${testType === 'fasting' ? '100–125 mg/dL prediabetes range' : '140–199 mg/dL elevated range'}).`,
      hba1cAssessment,
      advice: [
        'Cut back on sugary beverages, refined white flour, pastries, and sweet snacks; pair carbohydrates with protein and fiber to blunt glucose spikes.',
        'Take a brisk 15–30 minute walk after meals and aim for 150 minutes of regular exercise weekly.',
        'Schedule a confirmatory lab fasting glucose and HbA1c test with your doctor to check your 3-month blood sugar average.',
        'Even modest 5%–7% weight loss (if overweight) significantly reverses prediabetes risk.',
      ],
      warningSigns: [
        'Fasting readings repeatedly ≥ 126 mg/dL or post-meal readings ≥ 200 mg/dL',
        'Increased thirst, frequent urination, or blurry vision',
      ],
      referenceRange,
    };
  }

  // Very High / Urgent Hyperglycemia
  if (mgDl >= urgentThreshold) {
    return {
      inputValue: Number(rawVal.toFixed(1)),
      unit,
      mgDl,
      mmolL,
      testType,
      testTypeLabel,
      status: 'high',
      statusLabel: 'High',
      category: 'Very High Blood Sugar (Urgent Hyperglycemia)',
      urgency: 'urgent',
      meterPercent: 97,
      summary: `Your blood sugar of ${mgDl} mg/dL (${mmolL} mmol/L) is critically elevated (≥ ${urgentThreshold} mg/dL) and needs prompt medical evaluation.`,
      hba1cAssessment,
      advice: [
        'Drink plenty of plain, sugar-free water immediately to prevent dehydration.',
        'Wash your hands and recheck once to rule out food residue on fingers, and check urine/blood ketones if you have diabetes.',
        'Contact your doctor or urgent care clinic promptly today — seek emergency care immediately if you have vomiting, stomach pain, fruity-smelling breath, rapid breathing, or confusion.',
        'Avoid strenuous exercise while blood sugar is ≥ 250 mg/dL with possible ketones, and do NOT adjust insulin doses without your clinician’s written action plan.',
      ],
      warningSigns: [
        'Nausea, vomiting, or severe abdominal pain',
        'Fruity-smelling breath or fast, deep breathing (possible DKA)',
        'Extreme thirst, confusion, or drowsiness',
      ],
      referenceRange,
    };
  }

  // High Blood Sugar (Diabetes Range)
  return {
    inputValue: Number(rawVal.toFixed(1)),
    unit,
    mgDl,
    mmolL,
    testType,
    testTypeLabel,
    status: 'high',
    statusLabel: 'High',
    category: 'High Blood Sugar (Hyperglycemia / Diabetes Range)',
    urgency: 'high',
    meterPercent: clamp(72 + ((mgDl - borderlineMax) / (urgentThreshold - borderlineMax)) * 20, 72, 92),
    summary: `Your ${testTypeLabel.toLowerCase()} blood sugar of ${mgDl} mg/dL (${mmolL} mmol/L) is in the High (Diabetes) range.`,
    hba1cAssessment,
    advice: [
      'Drink plain water and avoid sugary drinks, fruit juices, white rice/bread, and sweets right now.',
      'Share a 1-week log of fasting and 2-hour post-meal readings with your physician to confirm diagnosis or fine-tune your diabetes treatment plan.',
      'Check that you have not missed any prescribed diabetes medication doses, and never double a dose without medical guidance.',
      'Light walking (if you feel well and blood sugar is under 250 mg/dL) and high-fiber, lower-glycemic meals help bring glucose down steadily.',
    ],
    warningSigns: [
      'Readings climbing above 250–300 mg/dL',
      'Persistent nausea, vomiting, rapid breathing, or severe dehydration',
    ],
    referenceRange,
  };
}

export function evaluateCombinedVitals(params: {
  bp?: BloodPressureInput | null;
  sugar?: BloodSugarInput | null;
}): CombinedVitalsEvaluation {
  const bp = params.bp ? evaluateBloodPressure(params.bp) : null;
  const sugar = params.sugar ? evaluateBloodSugar(params.sugar) : null;

  if (!bp && !sugar) {
    throw new Error('Enter Blood Pressure values, Blood Sugar values, or both to calculate.');
  }

  const urgentParts: string[] = [];
  if (bp?.urgency === 'urgent') {
    urgentParts.push(`Blood Pressure (${bp.systolic}/${bp.diastolic} mmHg — ${bp.category})`);
  }
  if (sugar?.urgency === 'urgent') {
    urgentParts.push(`Blood Sugar (${sugar.mgDl} mg/dL — ${sugar.category})`);
  }
  const urgentAlert =
    urgentParts.length > 0
      ? `Urgent reading detected: ${urgentParts.join(' and ')}. Follow the immediate steps below and contact medical care promptly.`
      : null;

  let overallStatus: VitalStatus = 'normal';
  let overallHeadline = 'Readings Are Within Normal Range';
  let combinedInsight = '';

  if (bp && sugar) {
    if (bp.status === 'normal' && sugar.status === 'normal') {
      overallStatus = 'normal';
      overallHeadline = 'Both Blood Pressure & Blood Sugar Are Normal';
      combinedInsight =
        'Both your cardiovascular pressure and blood glucose are in healthy target ranges today. Continue your balanced nutrition, hydration, sleep, and regular activity habits.';
    } else if (bp.status === 'low' || sugar.status === 'low') {
      overallStatus = 'low';
      overallHeadline =
        bp.status === 'low' && sugar.status === 'low'
          ? 'Both Blood Pressure & Blood Sugar Are Low'
          : sugar.status === 'low'
            ? 'Low Blood Sugar Needs Immediate Attention'
            : 'Low Blood Pressure Detected';
      combinedInsight =
        sugar.status === 'low'
          ? 'Always treat Low Blood Sugar (< 70 mg/dL) first with 15 g fast-acting carbohydrates, then sit safely and hydrate if blood pressure is also low.'
          : 'Rest safely, hydrate with water or electrolytes, and stand up slowly. Share both readings with your physician if low blood pressure occurs alongside high blood sugar or dizziness.';
    } else {
      overallStatus = 'high';
      overallHeadline =
        bp.status === 'high' && sugar.status === 'high'
          ? 'Both Blood Pressure & Blood Sugar Are High'
          : bp.status === 'high'
            ? 'Blood Pressure Is High · Blood Sugar Is Normal'
            : 'Blood Sugar Is High · Blood Pressure Is Normal';
      combinedInsight =
        bp.status === 'high' && sugar.status === 'high'
          ? 'Elevated blood pressure and elevated blood sugar together increase strain on blood vessels, heart, and kidneys. Keeping a daily log of both numbers and reviewing them together with your doctor gives the best long-term protection.'
          : bp.status === 'high'
            ? 'Your blood sugar is well controlled today while your blood pressure is above target. Focus on sodium reduction, calm rest before rechecking, and sharing a 7-day BP log with your doctor.'
            : 'Your blood pressure is healthy today while your blood sugar is elevated. Focus on post-meal walking, lower-glycemic high-fiber meals, hydration, and a confirmatory fasting/HbA1c check.';
    }
  } else if (bp) {
    overallStatus = bp.status;
    overallHeadline = `${bp.statusLabel.toUpperCase()} — ${bp.category}`;
    combinedInsight = bp.summary;
  } else if (sugar) {
    overallStatus = sugar.status;
    overallHeadline = `${sugar.statusLabel.toUpperCase()} — ${sugar.category}`;
    combinedInsight = sugar.summary;
  }

  return {
    bp,
    sugar,
    overallStatus,
    overallHeadline,
    combinedInsight,
    urgentAlert,
    evaluatedAt: new Date().toLocaleString(),
  };
}

export function formatVitalsSummaryText(
  result: CombinedVitalsEvaluation,
  patientName?: string
): string {
  const sections: Array<{ title: string; lines: string[] }> = [
    {
      title: 'Patient & Overall Assessment Summary',
      lines: [
        ...formatKeyValueRows([
          { label: 'Patient Name', value: patientName || 'Patient Self-Check' },
          { label: 'Overall Status', value: result.overallStatus.toUpperCase() },
          { label: 'Overall Verdict', value: result.overallHeadline },
          { label: 'Combined Insight', value: result.combinedInsight },
        ]),
        ...(result.urgentAlert
          ? ['', ...wrapText(`URGENT ALERT: ${result.urgentAlert}`)]
          : []),
      ],
    },
  ];

  if (result.bp) {
    sections.push({
      title: 'Blood Pressure Assessment (ACC/AHA)',
      lines: [
        ...formatKeyValueRows([
          {
            label: 'Blood Pressure',
            value: `${result.bp.systolic}/${result.bp.diastolic} mmHg`,
          },
          {
            label: 'Heart Rate / Pulse',
            value: result.bp.pulse !== null ? `${result.bp.pulse} bpm` : null,
          },
          { label: 'Result Status', value: result.bp.statusLabel.toUpperCase() },
          { label: 'Clinical Category', value: result.bp.category },
          {
            label: 'Hemodynamic Metrics',
            value: `MAP: ${result.bp.meanArterialPressure} mmHg | Pulse Pressure: ${result.bp.pulsePressure} mmHg`,
          },
          { label: 'Reference Range', value: result.bp.referenceRange },
        ]),
        '',
        ...wrapText(`Clinical Summary: ${result.bp.summary}`),
        ...(result.bp.pulseNote ? ['', ...wrapText(`Pulse Note: ${result.bp.pulseNote}`)] : []),
        '',
        'Recommended Advice:',
        ...formatNumberedList(result.bp.advice),
        '',
        'When to Seek Medical Care:',
        ...formatBulletList(result.bp.warningSigns),
      ],
    });
  }

  if (result.sugar) {
    sections.push({
      title: 'Blood Sugar Assessment (ADA/WHO)',
      lines: [
        ...formatKeyValueRows([
          {
            label: 'Blood Sugar Level',
            value: `${result.sugar.mgDl} mg/dL (${result.sugar.mmolL} mmol/L)`,
          },
          { label: 'Test Timing', value: result.sugar.testTypeLabel },
          { label: 'Result Status', value: result.sugar.statusLabel.toUpperCase() },
          { label: 'Clinical Category', value: result.sugar.category },
          {
            label: 'HbA1c (3-Month Avg)',
            value: result.sugar.hba1cAssessment
              ? `${result.sugar.hba1cAssessment.percent}% — ${result.sugar.hba1cAssessment.category} (Est. Avg Glucose ~${result.sugar.hba1cAssessment.estimatedAvgMgDl} mg/dL)`
              : null,
          },
          { label: 'Reference Range', value: result.sugar.referenceRange },
        ]),
        '',
        ...wrapText(`Clinical Summary: ${result.sugar.summary}`),
        '',
        'Recommended Advice:',
        ...formatNumberedList(result.sugar.advice),
        '',
        'When to Seek Medical Care:',
        ...formatBulletList(result.sugar.warningSigns),
      ],
    });
  }

  return buildStructuredReport({
    reportTitle: 'Blood Pressure & Blood Sugar Report',
    reportCode: 'VITALS',
    generatedAt: result.evaluatedAt,
    sections,
    disclaimer:
      'Educational guidance aligned with ACC/AHA Blood Pressure and ADA/WHO Blood Glucose clinical reference ranges. Single readings may fluctuate with stress, posture, hydration, or recent meals — always confirm diagnosis or medication adjustments with a licensed physician.',
  });
}
