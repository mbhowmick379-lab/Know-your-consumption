import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDosageSummaryText,
  formatFullPatientRecordText,
  formatInteractionSummaryText,
  buildVerifiedPatientRecordJson,
} from './recordExport.ts';
import { evaluateCombinedVitals, formatVitalsSummaryText } from './vitalsCalculator.ts';
import { calculateLiquidDoseMl, formatLiquidPlanText } from './liquidDose.ts';
import { buildRabiesSchedule, formatRabiesScheduleText } from './rabiesSchedule.ts';

function extractSectionNumbers(report: string): number[] {
  const matches = Array.from(report.matchAll(/^SECTION (\d+)\./gm));
  return matches.map((m) => Number(m[1]));
}

function assertStrictlySequentialReport(report: string, label: string) {
  assert.ok(report.includes('KNOW YOUR CONSUMPTION(KYC) —'), `${label}: missing KYC header`);
  assert.ok(report.includes('Designed by Manoj'), `${label}: missing Designed by Manoj`);
  assert.ok(report.includes('Report Reference'), `${label}: missing Report Reference`);
  assert.ok(report.includes('END OF REPORT'), `${label}: missing End of Report footer`);
  assert.ok(!report.includes('\n\n\n'), `${label}: should not contain triple blank lines`);

  const nums = extractSectionNumbers(report);
  assert.ok(nums.length >= 3, `${label}: expected at least 3 ordered sections`);
  const expected = Array.from({ length: nums.length }, (_, i) => i + 1);
  assert.deepEqual(nums, expected, `${label}: sections must be strictly sequential 1..N`);
}

test('Dosage verification downloadable report follows proper numbered sequence (single & multi-composition)', () => {
  const report = formatDosageSummaryText(
    {
      medicationName: 'Paracetamol + Phenylephrine + Chlorpheniramine',
      genericName: 'Acetaminophen + Phenylephrine + Chlorpheniramine',
      matchedAs: 'combination',
      isCombinedComposition: true,
      combinedContainerSummary:
        'Each 5 mL contains 131 mg total (Paracetamol 125 mg + Phenylephrine 5 mg + Chlorpheniramine 1 mg)',
      combinedSynergyAndOverlapSummary:
        'Relieves fever, nasal congestion, and runny nose together safely when dosed within age ceiling.',
      compositionBreakdown: [
        {
          compositionName: 'Paracetamol',
          genericName: 'Acetaminophen',
          role: 'Fever & pain reliever',
          perDoseAmount: '125 mg',
          maxDailyLimit: '60 mg/kg/day',
          safetyStatus: 'safe',
          note: 'Do not combine with other paracetamol medicines.',
        },
        {
          compositionName: 'Phenylephrine',
          genericName: 'Phenylephrine HCl',
          role: 'Nasal decongestant',
          perDoseAmount: '5 mg',
          maxDailyLimit: '20 mg/day',
          safetyStatus: 'caution',
          note: 'Use only as directed.',
        },
      ],
      drugCategory: 'Cold & Fever Combination',
      isAntibiotic: false,
      patientSex: 'male',
      ageGroupLabel: 'Child (6–11 yrs)',
      dosingBasis: 'weight-based',
      recommendedDose: '5 mL combined syrup',
      recommendedDoseMl: '5 mL per dose',
      liquidCalculationDetail: 'Each 5 mL delivers 131 mg combined actives.',
      weightCalculationDetail: 'Weight 22 kg verified within safe ceiling.',
      sexSpecificGuidance: 'Standard pediatric dosing applies equally to male and female children.',
      frequency: 'Every 6–8 hours as needed',
      maxDailyLimit: '4 doses (20 mL) per 24 hours',
      typicalDuration: '3 to 5 days',
      administrationTips: ['Shake bottle well before measuring.', 'Use marked oral syringe.'],
      antibioticCourseNote: '',
      allergyAlert: {
        severity: 'clear',
        headline: 'No recorded allergy conflicts',
        matchedAllergens: [],
        explanation: 'No allergies conflict with entered ingredients.',
        recommendedAction: 'Proceed with standard dosing.',
      },
      activeMedicationInteractions: [],
      watchOutSymptoms: ['Rash or swelling', 'Persistent high fever over 3 days'],
      verificationStatus: 'verified',
      verificationChecks: [
        { id: 'allergy', label: 'Allergy Screen', status: 'pass', detail: 'Clear' },
      ],
      clinicalReferences: ['U.S. FDA Prescribing Information'],
      verifiedSources: [
        { title: 'OpenFDA Label', url: 'https://open.fda.gov', sourceType: 'fda' },
      ],
      patientDisclaimer: 'Always confirm pediatric doses with your pediatrician.',
      generatedAt: '2026-11-19T10:00:00.000Z',
    },
    {
      patientName: 'Aarav',
      sexDisplay: 'Male',
      ageDisplay: '7 years',
      weightDisplay: '22 kg',
      allergies: [],
    }
  );

  assertStrictlySequentialReport(report, 'Dosage Report');
  assert.ok(report.indexOf('SECTION 1. PATIENT PROFILE') < report.indexOf('SECTION 2. MEDICATION'));
  assert.ok(report.indexOf('SECTION 2. MEDICATION') < report.indexOf('SECTION 3. COMBINED MULTI-COMPOSITION'));
  assert.ok(report.indexOf('SECTION 5. ALLERGY SCREENING') < report.indexOf('SECTION 6. PATIENT ADMINISTRATION'));
});

