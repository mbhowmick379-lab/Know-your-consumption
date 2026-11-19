import type {
  DosageAnalysisResult,
  PatientProfile,
  SavedDosageRecord,
  SavedInteractionRecord,
} from '../types/clinical';

export type PrintPayload =
  | {
      mode: 'dosage';
      result: DosageAnalysisResult;
      meta: { sexDisplay?: string; ageDisplay: string; weightDisplay: string; allergies: string[] };
      patientName: string;
    }
  | {
      mode: 'full-record';
      profile: PatientProfile;
      dosageRecords: SavedDosageRecord[];
      interactionRecords: SavedInteractionRecord[];
    };

export function PrintableSummary({ payload }: { payload: PrintPayload | null }) {
  if (!payload) return null;

  if (payload.mode === 'dosage') {
    const { result, meta, patientName } = payload;
    return (
      <div className="hidden print-only p-4 text-slate-900 space-y-6">
        <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Know Your Consumption(KYC) — Patient Medication Summary
            </p>
            <h1 className="text-2xl font-bold">{result.medicationName}</h1>
          </div>
          <p className="text-xs font-mono">
            Generated: {new Date(result.generatedAt).toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 rounded p-3">
          <div>
            <strong>Patient:</strong> {patientName || 'Patient Self-Lookup'}
          </div>
          <div>
            <strong>Sex:</strong>{' '}
            {meta.sexDisplay ||
              (result.patientSex === 'female'
                ? 'Female'
                : result.patientSex === 'male'
                  ? 'Male'
                  : 'Not specified')}
          </div>
          <div>
            <strong>Age:</strong> {meta.ageDisplay} ({result.ageGroupLabel})
          </div>
          <div>
            <strong>Weight:</strong> {meta.weightDisplay}
          </div>
          <div className="col-span-2">
            <strong>Allergies Screened:</strong>{' '}
            {meta.allergies.length > 0 ? meta.allergies.join(', ') : 'None recorded'}
          </div>
        </div>

        <div className="border border-slate-300 rounded p-3 space-y-1 text-xs">
          <p className="font-bold">
            Allergy Screening ({result.allergyAlert.severity.toUpperCase()}):{' '}
            {result.allergyAlert.headline}
          </p>
          <p>{result.allergyAlert.explanation}</p>
        </div>

        <table className="w-full text-xs border-collapse border border-slate-300">
          <tbody>
            <tr className="border-b border-slate-300">
              <th className="text-left p-2 bg-slate-100 w-44">Recommended Dose</th>
              <td className="p-2 font-mono">{result.recommendedDose}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="text-left p-2 bg-slate-100">Liquid Dose (mL)</th>
              <td className="p-2 font-mono">{result.recommendedDoseMl}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="text-left p-2 bg-slate-100">Frequency</th>
              <td className="p-2 font-mono">{result.frequency}</td>
            </tr>
            <tr className="border-b border-slate-300">
              <th className="text-left p-2 bg-slate-100">Maximum Daily Limit</th>
              <td className="p-2 font-mono">{result.maxDailyLimit}</td>
            </tr>
            <tr>
              <th className="text-left p-2 bg-slate-100">Typical Course</th>
              <td className="p-2 font-mono">{result.typicalDuration}</td>
            </tr>
          </tbody>
        </table>

        {result.sexSpecificGuidance && (
          <div className="border border-slate-300 rounded p-3 text-xs">
            <strong>Sex-Specific Clinical Guidance:</strong> {result.sexSpecificGuidance}
          </div>
        )}

        {result.isCombinedComposition && result.compositionBreakdown && result.compositionBreakdown.length > 0 && (
          <div className="space-y-2 text-xs">
            <h2 className="font-bold text-sm">
              Combined Multi-Composition Breakdown ({result.compositionBreakdown.length} Ingredients)
            </h2>
            {result.combinedSynergyAndOverlapSummary && (
              <p className="border border-slate-300 rounded p-2.5">
                {result.combinedSynergyAndOverlapSummary}
              </p>
            )}
            <table className="w-full text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="text-left p-2">Composition</th>
                  <th className="text-left p-2">Role</th>
                  <th className="text-left p-2">Per-Dose</th>
                  <th className="text-left p-2">Max Daily</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {result.compositionBreakdown.map((item, idx) => (
                  <tr key={idx} className="border-b border-slate-300">
                    <td className="p-2 font-semibold">{item.compositionName}</td>
                    <td className="p-2">{item.role}</td>
                    <td className="p-2 font-mono">{item.perDoseAmount}</td>
                    <td className="p-2 font-mono">{item.maxDailyLimit}</td>
                    <td className="p-2 uppercase font-bold">{item.safetyStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-1 text-xs">
          <h2 className="font-bold text-sm">Automated Verification Protocol</h2>
          {result.verificationChecks.map((c) => (
            <p key={c.id}>
              [{c.status.toUpperCase()}] <strong>{c.label}:</strong> {c.detail}
            </p>
          ))}
        </div>

        <div className="space-y-1 text-xs">
          <h2 className="font-bold text-sm">Administration Instructions</h2>
          <ul className="list-disc pl-5 space-y-1">
            {result.administrationTips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          {result.antibioticCourseNote && (
            <p className="pt-1">
              <strong>Antibiotic Course Note:</strong> {result.antibioticCourseNote}
            </p>
          )}
        </div>

        <p className="text-[11px] text-slate-600 border-t border-slate-300 pt-3">
          {result.patientDisclaimer}
        </p>
      </div>
    );
  }

  const { profile, dosageRecords, interactionRecords } = payload;
  return (
    <div className="hidden print-only p-4 text-slate-900 space-y-6">
      <div className="border-b-2 border-slate-900 pb-3 flex justify-between items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Know Your Consumption(KYC) — Complete Personal Health Record
          </p>
          <h1 className="text-2xl font-bold">{profile.displayName || 'Patient Health Summary'}</h1>
        </div>
        <p className="text-xs font-mono">Exported: {new Date().toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs border border-slate-300 rounded p-3">
        <div>
          <strong>Sex:</strong>{' '}
          {profile.sex === 'female' ? 'Female' : profile.sex === 'male' ? 'Male' : 'Not specified'}
        </div>
        <div>
          <strong>Age:</strong>{' '}
          {profile.ageValue !== null ? `${profile.ageValue} ${profile.ageUnit}` : 'Not specified'}
        </div>
        <div className="col-span-2">
          <strong>Weight (Optional):</strong>{' '}
          {profile.weightValue !== null
            ? `${profile.weightValue} ${profile.weightUnit}`
            : 'Not provided'}
        </div>
        <div className="col-span-2">
          <strong>Documented Allergies:</strong>{' '}
          {profile.allergies.length > 0 ? profile.allergies.join(', ') : 'None recorded'}
        </div>
        <div className="col-span-2">
          <strong>Current Active Medications:</strong>{' '}
          {profile.currentMedications.length > 0
            ? profile.currentMedications.join(', ')
            : 'None recorded'}
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <h2 className="font-bold text-sm">Saved Dosage Verifications ({dosageRecords.length})</h2>
        {dosageRecords.length === 0 ? (
          <p>No saved dosage checks.</p>
        ) : (
          dosageRecords.map((r) => (
            <div key={r.id} className="border border-slate-300 rounded p-2.5 space-y-0.5">
              <p className="font-bold">
                {r.medicationName} ({r.drugCategory}) — {new Date(r.createdAt).toLocaleDateString()}
              </p>
              <p className="font-mono">
                Dose: {r.recommendedDose} | Freq: {r.frequency} | Max: {r.maxDailyLimit}
              </p>
              <p>
                {r.sexDisplay ? `Sex: ${r.sexDisplay} | ` : ''}Age: {r.ageDisplay} | Weight:{' '}
                {r.weightDisplay} | Allergy: {r.allergyStatus.toUpperCase()} | Protocol:{' '}
                {r.verificationStatus.toUpperCase()}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 text-xs">
        <h2 className="font-bold text-sm">
          Saved Drug Interaction Reports ({interactionRecords.length})
        </h2>
        {interactionRecords.length === 0 ? (
          <p>No saved interaction reports.</p>
        ) : (
          interactionRecords.map((r) => (
            <div key={r.id} className="border border-slate-300 rounded p-2.5 space-y-0.5">
              <p className="font-bold">
                {r.medications.join(' + ')} [{r.overallSeverity.toUpperCase()}] —{' '}
                {new Date(r.createdAt).toLocaleDateString()}
              </p>
              <p>{r.summary}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
