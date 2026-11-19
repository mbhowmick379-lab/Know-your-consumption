import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import type {
  DosageAnalysisResult,
  InteractionAnalysisResult,
  PatientProfile,
  SavedDosageRecord,
  SavedInteractionRecord,
} from '../types/clinical';
import { sanitizeString, sanitizeStringList } from '../utils/clinicalSafety';

const LOCAL_STORAGE_PROFILE_KEY = 'dosesafe_local_profile_v1';
const LOCAL_STORAGE_DOSAGES_KEY = 'dosesafe_local_dosages_v1';
const LOCAL_STORAGE_INTERACTIONS_KEY = 'dosesafe_local_interactions_v1';

const DEFAULT_PROFILE: PatientProfile = {
  userId: 'guest',
  displayName: '',
  sex: null,
  ageValue: null,
  ageUnit: 'years',
  weightValue: null,
  weightUnit: 'kg',
  allergies: [],
  currentMedications: [],
};

function makeRecordId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${randomPart}`;
}

function timestampToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function readLocalJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface PatientContextValue {
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  profile: PatientProfile;
  profileSaving: boolean;
  dosageRecords: SavedDosageRecord[];
  interactionRecords: SavedInteractionRecord[];
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<PatientProfile>) => Promise<void>;
  saveDosageCheck: (
    result: DosageAnalysisResult,
    meta: { sexDisplay?: string; ageDisplay: string; weightDisplay: string; allergiesChecked: string[] }
  ) => Promise<SavedDosageRecord>;
  deleteDosageRecord: (recordId: string) => Promise<void>;
  saveInteractionCheck: (result: InteractionAnalysisResult) => Promise<SavedInteractionRecord>;
  deleteInteractionRecord: (recordId: string) => Promise<void>;
  loadSamplePatientData: () => Promise<void>;
}

const PatientContext = createContext<PatientContextValue | null>(null);

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<PatientProfile>(() =>
    readLocalJson<PatientProfile>(LOCAL_STORAGE_PROFILE_KEY, DEFAULT_PROFILE)
  );
  const [profileSaving, setProfileSaving] = useState(false);
  const [dosageRecords, setDosageRecords] = useState<SavedDosageRecord[]>(() =>
    readLocalJson<SavedDosageRecord[]>(LOCAL_STORAGE_DOSAGES_KEY, [])
  );
  const [interactionRecords, setInteractionRecords] = useState<SavedInteractionRecord[]>(() =>
    readLocalJson<SavedInteractionRecord[]>(LOCAL_STORAGE_INTERACTIONS_KEY, [])
  );

  // Sync Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(readLocalJson<PatientProfile>(LOCAL_STORAGE_PROFILE_KEY, DEFAULT_PROFILE));
        setDosageRecords(readLocalJson<SavedDosageRecord[]>(LOCAL_STORAGE_DOSAGES_KEY, []));
        setInteractionRecords(readLocalJson<SavedInteractionRecord[]>(LOCAL_STORAGE_INTERACTIONS_KEY, []));
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore real-time listeners strictly when authenticated & ready
  useEffect(() => {
    if (!authReady || !user) return;

    const profilePath = `users/${user.uid}/private/profile`;
    const profileRef = doc(db, 'users', user.uid, 'private', 'profile');

    const unsubProfile = onSnapshot(
      profileRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setProfile({
            userId: user.uid,
            displayName: typeof data.displayName === 'string' ? data.displayName : user.displayName || '',
            sex: data.sex === 'male' ? 'male' : data.sex === 'female' ? 'female' : null,
            ageValue: typeof data.ageValue === 'number' ? data.ageValue : null,
            ageUnit: data.ageUnit === 'months' ? 'months' : 'years',
            weightValue: typeof data.weightValue === 'number' ? data.weightValue : null,
            weightUnit: data.weightUnit === 'lbs' ? 'lbs' : 'kg',
            allergies: Array.isArray(data.allergies) ? data.allergies : [],
            currentMedications: Array.isArray(data.currentMedications) ? data.currentMedications : [],
            updatedAt: timestampToIso(data.updatedAt),
          });
        } else {
          setProfile({
            ...DEFAULT_PROFILE,
            userId: user.uid,
            displayName: user.displayName || '',
          });
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, profilePath);
      }
    );

    const dosagesPath = `users/${user.uid}/dosageRecords`;
    const dosagesQuery = query(
      collection(db, 'users', user.uid, 'dosageRecords'),
      where('userId', '==', user.uid)
    );

    const unsubDosages = onSnapshot(
      dosagesQuery,
      (snap) => {
        const items: SavedDosageRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: user.uid,
              medicationName: String(data.medicationName ?? ''),
              drugCategory: String(data.drugCategory ?? 'Medication'),
              sexDisplay: typeof data.sexDisplay === 'string' ? data.sexDisplay : undefined,
              ageDisplay: String(data.ageDisplay ?? ''),
              weightDisplay: String(data.weightDisplay ?? 'Not provided'),
              recommendedDose: String(data.recommendedDose ?? ''),
              frequency: String(data.frequency ?? ''),
              maxDailyLimit: String(data.maxDailyLimit ?? ''),
              duration: String(data.duration ?? ''),
              allergyStatus: (data.allergyStatus ?? 'clear') as SavedDosageRecord['allergyStatus'],
              verificationStatus: (data.verificationStatus ?? 'verified') as SavedDosageRecord['verificationStatus'],
              summaryNotes: String(data.summaryNotes ?? ''),
              allergiesChecked: Array.isArray(data.allergiesChecked) ? data.allergiesChecked : [],
              createdAt: timestampToIso(data.createdAt),
              source: 'cloud' as const,
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setDosageRecords(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, dosagesPath);
      }
    );

    const interactionsPath = `users/${user.uid}/interactionRecords`;
    const interactionsQuery = query(
      collection(db, 'users', user.uid, 'interactionRecords'),
      where('userId', '==', user.uid)
    );

    const unsubInteractions = onSnapshot(
      interactionsQuery,
      (snap) => {
        const items: SavedInteractionRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: user.uid,
              medications: Array.isArray(data.medications) ? data.medications : [],
              overallSeverity: (data.overallSeverity ?? 'none') as SavedInteractionRecord['overallSeverity'],
              summary: String(data.summary ?? ''),
              actionGuidance: String(data.actionGuidance ?? ''),
              createdAt: timestampToIso(data.createdAt),
              source: 'cloud' as const,
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setInteractionRecords(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, interactionsPath);
      }
    );

    return () => {
      unsubProfile();
      unsubDosages();
      unsubInteractions();
    };
  }, [authReady, user]);

  const signInWithGoogle = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in with Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign out.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<PatientProfile>) => {
      const nextSex =
        patch.sex !== undefined
          ? patch.sex === 'male' || patch.sex === 'female'
            ? patch.sex
            : null
          : profile.sex ?? null;

      const next: PatientProfile = {
        ...profile,
        ...patch,
        userId: user ? user.uid : 'guest',
        displayName: sanitizeString(patch.displayName ?? profile.displayName ?? '', 100),
        sex: nextSex,
        ageUnit: (patch.ageUnit ?? profile.ageUnit) === 'months' ? 'months' : 'years',
        weightUnit: (patch.weightUnit ?? profile.weightUnit) === 'lbs' ? 'lbs' : 'kg',
        allergies: sanitizeStringList(patch.allergies ?? profile.allergies, 25, 80),
        currentMedications: sanitizeStringList(patch.currentMedications ?? profile.currentMedications, 30, 100),
        updatedAt: new Date().toISOString(),
      };

      if (next.ageValue !== null && (!Number.isFinite(next.ageValue) || next.ageValue < 0 || next.ageValue > 120)) {
        next.ageValue = null;
      }
      if (
        next.weightValue !== null &&
        (!Number.isFinite(next.weightValue) || next.weightValue < 0.5 || next.weightValue > 350)
      ) {
        next.weightValue = null;
      }

      if (!user) {
        setProfile(next);
        window.localStorage.setItem(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(next));
        return;
      }

      setProfileSaving(true);
      const profilePath = `users/${user.uid}/private/profile`;
      try {
        const profileRef = doc(db, 'users', user.uid, 'private', 'profile');
        const existingSnap = await getDoc(profileRef);
        const nowTs = serverTimestamp();

        const payload: Record<string, unknown> = {
          userId: user.uid,
          displayName: next.displayName,
          sex: next.sex,
          ageValue: next.ageValue,
          ageUnit: next.ageUnit,
          weightValue: next.weightValue,
          weightUnit: next.weightUnit,
          allergies: next.allergies,
          currentMedications: next.currentMedications,
          updatedAt: nowTs,
        };

        if (existingSnap.exists()) {
          await setDoc(
            profileRef,
            {
              ...payload,
              createdAt: existingSnap.data().createdAt,
            },
            { merge: false }
          );
        } else {
          await setDoc(profileRef, {
            ...payload,
            createdAt: nowTs,
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, profilePath);
      } finally {
        setProfileSaving(false);
      }
    },
    [profile, user]
  );

  const saveDosageCheck = useCallback(
    async (
      result: DosageAnalysisResult,
      meta: { sexDisplay?: string; ageDisplay: string; weightDisplay: string; allergiesChecked: string[] }
    ): Promise<SavedDosageRecord> => {
      const recordId = makeRecordId('dose');
      const cleanedAllergies = sanitizeStringList(meta.allergiesChecked, 25, 80);
      const summaryText = sanitizeString(
        [result.allergyAlert.headline, result.weightCalculationDetail, result.antibioticCourseNote]
          .filter(Boolean)
          .join(' — '),
        2000
      );

      const localRecord: SavedDosageRecord = {
        id: recordId,
        userId: user ? user.uid : 'guest',
        medicationName: sanitizeString(result.medicationName, 120),
        drugCategory: sanitizeString(result.drugCategory || 'Medication', 60),
        sexDisplay: sanitizeString(meta.sexDisplay || '', 20),
        ageDisplay: sanitizeString(meta.ageDisplay, 40),
        weightDisplay: sanitizeString(meta.weightDisplay || 'Not provided', 40),
        recommendedDose: sanitizeString(result.recommendedDose, 300),
        frequency: sanitizeString(result.frequency, 200),
        maxDailyLimit: sanitizeString(result.maxDailyLimit, 200),
        duration: sanitizeString(result.typicalDuration || '', 200),
        allergyStatus: result.allergyAlert.severity,
        verificationStatus: result.verificationStatus,
        summaryNotes: summaryText,
        allergiesChecked: cleanedAllergies,
        createdAt: new Date().toISOString(),
        source: user ? 'cloud' : 'local',
      };

      if (!user) {
        const updated = [localRecord, ...dosageRecords];
        setDosageRecords(updated);
        window.localStorage.setItem(LOCAL_STORAGE_DOSAGES_KEY, JSON.stringify(updated));
        return localRecord;
      }

      const path = `users/${user.uid}/dosageRecords/${recordId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'dosageRecords', recordId), {
          userId: user.uid,
          medicationName: localRecord.medicationName,
          drugCategory: localRecord.drugCategory,
          sexDisplay: localRecord.sexDisplay || '',
          ageDisplay: localRecord.ageDisplay,
          weightDisplay: localRecord.weightDisplay,
          recommendedDose: localRecord.recommendedDose,
          frequency: localRecord.frequency,
          maxDailyLimit: localRecord.maxDailyLimit,
          duration: localRecord.duration,
          allergyStatus: localRecord.allergyStatus,
          verificationStatus: localRecord.verificationStatus,
          summaryNotes: localRecord.summaryNotes,
          allergiesChecked: localRecord.allergiesChecked,
          createdAt: serverTimestamp(),
        });
        return localRecord;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [dosageRecords, user]
  );

  const deleteDosageRecord = useCallback(
    async (recordId: string) => {
      if (!user) {
        const updated = dosageRecords.filter((r) => r.id !== recordId);
        setDosageRecords(updated);
        window.localStorage.setItem(LOCAL_STORAGE_DOSAGES_KEY, JSON.stringify(updated));
        return;
      }
      const path = `users/${user.uid}/dosageRecords/${recordId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'dosageRecords', recordId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [dosageRecords, user]
  );

  const saveInteractionCheck = useCallback(
    async (result: InteractionAnalysisResult): Promise<SavedInteractionRecord> => {
      const recordId = makeRecordId('inter');
      const cleanedMeds = sanitizeStringList(result.medications, 15, 120);

      const localRecord: SavedInteractionRecord = {
        id: recordId,
        userId: user ? user.uid : 'guest',
        medications: cleanedMeds,
        overallSeverity: result.overallSeverity,
        summary: sanitizeString(result.executiveSummary, 2000),
        actionGuidance: sanitizeString(result.actionGuidance, 1000),
        createdAt: new Date().toISOString(),
        source: user ? 'cloud' : 'local',
      };

      if (!user) {
        const updated = [localRecord, ...interactionRecords];
        setInteractionRecords(updated);
        window.localStorage.setItem(LOCAL_STORAGE_INTERACTIONS_KEY, JSON.stringify(updated));
        return localRecord;
      }

      const path = `users/${user.uid}/interactionRecords/${recordId}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'interactionRecords', recordId), {
          userId: user.uid,
          medications: localRecord.medications,
          overallSeverity: localRecord.overallSeverity,
          summary: localRecord.summary,
          actionGuidance: localRecord.actionGuidance,
          createdAt: serverTimestamp(),
        });
        return localRecord;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [interactionRecords, user]
  );

  const deleteInteractionRecord = useCallback(
    async (recordId: string) => {
      if (!user) {
        const updated = interactionRecords.filter((r) => r.id !== recordId);
        setInteractionRecords(updated);
        window.localStorage.setItem(LOCAL_STORAGE_INTERACTIONS_KEY, JSON.stringify(updated));
        return;
      }
      const path = `users/${user.uid}/interactionRecords/${recordId}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'interactionRecords', recordId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [interactionRecords, user]
  );

  const loadSamplePatientData = useCallback(async () => {
    await updateProfile({
      displayName: user?.displayName || 'Maya Lin',
      sex: 'female',
      ageValue: 34,
      ageUnit: 'years',
      weightValue: 64,
      weightUnit: 'kg',
      allergies: ['Penicillin', 'Sulfa / Sulfonamides'],
      currentMedications: ['Lisinopril', 'Atorvastatin'],
    });
  }, [updateProfile, user]);

  return (
    <PatientContext.Provider
      value={{
        user,
        authReady,
        authBusy,
        authError,
        profile,
        profileSaving,
        dosageRecords,
        interactionRecords,
        signInWithGoogle,
        signOut,
        updateProfile,
        saveDosageCheck,
        deleteDosageRecord,
        saveInteractionCheck,
        deleteInteractionRecord,
        loadSamplePatientData,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const ctx = useContext(PatientContext);
  if (!ctx) {
    throw new Error('usePatient must be used inside PatientProvider');
  }
  return ctx;
}
