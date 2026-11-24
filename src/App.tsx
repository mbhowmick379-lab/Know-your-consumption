import { useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { HomePage } from './components/HomePage';
import { BrandLogo } from './components/BrandLogo';
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

const FOOTER_TOOLS: { id: AppSection; label: string }[] = [
  { id: 'dosage', label: 'Dosage Check' },
  { id: 'ml-calculator', label: 'mL Calculator' },
  { id: 'vitals', label: 'BP & Sugar' },
  { id: 'interactions', label: 'Drug Interactions' },
];

const FOOTER_ACCOUNT: { id: AppSection; label: string }[] = [
  { id: 'records', label: 'My Health Records' },
  { id: 'safety', label: 'How It Works' },
  { id: 'home', label: 'Home' },
];

function KycPortalShell() {
  const { profile, dosageRecords, interactionRecords } = usePatient();
  const [activeSection, setActiveSection] = useState<AppSection>('home');
  const [prefillInteractions, setPrefillInteractions] = useState<string[] | undefined>(undefined);
  const [mlPrefill, setMlPrefill] = useState<{
    medicationName?: string;
    targetDoseMg?: number;
    strengthMg?: number;
    strengthPerMl?: number;
  } | null>(null);
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null);

  const navigate = (section: AppSection) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    navigate('interactions');
  };

  const handleOpenMlCalculator = (prefill?: {
    medicationName?: string;
    targetDoseMg?: number;
    strengthMg?: number;
    strengthPerMl?: number;
  }) => {
    setMlPrefill(prefill || null);
    navigate('ml-calculator');
  };

  const scrollToRabiesSchedule = () => {
    const el = document.getElementById('rabies-schedule');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-900 bg-transparent">
      <Header activeSection={activeSection} onSelectSection={navigate} />

      <main
        key={activeSection}
        className="no-print flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-up"
      >
        {activeSection === 'home' && (
          <HomePage onNavigate={navigate} onJumpToRabies={scrollToRabiesSchedule} />
        )}
        {activeSection === 'dosage' && (
          <DosageCalculator
            onPrintDosage={handlePrintDosage}
            onNavigateInteractions={handleNavigateInteractions}
            onOpenMlCalculator={handleOpenMlCalculator}
            onOpenVitals={() => navigate('vitals')}
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

      <footer className="no-print border-t border-slate-200 bg-white mt-8">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-4">
            <BrandLogo />
            <p className="text-sm text-slate-600 leading-relaxed max-w-sm">
              Simple medicine safety checks for dosage, syrup measurement, allergies, drug
              interactions and rabies vaccine dates.
            </p>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
              DoseSafe provides automated educational information only. It is not medical advice
              and does not replace approval from a licensed doctor or pharmacist.
            </p>
          </div>

          <nav aria-label="Footer tools" className="lg:col-span-3 space-y-3">
            <p className="text-sm font-bold text-slate-900">Tools</p>
            <ul className="space-y-2.5">
              {FOOTER_TOOLS.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(item.id)}
                    className="text-sm text-slate-600 hover:text-teal-700 transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={scrollToRabiesSchedule}
                  className="text-sm text-slate-600 hover:text-teal-700 transition-colors"
                >
                  Rabies Vaccine Dates
                </button>
              </li>
            </ul>
          </nav>

          <nav aria-label="Footer account" className="lg:col-span-2 space-y-3">
            <p className="text-sm font-bold text-slate-900">DoseSafe</p>
            <ul className="space-y-2.5">
              {FOOTER_ACCOUNT.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(item.id)}
                    className="text-sm text-slate-600 hover:text-teal-700 transition-colors"
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-2 space-y-3">
            <p className="text-sm font-bold text-slate-900">Emergency</p>
            <p className="text-sm text-slate-600 leading-relaxed">
              For a severe reaction or overdose, call your local emergency number immediately.
            </p>
          </div>
        </div>
        <div className="border-t border-slate-100">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row gap-2 justify-between text-xs text-slate-500">
            <p>DoseSafe · Know Your Consumption (KYC)</p>
            <p>Designed by Manoj</p>
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
