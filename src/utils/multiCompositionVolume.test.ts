import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMultiCompositionTotalMg,
  formatMultiContainerSummary,
  parseMgFromStrength,
} from './multiCompositionVolume.ts';

test('parseMgFromStrength parses mg, grams, micrograms, and skips non-mass units', () => {
  assert.equal(parseMgFromStrength('500 mg'), 500);
  assert.equal(parseMgFromStrength('125mg'), 125);
  assert.equal(parseMgFromStrength('250 mg / 5 mL'), 250);
  assert.equal(parseMgFromStrength('0.5 g'), 500);
  assert.equal(parseMgFromStrength('500 mcg'), 0.5);
  assert.equal(parseMgFromStrength('100'), 100);
  assert.equal(parseMgFromStrength('60M spores'), null);
  assert.equal(parseMgFromStrength('1000 IU'), null);
  assert.equal(parseMgFromStrength(''), null);
});

test('computeMultiCompositionTotalMg sums mg strengths and counts non-mg ingredients cleanly', () => {
  const summary = computeMultiCompositionTotalMg([
    { name: 'Paracetamol', strength: '125 mg' },
    { name: 'Phenylephrine', strength: '5 mg' },
    { name: 'Chlorpheniramine', strength: '1 mg' },
    { name: 'Lactic Acid Bacillus', strength: '60M spores' },
  ]);

  assert.equal(summary.autoTotalMg, 131);
  assert.equal(summary.parsedCount, 3);
  assert.equal(summary.nonMgCount, 1);
});

test('formatMultiContainerSummary formats 5 mL, 10 mL, and tablet multi-composition containers accurately', () => {
  const syrup5ml = formatMultiContainerSummary({
    compositions: [
      { name: 'Paracetamol', strength: '125 mg' },
      { name: 'Phenylephrine', strength: '5 mg' },
      { name: 'Chlorpheniramine', strength: '1 mg' },
    ],
    basis: 'liquid',
    perMl: 5,
  });
  assert.equal(
    syrup5ml,
    'Each 5 mL contains 131 mg total (Paracetamol 125 mg + Phenylephrine 5 mg + Chlorpheniramine 1 mg)'
  );

  const syrup10mlOverride = formatMultiContainerSummary({
    compositions: [
      { name: 'Ambroxol', strength: '30 mg' },
      { name: 'Guaifenesin', strength: '100 mg' },
      { name: 'Terbutaline', strength: '2.5 mg' },
    ],
    basis: 'liquid',
    perMl: 10,
    totalMg: 132.5,
  });
  assert.equal(
    syrup10mlOverride,
    'Each 10 mL contains 132.5 mg total (Ambroxol 30 mg + Guaifenesin 100 mg + Terbutaline 2.5 mg)'
  );

  const tablet = formatMultiContainerSummary({
    compositions: [
      { name: 'Amoxicillin', strength: '500 mg' },
      { name: 'Clavulanic Acid', strength: '125 mg' },
    ],
    basis: 'tablet',
  });
  assert.equal(
    tablet,
    'Per 1 Tablet contains 625 mg total (Amoxicillin 500 mg + Clavulanic Acid 125 mg)'
  );

  const capsule = formatMultiContainerSummary({
    compositions: [
      { name: 'Omeprazole', strength: '20 mg' },
      { name: 'Domperidone', strength: '30 mg' },
    ],
    basis: 'capsule',
  });
  assert.equal(
    capsule,
    'Per 1 Capsule contains 50 mg total (Omeprazole 20 mg + Domperidone 30 mg)'
  );
});