test('BP & Blood Sugar downloadable report renumbers cleanly for both-vitals and single-vital modes', () => {
  const bothEval = evaluateCombinedVitals({
    bp: { systolic: 152, diastolic: 96, pulse: 82 },
    sugar: { value: 185, unit: 'mg/dL', testType: 'fasting', hba1c: 6.9 },
  });
  const bothReport = formatVitalsSummaryText(bothEval, 'Manoj');
  assertStrictlySequentialReport(bothReport, 'BP + Sugar Report');
  assert.deepEqual(extractSectionNumbers(bothReport), [1, 2, 3, 4]);
  assert.ok(bothReport.includes('Patient Name'));
  assert.ok(bothReport.includes('Manoj'));

  const sugarOnlyEval = evaluateCombinedVitals({
    sugar: { value: 62, unit: 'mg/dL', testType: 'fasting' },
  });
  const sugarOnlyReport = formatVitalsSummaryText(sugarOnlyEval);
  assertStrictlySequentialReport(sugarOnlyReport, 'Sugar-Only Report');
  assert.deepEqual(extractSectionNumbers(sugarOnlyReport), [1, 2, 3]);
  assert.ok(!sugarOnlyReport.includes('BLOOD PRESSURE ASSESSMENT'));
});

test('Liquid mL, Drug Interactions (risk-sorted), Rabies Schedule, and Full Health Record (date-sorted) follow proper sequence', async () => {
  // 1. Liquid mL report
  const calc = calculateLiquidDoseMl({
    targetDoseMg: 250,
    strengthMg: 125,
    strengthPerMl: 5,
    dosesPerDay: 3,
    courseDays: 7,
  });
  assert.ok(calc);
  const mlReport = formatLiquidPlanText({
    medicationName: 'Amoxicillin Suspension',
    patientName: 'Maya',
    targetDoseMg: 250,
    strengthMg: 125,
    strengthPerMl: 5,
    dosesPerDay: 3,
    courseDays: 7,
    calc,
  });
  assertStrictlySequentialReport(mlReport, 'Liquid mL Report');
  assert.deepEqual(extractSectionNumbers(mlReport), [1, 2, 3, 4, 5]);

  // 2. Drug Interaction report sorts Major before Minor
  const interactionReport = formatInteractionSummaryText({
    medications: ['Warfarin', 'Ibuprofen', 'Vitamin C'],
    overallSeverity: 'major',
    executiveSummary: 'Major bleeding risk between Warfarin and Ibuprofen.',
    pairs: [
      {
        drugA: 'Warfarin',
        drugB: 'Vitamin C',
        severity: 'minor',
        headline: 'High-dose Vitamin C note',
        plainLanguageExplanation: 'Very high doses may slightly alter INR.',
        symptomsToWatch: ['Unusual bruising'],
        managementGuidance: 'Keep intake consistent.',
      },
      {
        drugA: 'Warfarin',
        drugB: 'Ibuprofen',
        severity: 'major',
        headline: 'Major GI bleeding risk',
        plainLanguageExplanation: 'NSAIDs with anticoagulants significantly raise bleeding risk.',
        symptomsToWatch: ['Dark stools', 'Severe bruising'],
        managementGuidance: 'Avoid combining unless prescribed by your physician.',
      },
    ],
    foodAndAlcoholNotes: ['Avoid binge alcohol with warfarin.'],
    actionGuidance: 'Contact your prescribing physician before taking Ibuprofen.',
    clinicalReferences: ['FDA Prescribing Information'],
    generatedAt: '2026-11-19T10:00:00.000Z',
  });
  assertStrictlySequentialReport(interactionReport, 'Interaction Report');
  assert.ok(
    interactionReport.indexOf('Warfarin + Ibuprofen [MAJOR]') <
      interactionReport.indexOf('Warfarin + Vitamin C [MINOR]'),
    'Interaction pairs must be ordered from highest severity to lowest'
  );

  // 3. Rabies Schedule report
  const rabiesPlan = buildRabiesSchedule({
    startDateIso: '2026-11-19',
    regimenId: 'pep-4-im',
    exposureCategory: 'cat-2',
    referenceTodayIso: '2026-11-19',
  });
  assert.ok(rabiesPlan);
  const rabiesReport = formatRabiesScheduleText(rabiesPlan, 'Alex');
  assertStrictlySequentialReport(rabiesReport, 'Rabies Schedule Report');
  assert.deepEqual(extractSectionNumbers(rabiesReport), [1, 2, 3, 4]);

  // 4. Full Health Record report sorts newest first
  const profile = {
    userId: 'test-patient-1',
    displayName: 'Manoj',
    sex: 'male' as const,
    ageValue: 30,
    ageUnit: 'years' as const,
    weightValue: 70,
    weightUnit: 'kg' as const,
    allergies: ['Penicillin'],
    currentMedications: ['Metformin'],
  };
  const dosageRecords = [
    {
      id: 'old',
      userId: 'test-patient-1',
      createdAt: '2026-10-01T10:00:00.000Z',
      medicationName: 'OlderMed',
      genericName: 'OlderMed',
      drugCategory: 'Pain',
      ageDisplay: '30 years',
      weightDisplay: '70 kg',
      recommendedDose: '500 mg',
      frequency: 'Every 8 hours',
      maxDailyLimit: '1500 mg',
      duration: '5 days',
      allergyStatus: 'clear' as const,
      verificationStatus: 'verified' as const,
      allergiesChecked: [],
      summaryNotes: 'Older note',
      source: 'local' as const,
    },
    {
      id: 'new',
      userId: 'test-patient-1',
      createdAt: '2026-11-18T10:00:00.000Z',
      medicationName: 'NewerMed',
      genericName: 'NewerMed',
      drugCategory: 'Antibiotic',
      ageDisplay: '30 years',
      weightDisplay: '70 kg',
      recommendedDose: '250 mg',
      frequency: 'Once daily',
      maxDailyLimit: '500 mg',
      duration: '7 days',
      allergyStatus: 'clear' as const,
      verificationStatus: 'verified' as const,
      allergiesChecked: [],
      summaryNotes: 'Newer note',
      source: 'local' as const,
    },
  ];
  const fullReport = formatFullPatientRecordText(profile, dosageRecords, []);
  assertStrictlySequentialReport(fullReport, 'Full Health Record');
  assert.ok(
    fullReport.indexOf('NewerMed') < fullReport.indexOf('OlderMed'),
    'Health Record history should be ordered newest-first'
  );

  const jsonStr = await buildVerifiedPatientRecordJson(profile, dosageRecords, []);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.record.dosageRecords[0].medicationName, 'NewerMed');
  assert.equal(parsed.integrity.algorithm, 'SHA-256');
});
