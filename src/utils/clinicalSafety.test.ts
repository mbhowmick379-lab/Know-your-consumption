import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateAllergyConflict,
  evaluateDeterministicInteractions,
  getAgeGroupLabel,
  runAutomatedVerificationProtocol,
  runCombinedCompositionSafetyProtocol,
  sanitizeStringList,
  toAgeInYears,
  toWeightInKg,
} from './clinicalSafety';

test('age and weight unit normalization converts accurately', () => {
  assert.equal(toAgeInYears(6, 'months'), 0.5);
  assert.equal(toAgeInYears(34, 'years'), 34);
  assert.equal(toWeightInKg(null, 'kg'), null);
  assert.equal(toWeightInKg(undefined, 'lbs'), null);
  assert.equal(toWeightInKg(22, 'kg'), 22);
  assert.equal(toWeightInKg(110, 'lbs'), 49.9);
});

test('age group stratification maps infants, children, adults, and older adults', () => {
  assert.match(getAgeGroupLabel(0.5), /Infant/);
  assert.match(getAgeGroupLabel(6), /Pediatric Child/);
  assert.match(getAgeGroupLabel(35), /Adult/);
  assert.match(getAgeGroupLabel(72), /Older Adult/);
});

test('allergy conflict detection catches direct class match and beta-lactam cross-reactivity', () => {
  const direct = evaluateAllergyConflict('Amoxicillin', ['Penicillin']);
  assert.equal(direct.severity, 'critical');
  assert.ok(direct.matchedAllergens.length > 0);

  const cross = evaluateAllergyConflict('Cephalexin', ['Penicillin']);
  assert.equal(cross.severity, 'caution');

  const clear = evaluateAllergyConflict('Azithromycin', ['Penicillin']);
  assert.equal(clear.severity, 'clear');
});

test('pediatric contraindications flag aspirin under 18 and ibuprofen under 6 months', () => {
  const aspirinChild = runAutomatedVerificationProtocol({
    medicationName: 'Aspirin',
    ageValue: 10,
    ageUnit: 'years',
    weightValue: null,
    allergies: [],
    currentMedications: [],
  });
  assert.equal(aspirinChild.verificationStatus, 'contraindicated');
  assert.ok(aspirinChild.verificationChecks.some((c) => c.id === 'age-protocol' && c.status === 'alert'));

  const ibuprofenInfant = runAutomatedVerificationProtocol({
    medicationName: 'Ibuprofen',
    ageValue: 4,
    ageUnit: 'months',
    weightValue: 6.5,
    weightUnit: 'kg',
    allergies: [],
    currentMedications: [],
  });
  assert.equal(ibuprofenInfant.verificationStatus, 'contraindicated');
});

test('optional weight omission passes cleanly for adults and cautions for young children', () => {
  const adultNoWeight = runAutomatedVerificationProtocol({
    medicationName: 'Amoxicillin',
    ageValue: 32,
    ageUnit: 'years',
    weightValue: null,
    allergies: [],
    currentMedications: [],
  });
  assert.equal(adultNoWeight.weightKg, null);
  assert.equal(adultNoWeight.verificationStatus, 'verified');

  const childNoWeight = runAutomatedVerificationProtocol({
    medicationName: 'Amoxicillin',
    ageValue: 5,
    ageUnit: 'years',
    weightValue: null,
    allergies: [],
    currentMedications: [],
  });
  assert.equal(childNoWeight.verificationStatus, 'caution');
  assert.ok(childNoWeight.verificationChecks.some((c) => c.id === 'weight-protocol' && c.status === 'warning'));
});

test('deterministic drug-drug interaction engine catches major and moderate pairs', () => {
  const warfarinAmox = evaluateDeterministicInteractions(['Warfarin', 'Amoxicillin']);
  assert.equal(warfarinAmox.length, 1);
  assert.equal(warfarinAmox[0].severity, 'major');

  const ibuprofenLisinopril = evaluateDeterministicInteractions(['Ibuprofen', 'Lisinopril']);
  assert.equal(ibuprofenLisinopril.length, 1);
  assert.equal(ibuprofenLisinopril[0].severity, 'moderate');
});

test('sanitizeStringList enforces schema bounds and deduplicates case-insensitively', () => {
  const list = sanitizeStringList(['Penicillin', 'penicillin', '  Sulfa  ', '', 'NSAIDs'], 2, 10);
  assert.deepEqual(list, ['Penicillin', 'Sulfa']);
});

