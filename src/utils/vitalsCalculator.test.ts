import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertSugarToMgDl,
  convertSugarToMmolL,
  evaluateBloodPressure,
  evaluateBloodSugar,
  evaluateCombinedVitals,
  formatVitalsSummaryText,
} from './vitalsCalculator.ts';

test('evaluateBloodPressure classifies Low, Normal, Elevated, Stage 1, Stage 2, and Hypertensive Crisis accurately', () => {
  const low = evaluateBloodPressure({ systolic: 84, diastolic: 54, pulse: 72 });
  assert.equal(low.status, 'low');
  assert.equal(low.statusLabel, 'Low');
  assert.match(low.category, /Hypotension/i);
  assert.ok(low.advice.length >= 3);

  const normal = evaluateBloodPressure({ systolic: 116, diastolic: 74, pulse: 70 });
  assert.equal(normal.status, 'normal');
  assert.equal(normal.statusLabel, 'Normal');
  assert.equal(normal.pulsePressure, 42);
  assert.equal(normal.meanArterialPressure, 88);

  const elevated = evaluateBloodPressure({ systolic: 124, diastolic: 76 });
  assert.equal(elevated.status, 'high');
  assert.match(elevated.category, /Elevated/i);

  const stage1 = evaluateBloodPressure({ systolic: 134, diastolic: 84 });
  assert.equal(stage1.status, 'high');
  assert.match(stage1.category, /Stage 1/i);

  const stage2 = evaluateBloodPressure({ systolic: 152, diastolic: 96 });
  assert.equal(stage2.status, 'high');
  assert.match(stage2.category, /Stage 2/i);

  const crisis = evaluateBloodPressure({ systolic: 186, diastolic: 122 });
  assert.equal(crisis.status, 'high');
  assert.equal(crisis.urgency, 'urgent');
  assert.match(crisis.category, /Crisis/i);
});

test('evaluateBloodPressure rejects impossible systolic <= diastolic or out-of-range values', () => {
  assert.throws(() => evaluateBloodPressure({ systolic: 80, diastolic: 90 }), /higher than Diastolic/i);
  assert.throws(() => evaluateBloodPressure({ systolic: 350, diastolic: 80 }), /between 40 and 300/i);
});

test('evaluateBloodSugar classifies Low, Normal, Elevated, High, and Urgent across fasting, post-meal, random, and mmol/L', () => {
  const severeLow = evaluateBloodSugar({ value: 50, unit: 'mg/dL', testType: 'fasting' });
  assert.equal(severeLow.status, 'low');
  assert.equal(severeLow.urgency, 'urgent');
  assert.ok(severeLow.advice.some((a) => /Rule of 15/i.test(a)));

  const mildLow = evaluateBloodSugar({ value: 64, unit: 'mg/dL', testType: 'random' });
  assert.equal(mildLow.status, 'low');
  assert.equal(mildLow.statusLabel, 'Low');

  const normalFasting = evaluateBloodSugar({ value: 92, unit: 'mg/dL', testType: 'fasting' });
  assert.equal(normalFasting.status, 'normal');
  assert.equal(normalFasting.statusLabel, 'Normal');

  const prediabetes = evaluateBloodSugar({ value: 112, unit: 'mg/dL', testType: 'fasting' });
  assert.equal(prediabetes.status, 'high');
  assert.match(prediabetes.category, /Prediabetes/i);

  const normalPostMeal = evaluateBloodSugar({ value: 132, unit: 'mg/dL', testType: 'postprandial' });
  assert.equal(normalPostMeal.status, 'normal');

  const highPostMeal = evaluateBloodSugar({
    value: 12.8,
    unit: 'mmol/L',
    testType: 'postprandial',
    hba1c: 7.2,
  });
  assert.equal(highPostMeal.status, 'high');
  assert.ok(highPostMeal.mgDl > 220);
  assert.equal(highPostMeal.hba1cAssessment?.status, 'high');
  assert.equal(highPostMeal.hba1cAssessment?.estimatedAvgMgDl, 160);

  const urgentHigh = evaluateBloodSugar({ value: 320, unit: 'mg/dL', testType: 'random' });
  assert.equal(urgentHigh.status, 'high');
  assert.equal(urgentHigh.urgency, 'urgent');
});

test('unit conversions and combined BP + Blood Sugar evaluation work accurately', () => {
  assert.equal(convertSugarToMgDl(5.0, 'mmol/L'), 90.1);
  assert.equal(convertSugarToMmolL(180), 10);

  const combinedHigh = evaluateCombinedVitals({
    bp: { systolic: 150, diastolic: 94 },
    sugar: { value: 184, unit: 'mg/dL', testType: 'fasting' },
  });
  assert.equal(combinedHigh.overallStatus, 'high');
  assert.match(combinedHigh.overallHeadline, /Both Blood Pressure & Blood Sugar Are High/i);
  assert.match(combinedHigh.combinedInsight, /blood vessels, heart, and kidneys/i);

  const reportText = formatVitalsSummaryText(combinedHigh);
  assert.match(reportText, /150\/94 mmHg/);
  assert.match(reportText, /184 mg\/dL/);
  assert.match(reportText, /Recommended Advice:/);
});
