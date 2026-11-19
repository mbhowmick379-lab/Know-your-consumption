import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileJson,
  FileText,
  Lock,
  LogIn,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { AgeUnit, PatientSex, WeightUnit } from '../types/clinical';
import { COMMON_ALLERGENS } from '../utils/clinicalSafety';
import {
  buildVerifiedPatientRecordJson,
  formatFullPatientRecordText,
  triggerFileDownload,
} from '../utils/recordExport';
import { usePatient } from '../contexts/PatientContext';

interface HealthRecordsProps {
  onPrintFullRecord: () => void;
}

export function HealthRecords({ onPrintFullRecord }: HealthRecordsProps) {
  const {
    user,
    authBusy,
    authError,
    profile,
    profileSaving,
    dosageRecords,
    interactionRecords,
    signInWithGoogle,
    updateProfile,
    deleteDosageRecord,
    deleteInteractionRecord,
    loadSamplePatientData,
  } = usePatient();

  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [sex, setSex] = useState<PatientSex | null>(profile.sex || null);
  const [ageInput, setAgeInput] = useState(
    profile.ageValue !== null && profile.ageValue !== undefined ? String(profile.ageValue) : ''
  );
  const [ageUnit, setAgeUnit] = useState<AgeUnit>(profile.ageUnit || 'years');
  const [weightInput, setWeightInput] = useState(
    profile.weightValue !== null && profile.weightValue !== undefined ? String(profile.weightValue) : ''
  );
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(profile.weightUnit || 'kg');
  const [allergies, setAllergies] = useState<string[]>(profile.allergies || []);
  const [newAllergy, setNewAllergy] = useState('');
  const [currentMeds, setCurrentMeds] = useState<string[]>(profile.currentMedications || []);
  const [newMed, setNewMed] = useState('');

  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'dosage' | 'interactions'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastChecksum, setLastChecksum] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile.displayName || '');
    setSex(profile.sex || null);
    setAgeInput(profile.ageValue !== null && profile.ageValue !== undefined ? String(profile.ageValue) : '');
    setAgeUnit(profile.ageUnit || 'years');
    setWeightInput(
      profile.weightValue !== null && profile.weightValue !== undefined ? String(profile.weightValue) : ''
    );
    setWeightUnit(profile.weightUnit || 'kg');
    setAllergies(profile.allergies || []);
    setCurrentMeds(profile.currentMedications || []);
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSavedToast(false);
    await updateProfile({
      displayName,
      sex,
      ageValue: ageInput.trim() === '' ? null : Number(ageInput),
      ageUnit,
      weightValue: weightInput.trim() === '' ? null : Number(weightInput),
      weightUnit,
      allergies,
      currentMedications: currentMeds,
    });
    setProfileSavedToast(true);
    setTimeout(() => setProfileSavedToast(false), 3000);
  };

  const addAllergy = (value: string) => {
    const clean = value.trim();
    if (!clean) return;
    if (!allergies.some((a) => a.toLowerCase() === clean.toLowerCase())) {
      setAllergies((prev) => [...prev, clean.slice(0, 80)]);
    }
    setNewAllergy('');
  };

  const addCurrentMed = () => {
    const clean = newMed.trim();
    if (!clean) return;
    if (!currentMeds.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      setCurrentMeds((prev) => [...prev, clean.slice(0, 100)]);
    }
    setNewMed('');
  };

  const handleDownloadTxt = () => {
    const content = formatFullPatientRecordText(profile, dosageRecords, interactionRecords);
    const dateSlug = new Date().toISOString().slice(0, 10);
    triggerFileDownload(`kyc-health-record-${dateSlug}.txt`, content, 'text/plain;charset=utf-8');
  };

  const handleDownloadVerifiedJson = async () => {
    const json = await buildVerifiedPatientRecordJson(profile, dosageRecords, interactionRecords);
    const parsed = JSON.parse(json) as { integrity: { checksum: string } };
    setLastChecksum(parsed.integrity.checksum);
    const dateSlug = new Date().toISOString().slice(0, 10);
    triggerFileDownload(
      `kyc-verified-health-record-${dateSlug}.json`,
      json,
      'application/json;charset=utf-8'
    );
  };

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredDosages = dosageRecords.filter((r) => {
    if (!normalizedSearch) return true;
    return (
      r.medicationName.toLowerCase().includes(normalizedSearch) ||
      r.drugCategory.toLowerCase().includes(normalizedSearch) ||
      r.summaryNotes.toLowerCase().includes(normalizedSearch)
    );
  });

  const filteredInteractions = interactionRecords.filter((r) => {
    if (!normalizedSearch) return true;
    return (
      r.medications.some((m) => m.toLowerCase().includes(normalizedSearch)) ||
      r.summary.toLowerCase().includes(normalizedSearch)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header & Account Security Status */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold text-sky-400">
            Know Your Consumption(KYC) Personal Health Records · Private &amp; Downloadable
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50 text-balance">
            Your private medication profile and continuity records
          </h1>
          <p className="text-[15px] text-slate-300 leading-relaxed">
            Store your allergies, active medications, and verified dosage checks in one secure
            location. Download a portable record anytime to share with your doctor or pharmacist.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSamplePatientData()}
          className="self-start md:self-auto px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0"
        >
          Fill Sample Patient Profile
        </button>
      </div>

      {/* Login / Private Isolation Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            {user ? (
              <>
                <h2 className="text-sm font-semibold text-slate-100">
                  Signed in as {user.displayName || user.email}
                </h2>
                <p className="text-xs text-slate-300">
                  Your health profile, allergies, and history are strictly isolated under your private
                  patient account and synced across sessions.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-slate-100">
                  Local session active — Sign in for private cloud sync
                </h2>
                <p className="text-xs text-slate-300">
                  Your profile and saved checks are currently kept in this browser only. Sign in with
                  your Google account to securely sync and protect your health records across devices.
                </p>
                {authError && <p className="text-xs font-medium text-rose-400 pt-1">{authError}</p>}
              </>
            )}
          </div>
        </div>

        {!user && (
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={authBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-lg transition-all whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {authBusy ? 'Signing In...' : 'Sign In with Google'}
          </button>
        )}
      </div>

      {/* Secure Health Record Export Hub */}
      <section
        aria-label="Secure health record downloads"
        className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-100">
              Download Your Complete Health Record
            </h2>
            <p className="text-xs text-slate-300">
              Includes your profile, documented allergies ({profile.allergies.length}), active
              medications ({profile.currentMedications.length}), dosage summaries (
              {dosageRecords.length}), and interaction reports ({interactionRecords.length}).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onPrintFullRecord}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileText className="w-3.5 h-3.5" aria-hidden="true" />
              Clinician Handoff (.txt)
            </button>
            <button
              type="button"
              onClick={() => void handleDownloadVerifiedJson()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileJson className="w-3.5 h-3.5" aria-hidden="true" />
              Verified Portable JSON
            </button>
          </div>
        </div>

        {lastChecksum && (
          <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Export downloaded · SHA-256 Integrity Checksum:{' '}
              <code className="font-mono text-[11px]">{lastChecksum.slice(0, 32)}...</code>
            </span>
          </div>
        )}
      </section>

      {/* Main 2-Column Layout: Left Profile Editor | Right Saved Records History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Patient Clinical Profile */}
        <section
          aria-label="Patient profile settings"
          className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-slate-100">Patient Clinical Profile</h2>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-name" className="block text-xs font-semibold text-slate-300">
                Patient Name (For Summary Exports)
              </label>
              <input
                id="profile-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g., Jordan Patel"
                className="w-full px-3.5 py-2 text-sm text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-slate-300">Patient Sex</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Default patient sex">
                <button
                  type="button"
                  onClick={() => setSex('male')}
                  aria-pressed={sex === 'male'}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-colors ${
                    sex === 'male'
                      ? 'bg-sky-600 border-sky-400 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-sky-500/60'
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setSex('female')}
                  aria-pressed={sex === 'female'}
                  className={`py-2 px-3 text-xs font-bold rounded-lg border transition-colors ${
                    sex === 'female'
                      ? 'bg-fuchsia-600 border-fuchsia-400 text-white'
                      : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-fuchsia-500/60'
                  }`}
                >
                  Female
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="profile-age" className="block text-xs font-semibold text-slate-300">
                  Default Age
                </label>
                <div className="flex gap-1">
                  <input
                    id="profile-age"
                    type="number"
                    min={0}
                    max={120}
                    step="any"
                    value={ageInput}
                    onChange={(e) => setAgeInput(e.target.value)}
                    placeholder="Age"
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <select
                    aria-label="Default age unit"
                    value={ageUnit}
                    onChange={(e) => setAgeUnit(e.target.value as AgeUnit)}
                    className="px-2 py-2 text-xs text-slate-100 bg-slate-950 border border-slate-700 rounded-lg"
                  >
                    <option value="years">Yrs</option>
                    <option value="months">Mos</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="profile-weight" className="block text-xs font-semibold text-slate-300">
                  Weight (Optional)
                </label>
                <div className="flex gap-1">
                  <input
                    id="profile-weight"
                    type="number"
                    min={0.5}
                    max={350}
                    step="any"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-2.5 py-2 text-sm font-mono tabular-nums text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <select
                    aria-label="Default weight unit"
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
                    className="px-2 py-2 text-xs text-slate-100 bg-slate-950 border border-slate-700 rounded-lg"
                  >
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Allergies Manager */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="block text-xs font-semibold text-slate-300">
                Documented Allergies ({allergies.length})
              </span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAllergy(newAllergy);
                    }
                  }}
                  aria-label="Add documented allergy"
                  placeholder="e.g., Penicillin, Sulfa"
                  className="flex-1 px-3 py-2 text-xs text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={() => addAllergy(newAllergy)}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_ALLERGENS.slice(0, 5).map((item) => {
                  const has = allergies.some((a) => a.toLowerCase() === item.toLowerCase());
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        has
                          ? setAllergies((prev) =>
                              prev.filter((a) => a.toLowerCase() !== item.toLowerCase())
                            )
                          : addAllergy(item)
                      }
                      className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                        has
                          ? 'bg-rose-950/70 border-rose-500/60 text-rose-200 font-semibold'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      {has ? `✓ ${item}` : `+ ${item}`}
                    </button>
                  );
                })}
              </div>
              {allergies.length > 0 && (
                <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                  {allergies.map((a) => (
                    <li
                      key={a}
                      className="px-3 py-2 text-xs flex items-center justify-between text-slate-200 bg-slate-950/75"
                    >
                      <span>{a}</span>
                      <button
                        type="button"
                        onClick={() => setAllergies((prev) => prev.filter((x) => x !== a))}
                        aria-label={`Remove allergy ${a}`}
                        className="text-slate-400 hover:text-rose-400 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Active Current Medications Manager */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="block text-xs font-semibold text-slate-300">
                Current Active Medications ({currentMeds.length})
              </span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={newMed}
                  onChange={(e) => setNewMed(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCurrentMed();
                    }
                  }}
                  aria-label="Add active current medication"
                  placeholder="e.g., Lisinopril, Warfarin, Lipitor, Metformin"
                  className="flex-1 px-3 py-2 text-xs text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={addCurrentMed}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add
                </button>
              </div>
              {currentMeds.length > 0 && (
                <ul className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden">
                  {currentMeds.map((m) => (
                    <li
                      key={m}
                      className="px-3 py-2 text-xs flex items-center justify-between text-slate-200 bg-slate-950/75"
                    >
                      <span>{m}</span>
                      <button
                        type="button"
                        onClick={() => setCurrentMeds((prev) => prev.filter((x) => x !== m))}
                        aria-label={`Remove current medication ${m}`}
                        className="text-slate-400 hover:text-rose-400 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="submit"
                disabled={profileSaving}
                className="px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 rounded-lg shadow-xs transition-all disabled:opacity-60"
              >
                {profileSaving ? 'Saving Profile...' : 'Save Patient Profile'}
              </button>
              {profileSavedToast && (
                <span role="status" className="text-xs font-semibold text-emerald-400">
                  Profile updated
                </span>
              )}
            </div>
          </form>
        </section>

        {/* Right: Saved Dosage & Interaction History */}
        <section
          aria-label="Saved clinical records history"
          className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-100">Saved Clinical History</h2>
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg self-start">
              {(
                [
                  { id: 'all', label: `All (${dosageRecords.length + interactionRecords.length})` },
                  { id: 'dosage', label: `Dosages (${dosageRecords.length})` },
                  { id: 'interactions', label: `Interactions (${interactionRecords.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHistoryFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    historyFilter === tab.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search saved records"
              placeholder="Search saved medications, categories, or notes..."
              className="w-full pl-9 pr-3 py-2 text-xs text-slate-100 bg-slate-950 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder:text-slate-500"
            />
          </div>

          {filteredDosages.length === 0 && filteredInteractions.length === 0 ? (
            <div className="border border-dashed border-slate-700 rounded-xl p-8 text-center space-y-2 bg-slate-950/50">
              <Download className="w-6 h-6 text-slate-500 mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-200">No saved health records yet</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Run a dosage verification or drug interaction check and click &ldquo;Save Record&rdquo;
                to build your downloadable personal medical history.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(historyFilter === 'all' || historyFilter === 'dosage') &&
                filteredDosages.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400">Dosage Verifications</h3>
                    <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                      {filteredDosages.map((rec) => (
                        <li key={rec.id} className="p-4 bg-slate-950/75 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <span className="font-semibold text-teal-400">{rec.drugCategory}</span>
                                {rec.sexDisplay && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-fuchsia-300 font-medium">
                                      Sex: {rec.sexDisplay}
                                    </span>
                                  </>
                                )}
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">Age {rec.ageDisplay}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">Weight {rec.weightDisplay}</span>
                                <span aria-hidden="true">·</span>
                                <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm font-bold text-slate-100 mt-0.5">
                                {rec.medicationName}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteDosageRecord(rec.id)}
                              aria-label={`Delete dosage record for ${rec.medicationName}`}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-200 bg-slate-900/90 border border-slate-800 rounded-lg p-3">
                            <div>
                              <span className="block text-[11px] text-slate-400 mb-0.5">Dose</span>
                              <span
                                className={
                                  rec.verificationStatus === 'contraindicated'
                                    ? 'font-semibold text-rose-400'
                                    : 'font-mono tabular-nums font-semibold text-slate-100'
                                }
                              >
                                {rec.recommendedDose}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-400 mb-0.5">Frequency</span>
                              <span className="font-mono tabular-nums font-medium text-slate-200">
                                {rec.frequency}
                              </span>
                            </div>
                            <div>
                              <span className="block text-[11px] text-slate-400 mb-0.5">Max Daily</span>
                              <span className="font-mono tabular-nums font-medium text-slate-200">
                                {rec.maxDailyLimit}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <span
                              className={`font-semibold ${
                                rec.allergyStatus === 'critical'
                                  ? 'text-rose-400'
                                  : rec.allergyStatus === 'caution'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                              }`}
                            >
                              Allergy: {rec.allergyStatus.toUpperCase()}
                            </span>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span
                              className={`font-semibold ${
                                rec.verificationStatus === 'contraindicated'
                                  ? 'text-rose-400'
                                  : rec.verificationStatus === 'caution'
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                              }`}
                            >
                              Protocol: {rec.verificationStatus.toUpperCase()}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {(historyFilter === 'all' || historyFilter === 'interactions') &&
                filteredInteractions.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-slate-400">
                      Drug-to-Drug Interaction Reports
                    </h3>
                    <ul className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
                      {filteredInteractions.map((rec) => (
                        <li key={rec.id} className="p-4 bg-slate-950/75 space-y-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <span
                                  className={`font-semibold uppercase ${
                                    rec.overallSeverity === 'major'
                                      ? 'text-rose-400'
                                      : rec.overallSeverity === 'moderate'
                                        ? 'text-amber-400'
                                        : 'text-emerald-400'
                                  }`}
                                >
                                  Severity: {rec.overallSeverity}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{new Date(rec.createdAt).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm font-bold text-slate-100 mt-0.5">
                                {rec.medications.join(' + ')}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void deleteInteractionRecord(rec.id)}
                              aria-label={`Delete interaction report for ${rec.medications.join(' and ')}`}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{rec.summary}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