test('brand names trigger deterministic allergy, pediatric age, and drug interaction rules', () => {
  const moxAllergy = evaluateAllergyConflict('Mox 500', ['Penicillin']);
  assert.equal(moxAllergy.severity, 'critical');

  const disprinChild = runAutomatedVerificationProtocol({
    medicationName: 'Disprin',
    ageValue: 10,
    ageUnit: 'years',
    weightValue: null,
    allergies: [],
    currentMedications: [],
  });
  assert.equal(disprinChild.verificationStatus, 'contraindicated');

  const brandInteraction = evaluateDeterministicInteractions(['Advil', 'Coumadin']);
  assert.equal(brandInteraction.length, 1);
  assert.equal(brandInteraction[0].severity, 'major');
});

test('sex-specific safety rules catch female zolpidem dose reduction, finasteride contraindication, and male UTI note', () => {
  const femaleZolpidem = runAutomatedVerificationProtocol({
    medicationName: 'Zolpidem',
    ageValue: 34,
    ageUnit: 'years',
    sex: 'female',
    weightValue: null,
    allergies: [],
    currentMedications: [],
  });
  const zCheck = femaleZolpidem.verificationChecks.find((c) => c.id === 'sex-protocol');
  assert.equal(zCheck?.status, 'warning');
  assert.match(zCheck?.detail ?? '', /5 mg/);

  const femaleFinasteride = runAutomatedVerificationProtocol({
    medicationName: 'Finasteride',
    ageValue: 29,
    ageUnit: 'years',
    sex: 'female',
    weightValue: null,
    allergies: [],
    currentMedications: [],
  });
  assert.equal(femaleFinasteride.verificationStatus, 'contraindicated');

  const maleUti = runAutomatedVerificationProtocol({
    medicationName: 'Nitrofurantoin',
    ageValue: 40,
    ageUnit: 'years',
    sex: 'male',
    weightValue: null,
    allergies: [],
    currentMedications: [],
  });
  const mCheck = maleUti.verificationChecks.find((c) => c.id === 'sex-protocol');
  assert.equal(mCheck?.status, 'info');
  assert.match(mCheck?.detail ?? '', /7 to 14 days/);
});

test('multi-composition protocol screens 3+ compositions for allergies, duplicate NSAIDs, and clean combos', () => {
  // Clean 4-composition cold & flu adult female check
  const cleanCombo = runCombinedCompositionSafetyProtocol({
    compositions: [
      { name: 'Paracetamol', strength: '500 mg' },
      { name: 'Phenylephrine', strength: '10 mg' },
      { name: 'Chlorpheniramine', strength: '2 mg' },
      { name: 'Caffeine', strength: '30 mg' },
    ],
    ageValue: 30,
    ageUnit: 'years',
    sex: 'female',
    weightValue: 62,
    weightUnit: 'kg',
    allergies: [],
    currentMedications: [],
  });
  assert.equal(cleanCombo.compositions.length, 4);
  assert.equal(cleanCombo.verificationStatus, 'verified');
  assert.equal(cleanCombo.duplicateFamilyWarnings.length, 0);

  // Allergy on the 3rd composition triggers critical contraindication
  const allergyOnThird = runCombinedCompositionSafetyProtocol({
    compositions: [
      { name: 'Paracetamol', strength: '500 mg' },
      { name: 'Caffeine', strength: '30 mg' },
      { name: 'Amoxicillin', strength: '500 mg' },
    ],
    ageValue: 35,
    ageUnit: 'years',
    sex: 'male',
    allergies: ['Penicillin'],
    currentMedications: [],
  });
  assert.equal(allergyOnThird.allergyAlert.severity, 'critical');
  assert.equal(allergyOnThird.verificationStatus, 'contraindicated');

  // Duplicate NSAID overlap inside a 3-composition mix triggers compatibility alert
  const duplicateNsaid = runCombinedCompositionSafetyProtocol({
    compositions: [
      { name: 'Ibuprofen', strength: '400 mg' },
      { name: 'Aceclofenac', strength: '100 mg' },
      { name: 'Paracetamol', strength: '325 mg' },
    ],
    ageValue: 28,
    ageUnit: 'years',
    sex: 'male',
    allergies: [],
    currentMedications: [],
  });
  assert.ok(duplicateNsaid.duplicateFamilyWarnings.some((w) => /NSAID/i.test(w)));
  assert.equal(duplicateNsaid.verificationStatus, 'contraindicated');
});



