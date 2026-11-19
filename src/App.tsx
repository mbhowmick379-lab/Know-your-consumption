import { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { DosageCalculator } from './components/DosageCalculator';
import { MlDoseCalculator } from './components/MlDoseCalculator';
import { VitalsCalculator } from './components/VitalsCalculator';
import { InteractionChecker } from './components/InteractionChecker';
import { HealthRecords } from './components/HealthRecords';
import { SafetyProtocol } from './components/SafetyProtocol';
import { RabiesScheduleSection } from './components/RabiesScheduleSection';
import { PrintableSummary, type PrintPayload } from './components/PrintableSummary';
import { PatientProvider, usePatient } from './contexts/PatientContext';
import type { AppSection, DosageAnalysisResult } from './types/clinical';

function KycPortalShell() {
  const { profile, dosageRecords, interactionRecords } = usePatient();
  const [activeSection, setActiveSection] = useState<AppSection>('dosage');
  const [prefillInteractions, setPrefillInteractions] = useState<string[] | undefined>(undefined);
  const [mlPrefill, setMlPrefill] = useState<{
    medicationName?: string;
    targetDoseMg?: number;
    strengthMg?: number;
    strengthPerMl?: number;
  } | null>(null);
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null);

  const triggerPrint = (payload: PrintPayload) => {
    setPrintPayload(payload);
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handlePrintDosage = (
    result: DosageAnalysisResult,
    meta: { sexDisplay: string; ageDisplay: string; weightDisplay: string; allergies: string[] }
  ) => {
    triggerPrint({
      mode: 'dosage',
      result,
      meta,
      patientName: profile.displayName || 'Patient',
    });
  };

  const handlePrintFullRecord = () => {
    triggerPrint({
      mode: 'full-record',
      profile,
      dosageRecords,
      interactionRecords,
    });
  };

  const handleNavigateInteractions = (drugs: string[]) => {
    setPrefillInteractions(drugs);
    setActiveSection('interactions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMlCalculator = (prefill?: {
    medicationName?: string;
    targetDoseMg?: number;
    strengthMg?: number;
    strengthPerMl?: number;
  }) => {
    setMlPrefill(prefill || null);
    setActiveSection('ml-calculator');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToRabiesSchedule = () => {
    const el = document.getElementById('rabies-schedule');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100 bg-transparent">
      <Header activeSection={activeSection} onSelectSection={setActiveSection} />

      <main className="no-print flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {activeSection === 'dosage' && (
          <DosageCalculator
            onPrintDosage={handlePrintDosage}
            onNavigateInteractions={handleNavigateInteractions}
            onOpenMlCalculator={handleOpenMlCalculator}
            onOpenVitals={() => {
              setActiveSection('vitals');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onJumpToRabies={scrollToRabiesSchedule}
          />
        )}
        {activeSection === 'ml-calculator' && <MlDoseCalculator prefill={mlPrefill} />}
        {activeSection === 'vitals' && <VitalsCalculator />}
        {activeSection === 'interactions' && (
          <InteractionChecker prefillDrugs={prefillInteractions} />
        )}
        {activeSection === 'records' && (
          <HealthRecords onPrintFullRecord={handlePrintFullRecord} />
        )}
        {activeSection === 'safety' && <SafetyProtocol />}
      </main>

      {/* Rabies Vaccination Schedule & Dates — Placed at the Bottom of the Website Interface */}
      <RabiesScheduleSection />

      <footer className="no-print border-t border-slate-800/90 bg-slate-950/90 mt-4">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
          <div className="space-y-1">
            <p className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="[font-family:var(--font-brand)] font-extrabold bg-gradient-to-r from-teal-300 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
                Know Your Consumption(KYC)
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-fuchsia-300/90">
                designed by
              </span>
              <span className="[font-family:var(--font-signature)] text-base leading-none bg-gradient-to-r from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent">
                Manoj
              </span>
            </p>
            <p>
              Live internet-verified patient dosing by age, sex, and optional weight, brand &amp;
              generic lookup, mL syrup measurement, drug interactions, and rabies vaccination dates.
              Always verify with a licensed physician or pharmacist.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 shrink-0 font-medium">
            <button
              type="button"
              onClick={() => {
                setActiveSection('dosage');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-teal-300 transition-colors"
            >
              Dosage Guide
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection('ml-calculator');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-violet-300 transition-colors"
            >
              mL Calculator
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection('vitals');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-emerald-300 transition-colors"
            >
              BP &amp; Sugar
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection('interactions');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-rose-300 transition-colors"
            >
              Interactions
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSection('records');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-sky-300 transition-colors"
            >
              Health Records
            </button>
            <button
              type="button"
              onClick={scrollToRabiesSchedule}
              className="hover:text-amber-300 transition-colors"
            >
              Rabies Schedule
            </button>
          </div>
        </div>
      </footer>

      <PrintableSummary payload={printPayload} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PatientProvider>
        <KycPortalShell />
      </PatientProvider>
    </ErrorBoundary>
  );
}
