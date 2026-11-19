import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addUtcDays,
  buildRabiesSchedule,
  buildRabiesScheduleIcs,
  formatRabiesScheduleText,
} from './rabiesSchedule';

test('calculates exact 4-dose PEP IM dates across month boundaries (Days 0, 3, 7, 14)', () => {
  const plan = buildRabiesSchedule({
    startDateIso: '2026-11-18',
    regimenId: 'pep-4-im',
    exposureCategory: 'cat-3',
    referenceTodayIso: '2026-11-18',
  });
  assert.ok(plan);
  assert.equal(plan.doses.length, 4);
  assert.deepEqual(
    plan.doses.map((d) => d.isoDate),
    ['2026-11-18', '2026-11-21', '2026-11-25', '2026-12-02']
  );
  assert.equal(plan.doses[0].status, 'today');
  assert.equal(plan.doses[1].status, 'upcoming');
  assert.equal(plan.rigUrgent, true);
});

test('calculates exact 5-dose PEP IM dates across year boundary (Days 0, 3, 7, 14, 28)', () => {
  const plan = buildRabiesSchedule({
    startDateIso: '2026-12-20',
    regimenId: 'pep-5-im',
    exposureCategory: 'cat-2',
    referenceTodayIso: '2026-12-25',
  });
  assert.ok(plan);
  assert.equal(plan.doses.length, 5);
  assert.deepEqual(
    plan.doses.map((d) => d.isoDate),
    ['2026-12-20', '2026-12-23', '2026-12-27', '2027-01-03', '2027-01-17']
  );
  assert.equal(plan.doses[0].status, 'past');
  assert.equal(plan.doses[2].status, 'upcoming');
  assert.equal(plan.rigUrgent, false);
});

test('handles leap year date arithmetic and previously vaccinated booster schedule', () => {
  assert.equal(addUtcDays('2028-02-27', 3), '2028-03-01');

  const booster = buildRabiesSchedule({
    startDateIso: '2028-02-27',
    regimenId: 'pep-booster',
    exposureCategory: 'cat-3',
    referenceTodayIso: '2028-02-27',
  });
  assert.ok(booster);
  assert.deepEqual(
    booster.doses.map((d) => d.isoDate),
    ['2028-02-27', '2028-03-01']
  );
  assert.equal(booster.rigUrgent, false);
});

test('rejects invalid dates and generates valid text + ICS calendar exports', () => {
  const invalid = buildRabiesSchedule({
    startDateIso: '2026-02-30',
    regimenId: 'pep-4-im',
    exposureCategory: 'cat-2',
  });
  assert.equal(invalid, null);

  const plan = buildRabiesSchedule({
    startDateIso: '2026-11-18',
    regimenId: 'prep-2',
    exposureCategory: 'cat-1',
    referenceTodayIso: '2026-11-18',
  });
  assert.ok(plan);
  const ics = buildRabiesScheduleIcs(plan, 'Alex');
  assert.ok(ics.includes('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261118'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261125'));

  const text = formatRabiesScheduleText(plan, 'Alex');
  assert.ok(text.includes('KNOW YOUR CONSUMPTION(KYC) — RABIES VACCINATION SCHEDULE'));
  assert.ok(text.includes('2026-11-25'));
});
