import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractGroundingMetadata,
  extractJsonFromModelText,
  formatLiveEvidenceForPrompt,
  parseOpenFdaLabelRecord,
} from './liveClinicalData';

test('parseOpenFdaLabelRecord extracts official FDA dosing, contraindications, and DailyMed link', () => {
  const parsed = parseOpenFdaLabelRecord({
    set_id: 'abc-123-setid',
    openfda: {
      brand_name: ['AUGMENTIN'],
      generic_name: ['AMOXICILLIN AND CLAVULANATE POTASSIUM'],
      pharm_class_epc: ['Penicillin-class Antibacterial [EPC]'],
    },
    dosage_and_administration: ['Adults: One 500 mg tablet every 8 hours or one 875 mg tablet every 12 hours.'],
    pediatric_use: ['Safety and effectiveness in pediatric patients have been established.'],
    contraindications: ['History of serious hypersensitivity reactions to amoxicillin or penicillins.'],
    pregnancy: ['Available data have not established a drug-associated risk of major birth defects.'],
  });

  assert.ok(parsed);
  assert.equal(parsed.brandNames[0], 'AUGMENTIN');
  assert.equal(parsed.genericNames[0], 'AMOXICILLIN AND CLAVULANATE POTASSIUM');
  assert.equal(parsed.dailymedUrl, 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=abc-123-setid');
  assert.match(parsed.dosageAndAdministration, /500 mg tablet every 8 hours/);
  assert.match(parsed.pregnancyAndSexSpecific, /birth defects/);
});

test('extractGroundingMetadata deduplicates valid web citations and captures search queries', () => {
  const extracted = extractGroundingMetadata({
    candidates: [
      {
        groundingMetadata: {
          webSearchQueries: ['amoxicillin adult dosage FDA', 'amoxicillin pediatric mg kg'],
          groundingChunks: [
            { web: { uri: 'https://www.drugs.com/dosage/amoxicillin.html', title: 'Amoxicillin Dosage - Drugs.com' } },
            { web: { uri: 'https://www.drugs.com/dosage/amoxicillin.html', title: 'Duplicate URL' } },
            { web: { uri: 'https://www.accessdata.fda.gov/label.pdf', title: 'FDA Label' } },
            { web: { uri: 'javascript:alert(1)', title: 'Invalid Scheme' } },
          ],
        },
      },
    ],
  });

  assert.equal(extracted.webSources.length, 2);
  assert.equal(extracted.webSources[0].sourceType, 'web');
  assert.equal(extracted.webSources[1].url, 'https://www.accessdata.fda.gov/label.pdf');
  assert.equal(extracted.searchQueries.length, 2);
});

test('extractJsonFromModelText parses plain JSON and markdown-fenced JSON cleanly', () => {
  const plain = extractJsonFromModelText<{ ok: boolean }>('{"ok": true}');
  assert.equal(plain.ok, true);

  const fenced = extractJsonFromModelText<{ dose: string }>(
    'Here is the verified guidance:\n```json\n{"dose": "500 mg"}\n```'
  );
  assert.equal(fenced.dose, '500 mg');
});

test('formatLiveEvidenceForPrompt formats FDA and RxNorm evidence cleanly', () => {
  const fdaLabel = parseOpenFdaLabelRecord({
    openfda: { brand_name: ['AMBIEN'], generic_name: ['ZOLPIDEM TARTRATE'] },
    dosage_and_administration: ['The recommended initial dose is 5 mg for women and either 5 or 10 mg for men.'],
  });
  const text = formatLiveEvidenceForPrompt({
    fdaLabel,
    rxNorm: {
      rxcui: '39993',
      matchedName: 'zolpidem',
      ingredients: ['zolpidem'],
      brandNames: ['Ambien'],
      sourceUrl: 'https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=39993',
    },
    sources: [],
  });

  assert.match(text, /NIH NLM RxNorm/);
  assert.match(text, /5 mg for women/);
});
