import type {
  DosageAnalysisResult,
  InteractionAnalysisResult,
  PatientProfile,
  SavedDosageRecord,
  SavedInteractionRecord,
} from '../types/clinical.ts';
import {
  buildStructuredReport,
  formatBulletList,
  formatKeyValueRows,
  formatNumberedList,
  wrapText,
  type ReportSection,
} from './reportFormatter.ts';

export async function computeSha256Hex(content: string): Promise<string> {
  const encoded = new TextEncoder().encode(content);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return 'sha256-unavailable';
}

export function triggerFileDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatDosageSummaryText(
  result: DosageAnalysisResult,
  patientMeta: {
    patientName?: string;
    sexDisplay?: string;
    ageDisplay: string;
    weightDisplay: string;
    allergies: string[];
  }
): string {
  const sections: ReportSection[] = [
    {
      title: 'Patient Profile & Clinical Parameters',
      lines: formatKeyValueRows([
        { label: 'Patient Name', value: patientMeta.patientName || 'Patient Self-Lookup' },
        {
          label: 'Patient Sex',
          value:
            patientMeta.sexDisplay ||
            (result.patientSex === 'female'
              ? 'Female'
              : result.patientSex === 'male'
                ? 'Male'
                : 'Not specified'),
        },
        { label: 'Patient Age', value: `${patientMeta.ageDisplay} (${result.ageGroupLabel})` },
        { label: 'Patient Weight', value: patientMeta.weightDisplay },
        {
          label: 'Recorded Allergies',
          value: patientMeta.allergies.length > 0 ? patientMeta.allergies.join(', ') : 'None recorded',
        },
      ]),
    },
    {
      title: 'Medication & Recommended Dosage Summary',
      lines: formatKeyValueRows([
        { label: 'Medication', value: `${result.medicationName} (${result.genericName})` },
        { label: 'Recognized Brand', value: result.recognizedBrandName || null },
        {
          label: 'Common Brands',
          value:
            result.commonBrandNames && result.commonBrandNames.length > 0
              ? result.commonBrandNames.join(', ')
              : null,
        },
        {
          label: 'Drug Category',
          value: `${result.drugCategory}${result.isAntibiotic ? ' (Antibiotic)' : ''}`,
        },
        { label: 'Dosing Basis', value: result.dosingBasis.toUpperCase() },
        { label: 'Recommended Dose', value: result.recommendedDose },
        { label: 'Liquid / Unit Dose', value: result.recommendedDoseMl || 'Not specified' },
        { label: 'Dosing Frequency', value: result.frequency },
        { label: 'Max Daily Ceiling', value: result.maxDailyLimit },
        { label: 'Typical Course', value: result.typicalDuration },
      ]),
    },
  ];

  if (
    result.isCombinedComposition &&
    (result.combinedContainerSummary ||
      result.combinedSynergyAndOverlapSummary ||
      (result.compositionBreakdown && result.compositionBreakdown.length > 0))
  ) {
    const comboLines: string[] = [];
    if (result.combinedContainerSummary) {
      comboLines.push(
        ...formatKeyValueRows([{ label: 'Combined Formulation', value: result.combinedContainerSummary }])
      );
    }
    if (result.combinedSynergyAndOverlapSummary) {
      if (comboLines.length > 0) comboLines.push('');
      comboLines.push(...wrapText(`Combined Clinical Overview: ${result.combinedSynergyAndOverlapSummary}`));
    }
    if (result.compositionBreakdown && result.compositionBreakdown.length > 0) {
      if (comboLines.length > 0) comboLines.push('');
      comboLines.push('Per-Composition Breakdown (Ordered):');
      result.compositionBreakdown.forEach((c, idx) => {
        comboLines.push(
          `  ${idx + 1}. ${c.compositionName} (${c.genericName}) [${c.safetyStatus.toUpperCase()}]`,
          ...wrapText(`Role: ${c.role}`, 76, '     ', '     '),
          ...wrapText(`Per Dose: ${c.perDoseAmount} | Max Daily: ${c.maxDailyLimit}`, 76, '     ', '     '),
          ...(c.note ? wrapText(`Note: ${c.note}`, 76, '     ', '     ') : [])
        );
      });
    }
    sections.push({
      title: 'Combined Multi-Composition Formulation & Breakdown',
      lines: comboLines,
    });
  }

  const calcRows = formatKeyValueRows([
    { label: 'Weight Calculation', value: result.weightCalculationDetail || null },
    { label: 'Liquid / Unit Math', value: result.liquidCalculationDetail || null },
    { label: 'Sex-Specific Guidance', value: result.sexSpecificGuidance || null },
  ]);
  if (calcRows.length > 0) {
    sections.push({
      title: 'Clinical Calculations & Sex-Specific Guidance',
      lines: calcRows,
    });
  }

  sections.push(
    {
      title: 'Allergy Screening & Automated Safety Protocol',
      lines: [
        ...formatKeyValueRows([
          {
            label: 'Allergy Screen',
            value: `${result.allergyAlert.severity.toUpperCase()} — ${result.allergyAlert.headline}`,
          },
          { label: 'Allergy Detail', value: result.allergyAlert.explanation },
          { label: 'Required Action', value: result.allergyAlert.recommendedAction },
          { label: 'Overall Protocol', value: result.verificationStatus.toUpperCase() },
        ]),
        '',
        'Safety Protocol Checks:',
        ...formatNumberedList(
          result.verificationChecks.map((c) => `[${c.status.toUpperCase()}] ${c.label}: ${c.detail}`)
        ),
      ],
    },
    {
      title: 'Patient Administration Instructions & Advice',
      lines: [
        ...formatNumberedList(result.administrationTips),
        ...(result.antibioticCourseNote
          ? ['', ...wrapText(`Antibiotic Stewardship Note: ${result.antibioticCourseNote}`)]
          : []),
      ],
    },
    {
      title: 'Warning Signs — When to Seek Medical Attention',
      lines: formatBulletList(result.watchOutSymptoms),
    },
    {
      title: 'Clinical References & Live Verified Sources',
      lines: [
        ...formatBulletList(result.clinicalReferences),
        ...(result.verifiedSources && result.verifiedSources.length > 0
          ? [
              '',
              'Verified Online Sources:',
              ...formatBulletList(
                result.verifiedSources.map((s) => `[${s.sourceType.toUpperCase()}] ${s.title} — ${s.url}`)
              ),
            ]
          : []),
      ],
    }
  );

  return buildStructuredReport({
    reportTitle: 'Patient Dosage & Safety Verification Report',
    reportCode: 'DOSE',
    generatedAt: new Date(result.generatedAt).toLocaleString(),
    sections,
    disclaimer: result.patientDisclaimer,
  });
}

