import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSingleMedicineFromScan,
  mergeCompositionsIntoRows,
  normalizeExtractedMedicineData,
  parseImageDataUrl,
} from './imageComposition.ts';

test('parseImageDataUrl validates allowed image data URLs and rejects invalid payloads', () => {
  const validPng =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const parsed = parseImageDataUrl(validPng);
  assert.ok(parsed);
  assert.equal(parsed.mimeType, 'image/png');
  assert.ok(parsed.base64Data.startsWith('iVBOR'));

  const validJpg =
    'data:image/jpg;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const parsedJpg = parseImageDataUrl(validJpg);
  assert.ok(parsedJpg);
  assert.equal(parsedJpg.mimeType, 'image/jpeg');

  assert.equal(parseImageDataUrl('data:text/plain;base64,SGVsbG8gd29ybGQgZnJvbSB0ZXN0'), null);
  assert.equal(parseImageDataUrl('not-a-data-url'), null);
  assert.equal(parseImageDataUrl('data:image/png;base64,short'), null);
});

test('normalizeExtractedMedicineData cleans multi-composition labels, deduplicates, and normalizes syrup strength', () => {
  const normalized = normalizeExtractedMedicineData({
    brandName: '  Sinarest   New  ',
    dosageForm: 'Tablet',
    compositions: [
      { name: 'Paracetamol', strength: '500 mg' },
      { name: 'Phenylephrine', strength: '10 mg' },
      { name: 'paracetamol', strength: '500 mg' }, // duplicate
      { name: 'Chlorpheniramine', strength: '2 mg' },
      { name: 'Caffeine', strength: '30 mg' },
    ],
    liquidStrengthMg: 250,
    liquidPerMl: null, // defaults to 5 mL when mg is present
    indicationHint: 'Cold, fever & nasal congestion',
    confidence: 'HIGH',
    extractedSummary: 'Read 4 active ingredients from blister strip.',
    warnings: ['Verify expiry date before use.'],
  });

  assert.equal(normalized.brandName, 'Sinarest New');
  assert.equal(normalized.compositions.length, 4);
  assert.equal(normalized.compositions[0].name, 'Paracetamol');
  assert.equal(normalized.compositions[3].name, 'Caffeine');
  assert.equal(normalized.liquidStrengthMg, 250);
  assert.equal(normalized.liquidPerMl, 5);
  assert.equal(normalized.confidence, 'high');
});

test('mergeCompositionsIntoRows fills empty slots first, appends sequentially, and caps at 8', () => {
  const initialEmpty = [
    { name: '', strength: '' },
    { name: '', strength: '' },
    { name: '', strength: '' },
  ];

  const firstScan = mergeCompositionsIntoRows(initialEmpty, [
    { name: 'Amoxicillin', strength: '500 mg' },
    { name: 'Clavulanic Acid', strength: '125 mg' },
  ]);
  assert.equal(firstScan.length, 3);
  assert.equal(firstScan[0].name, 'Amoxicillin');
  assert.equal(firstScan[1].name, 'Clavulanic Acid');
  assert.equal(firstScan[2].name, '');

  // Second strip scanned right after
  const secondScan = mergeCompositionsIntoRows(firstScan, [
    { name: 'amoxicillin', strength: '500 mg' }, // duplicate skipped
    { name: 'Lactic Acid Bacillus', strength: '60M spores' },
    { name: 'Paracetamol', strength: '500 mg' },
  ]);
  assert.equal(secondScan.length, 4);
  assert.equal(secondScan[2].name, 'Lactic Acid Bacillus');
  assert.equal(secondScan[3].name, 'Paracetamol');

  // Cap at 8 compositions max
  const many = Array.from({ length: 12 }, (_, i) => ({ name: `Ingredient ${i + 1}`, strength: '10 mg' }));
  const capped = mergeCompositionsIntoRows([], many);
  assert.equal(capped.length, 8);
});

test('formatSingleMedicineFromScan formats single brand, generic, or multi-ingredient scan cleanly', () => {
  const singleBrand = formatSingleMedicineFromScan({
    brandName: 'Calpol 250',
    dosageForm: 'Oral Suspension',
    compositions: [{ name: 'Paracetamol', strength: '250 mg / 5 mL' }],
    liquidStrengthMg: 250,
    liquidPerMl: 5,
    indicationHint: 'Fever',
    confidence: 'high',
    extractedSummary: '',
    warnings: [],
  });
  assert.equal(singleBrand, 'Calpol 250 (Paracetamol 250 mg / 5 mL)');

  const genericOnly = formatSingleMedicineFromScan({
    brandName: '',
    dosageForm: 'Tablet',
    compositions: [{ name: 'Azithromycin', strength: '500 mg' }],
    liquidStrengthMg: null,
    liquidPerMl: null,
    indicationHint: '',
    confidence: 'high',
    extractedSummary: '',
    warnings: [],
  });
  assert.equal(genericOnly, 'Azithromycin');
});
