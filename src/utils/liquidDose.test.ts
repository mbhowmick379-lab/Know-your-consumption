import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLiquidDoseMl, computeMlRangeFromDoseText } from './liquidDose';

test('calculates exact mL for standard mg per 5 mL liquid bottles', () => {
  const res = calculateLiquidDoseMl({
    targetDoseMg: 250,
    strengthMg: 125,
    strengthPerMl: 5,
    dosesPerDay: 3,
    courseDays: 7,
  });
  assert.ok(res);
  assert.equal(res.singleDoseMl, 10);
  assert.equal(res.singleDoseTeaspoons, 2);
  assert.equal(res.dailyVolumeMl, 30);
  assert.equal(res.totalCourseVolumeMl, 210);
  assert.equal(res.syringeCapacityMl, 10);
});

test('calculates exact mL for mg per 10 mL and custom bottle concentrations', () => {
  const res = calculateLiquidDoseMl({
    targetDoseMg: 5,
    strengthMg: 10,
    strengthPerMl: 10,
    dosesPerDay: 1,
    courseDays: 10,
  });
  assert.ok(res);
  assert.equal(res.singleDoseMl, 5);
  assert.equal(res.concentrationMgPerMl, 1);
  assert.equal(res.dailyVolumeMl, 5);
  assert.equal(res.totalCourseVolumeMl, 50);
});

test('flags safety warnings for unusually large or tiny oral liquid volumes', () => {
  const huge = calculateLiquidDoseMl({ targetDoseMg: 1000, strengthMg: 100, strengthPerMl: 5 });
  assert.ok(huge);
  assert.equal(huge.singleDoseMl, 50);
  assert.ok(huge.safetyWarnings.some((w) => /unusually large/i.test(w)));

  const tiny = calculateLiquidDoseMl({ targetDoseMg: 2, strengthMg: 100, strengthPerMl: 5 });
  assert.ok(tiny);
  assert.equal(tiny.singleDoseMl, 0.1);
  assert.ok(tiny.safetyWarnings.some((w) => /Very small volume/i.test(w)));
});

test('rejects zero or negative inputs cleanly', () => {
  assert.equal(calculateLiquidDoseMl({ targetDoseMg: 0, strengthMg: 250, strengthPerMl: 5 }), null);
  assert.equal(calculateLiquidDoseMl({ targetDoseMg: 250, strengthMg: -10, strengthPerMl: 5 }), null);
  assert.equal(calculateLiquidDoseMl({ targetDoseMg: 250, strengthMg: 250, strengthPerMl: 0 }), null);
});

test('parses single mg and mg ranges into exact mL strings', () => {
  const single = computeMlRangeFromDoseText('400 mg per dose', 200, 5);
  assert.ok(single);
  assert.equal(single.formattedMl, '10 mL per dose');

  const range = computeMlRangeFromDoseText('200 mg to 400 mg', 100, 5);
  assert.ok(range);
  assert.equal(range.formattedMl, '10 mL to 20 mL');
});