const SEVERITY_RANK: Record<string, number> = {
  major: 0,
  moderate: 1,
  minor: 2,
  none: 3,
};

export function formatInteractionSummaryText(result: InteractionAnalysisResult): string {
  const orderedPairs = [...result.pairs].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
  );

  const pairLines =
    orderedPairs.length > 0
      ? orderedPairs.flatMap((p, idx) => [
          `  ${idx + 1}. ${p.drugA} + ${p.drugB} [${p.severity.toUpperCase()}]`,
          ...wrapText(`Headline: ${p.headline}`, 76, '     ', '     '),
          ...wrapText(`What Happens: ${p.plainLanguageExplanation}`, 76, '     ', '     '),
          ...wrapText(
            `Watch For: ${p.symptomsToWatch.join('; ') || 'General unusual symptoms'}`,
            76,
            '     ',
            '     '
          ),
          ...wrapText(`Advice: ${p.managementGuidance}`, 76, '     ', '     '),
          '',
        ])
      : wrapText('No significant drug-to-drug interactions identified among the listed medications.');

  return buildStructuredReport({
    reportTitle: 'Drug-to-Drug Interaction Report',
    reportCode: 'INTERACT',
    generatedAt: new Date(result.generatedAt).toLocaleString(),
    sections: [
      {
        title: 'Screening Overview & Severity',
        lines: [
          ...formatKeyValueRows([
            { label: 'Medications Screened', value: result.medications.join(', ') },
            { label: 'Total Pairs Checked', value: `${orderedPairs.length}` },
            { label: 'Overall Severity', value: result.overallSeverity.toUpperCase() },
          ]),
          '',
          ...wrapText(`Executive Summary: ${result.executiveSummary}`),
        ],
      },
      {
        title: 'Pair-by-Pair Interaction Analysis (Highest Risk First)',
        lines: pairLines,
      },
      {
        title: 'Food, Drink & Alcohol Cautions',
        lines: formatBulletList(
          result.foodAndAlcoholNotes.length > 0
            ? result.foodAndAlcoholNotes
            : ['No specific food or alcohol restrictions flagged; follow prescription label.']
        ),
      },
      {
        title: 'Recommended Next Steps & Advice',
        lines: wrapText(result.actionGuidance),
      },
      {
        title: 'Clinical References & Live Verified Sources',
        lines: [
          ...formatBulletList(result.clinicalReferences),
          ...(result.verifiedSources && result.verifiedSources.length > 0
            ? [
                '',
                'Verified Online Sources:',
                ...formatBulletList(
                  result.verifiedSources.map((s) => `[${s.sourceType.toUpperCase()}] ${s.title} — ${s.url}`)
                ),
              ]
            : []),
        ],
      },
    ],
  });
}

