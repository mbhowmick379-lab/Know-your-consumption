import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDrugIdentity,
  searchDrugCatalog,
  expandMedicationWithGeneric,
} from './drugCatalog';

test('resolves global brand names to their generic active ingredients', () => {
  const augmentin = resolveDrugIdentity('Augmentin 625');
  assert.ok(augmentin);
  assert.equal(augmentin.matchedAs, 'brand');
  assert.equal(augmentin.genericName, 'Amoxicillin-Clavulanate');

  const dolo = resolveDrugIdentity('Dolo 650');
  assert.ok(dolo);
  assert.equal(dolo.matchedAs, 'brand');
  assert.equal(dolo.genericName, 'Acetaminophen (Paracetamol)');

  const calpol = resolveDrugIdentity('Calpol');
  assert.ok(calpol);
  assert.equal(calpol.matchedAs, 'brand');
  assert.equal(calpol.genericName, 'Acetaminophen (Paracetamol)');

  const azithral = resolveDrugIdentity('Azithral');
  assert.ok(azithral);
  assert.equal(azithral.matchedAs, 'brand');
  assert.equal(azithral.genericName, 'Azithromycin');

  const ciplox = resolveDrugIdentity('Ciplox');
  assert.ok(ciplox);
  assert.equal(ciplox.matchedAs, 'brand');
  assert.equal(ciplox.genericName, 'Ciprofloxacin');

  const disprin = resolveDrugIdentity('Disprin');
  assert.ok(disprin);
  assert.equal(disprin.matchedAs, 'brand');
  assert.equal(disprin.genericName, 'Aspirin');
});

test('resolves generic names and exposes brand equivalents', () => {
  const amox = resolveDrugIdentity('Amoxicillin');
  assert.ok(amox);
  assert.equal(amox.matchedAs, 'generic');
  assert.ok(amox.brandNames.includes('Amoxil'));
  assert.ok(amox.brandNames.includes('Mox'));
});

test('searches catalog by brand name across categories', () => {
  const matches = searchDrugCatalog('Lipitor', 'All');
  assert.ok(matches.length >= 1);
  assert.equal(matches[0].genericName, 'Atorvastatin');

  const syrupMatches = searchDrugCatalog('Zithromax', 'Antibiotics');
  assert.ok(syrupMatches.length >= 1);
  assert.equal(syrupMatches[0].genericName, 'Azithromycin');
});

test('expands brand names with generic name for safety rule matching', () => {
  assert.equal(
    expandMedicationWithGeneric('Augmentin'),
    'Augmentin (Amoxicillin-Clavulanate)'
  );
  assert.equal(expandMedicationWithGeneric('UnknownDrugX'), 'UnknownDrugX');
});