export function formatFullPatientRecordText(
  profile: PatientProfile,
  dosageRecords: SavedDosageRecord[],
  interactionRecords: SavedInteractionRecord[]
): string {
  const sexStr =
    profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : 'Not specified';
  const ageStr =
    profile.ageValue !== null && profile.ageValue !== undefined
      ? `${profile.ageValue} ${profile.ageUnit}`
      : 'Not specified';
  const weightStr =
    profile.weightValue !== null && profile.weightValue !== undefined
      ? `${profile.weightValue} ${profile.weightUnit}`
      : 'Not provided (Optional)';

  const sortedDosage = [...dosageRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const sortedInteractions = [...interactionRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const dosageLines =
    sortedDosage.length > 0
      ? sortedDosage.flatMap((r, i) => [
          `  ${i + 1}. ${r.medicationName} (${r.drugCategory}) — ${new Date(r.createdAt).toLocaleDateString()}`,
          ...wrapText(
            `Patient Snapshot: ${r.sexDisplay ? `Sex: ${r.sexDisplay} | ` : ''}Age: ${r.ageDisplay} | Weight: ${r.weightDisplay}`,
            76,
            '     ',
            '     '
          ),
          ...wrapText(
            `Dosage: ${r.recommendedDose} | Frequency: ${r.frequency} | Max Daily: ${r.maxDailyLimit}`,
            76,
            '     ',
            '     '
          ),
          ...wrapText(
            `Safety Status: Allergy ${r.allergyStatus.toUpperCase()} | Protocol ${r.verificationStatus.toUpperCase()}`,
            76,
            '     ',
            '     '
          ),
          ...(r.summaryNotes ? wrapText(`Notes: ${r.summaryNotes}`, 76, '     ', '     ') : []),
          '',
        ])
      : ['No saved dosage verification records yet.'];

  const interactionLines =
    sortedInteractions.length > 0
      ? sortedInteractions.flatMap((r, i) => [
          `  ${i + 1}. ${r.medications.join(' + ')} [${r.overallSeverity.toUpperCase()}] — ${new Date(r.createdAt).toLocaleDateString()}`,
          ...wrapText(`Summary: ${r.summary}`, 76, '     ', '     '),
          ...wrapText(`Guidance: ${r.actionGuidance}`, 76, '     ', '     '),
          '',
        ])
      : ['No saved drug-to-drug interaction reports yet.'];

  return buildStructuredReport({
    reportTitle: 'Complete Personal Patient Health Record',
    reportCode: 'RECORD',
    subtitle: 'Continuity-of-Care Export for Your Physician or Pharmacist',
    sections: [
      {
        title: 'Patient Demographics & Baseline Profile',
        lines: formatKeyValueRows([
          { label: 'Patient Name', value: profile.displayName || 'Patient Account' },
          { label: 'Sex', value: sexStr },
          { label: 'Age', value: ageStr },
          { label: 'Weight (Optional)', value: weightStr },
        ]),
      },
      {
        title: 'Documented Allergies & Active Medications',
        lines: formatKeyValueRows([
          {
            label: 'Documented Allergies',
            value: profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None recorded',
          },
          {
            label: 'Active Medications',
            value:
              profile.currentMedications.length > 0
                ? profile.currentMedications.join(', ')
                : 'None recorded',
          },
        ]),
      },
      {
        title: `Saved Dosage Verification History (${sortedDosage.length})`,
        lines: dosageLines,
      },
      {
        title: `Saved Drug-to-Drug Interaction History (${sortedInteractions.length})`,
        lines: interactionLines,
      },
    ],
    disclaimer:
      'CONFIDENTIAL PATIENT RECORD — Present this structured export to your doctor or pharmacist during visits. Always verify medication changes with a licensed healthcare professional.',
  });
}

export async function buildVerifiedPatientRecordJson(
  profile: PatientProfile,
  dosageRecords: SavedDosageRecord[],
  interactionRecords: SavedInteractionRecord[]
): Promise<string> {
  const sortedDosage = [...dosageRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const sortedInteractions = [...interactionRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const payload = {
    schemaVersion: '1.2.0',
    source: 'Know Your Consumption(KYC) designed by Manoj',
    exportedAt: new Date().toISOString(),
    sequenceOrder: [
      '1. patientProfile',
      '2. dosageRecords (newest first)',
      '3. interactionRecords (newest first)',
    ],
    patientProfile: {
      displayName: profile.displayName || 'Patient',
      sex: profile.sex,
      ageValue: profile.ageValue,
      ageUnit: profile.ageUnit,
      weightValue: profile.weightValue,
      weightUnit: profile.weightUnit,
      allergies: profile.allergies,
      currentMedications: profile.currentMedications,
    },
    dosageRecords: sortedDosage.map(({ source: _src, userId: _uid, ...rest }) => rest),
    interactionRecords: sortedInteractions.map(({ source: _src, userId: _uid, ...rest }) => rest),
  };

  const canonicalString = JSON.stringify(payload);
  const sha256Checksum = await computeSha256Hex(canonicalString);

  return JSON.stringify(
    {
      integrity: {
        algorithm: 'SHA-256',
        checksum: sha256Checksum,
      },
      record: payload,
    },
    null,
    2
  );
}
