import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Beaker,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  FolderHeart,
  Pill,
  ScanLine,
  ShieldAlert,
  Stethoscope,
  UserRound,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { AppSection } from '../types/clinical';

const HERO_IMAGE_PATH = '/src/assets/images/dosesafe_hero.png';

interface HomePageProps {
  onNavigate: (section: AppSection) => void;
  onJumpToRabies: () => void;
}

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: UserRound,
    title: 'Tell us about the patient',
    text: 'Enter age and sex. Weight and allergies are optional but make the check more precise.',
  },
  {
    icon: ScanLine,
    title: 'Add the medicine',
    text: 'Type a brand or generic name, or scan the medicine strip or bottle label with your camera.',
  },
  {
    icon: ClipboardList,
    title: 'Read your safety report',
    text: 'See the suggested dose in mg and mL, allergy warnings and the sources used, then confirm with your doctor or pharmacist.',
  },
];

const FEATURES: {
  id: AppSection | 'rabies';
  icon: LucideIcon;
  title: string;
  text: string;
  tint: string;
}[] = [
  {
    id: 'dosage',
    icon: Pill,
    title: 'Dosage Check',
    text: 'Age, sex and weight-aware dose guidance with daily maximum limits and allergy screening.',
    tint: 'bg-teal-50 text-teal-700',
  },
  {
    id: 'ml-calculator',
    icon: Beaker,
    title: 'mL Syrup Calculator',
    text: 'Convert a dose in mg to the exact mL to measure from your syrup bottle.',
    tint: 'bg-sky-50 text-sky-700',
  },
  {
    id: 'interactions',
    icon: Waypoints,
    title: 'Drug Interactions',
    text: 'Check if two or more medicines are safe to take together before you combine them.',
    tint: 'bg-rose-50 text-rose-700',
  },
  {
    id: 'vitals',
    icon: Activity,
    title: 'BP & Sugar Check',
    text: 'Understand blood pressure and blood sugar readings with clear, colour-coded ranges.',
    tint: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'records',
    icon: FolderHeart,
    title: 'My Health Records',
    text: 'Sign in to save your profile, past checks and print a summary to share with your doctor.',
    tint: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'rabies',
    icon: CalendarCheck,
    title: 'Rabies Vaccine Dates',
    text: 'Plan every vaccine dose date after an animal bite, based on WHO and CDC schedules.',
    tint: 'bg-amber-50 text-amber-700',
  },
];

const SAFETY_FACTS = [
  'Many medicine mistakes happen at home, such as measuring the wrong amount of syrup.',
  'Children, older adults and pregnant women often need different doses.',
  'Some common medicines are unsafe when taken together or with certain allergies.',
];

export function HomePage({ onNavigate, onJumpToRabies }: HomePageProps) {
  const openFeature = (id: AppSection | 'rabies') => {
    if (id === 'rabies') onJumpToRabies();
    else onNavigate(id);
  };

  return (
    <div className="space-y-20 sm:space-y-28">
      <section className="relative grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center pt-2 sm:pt-6">
        <div className="space-y-6 animate-fade-up">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-xs font-semibold text-teal-700">
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            Medicine safety, made simple
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-[56px] font-extrabold leading-[1.08] tracking-tight text-slate-900 text-balance">
            Know the right dose{' '}
            <span className="bg-gradient-to-r from-teal-600 to-sky-600 bg-clip-text text-transparent">
              before you take it.
            </span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-xl text-pretty">
            DoseSafe checks medicine doses, syrup measurements, allergies and drug interactions in
            plain language, so you and your family can take medicines with more confidence.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => onNavigate('dosage')}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 text-base font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              Check a medicine
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('interactions')}
              className="inline-flex items-center justify-center gap-2 h-12 px-6 text-base font-semibold text-slate-800 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              Check interactions
            </button>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-1 text-sm text-slate-600">
            {['Free to use', 'No sign-in needed to check', 'Brand & generic names'].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative animate-fade-up [animation-delay:120ms]">
          <div
            aria-hidden="true"
            className="absolute -inset-4 sm:-inset-8 rounded-[2.5rem] bg-gradient-to-br from-teal-100/70 via-sky-50 to-emerald-50 blur-2xl"
          />
          <div className="relative rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 overflow-hidden">
            <img
              src={HERO_IMAGE_PATH}
              alt="Illustration of a phone showing a verified medicine dose next to pills and a syrup bottle"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
          <div className="absolute -bottom-5 left-4 sm:left-6 flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-slate-200 shadow-lg shadow-slate-900/5">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-emerald-50">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-bold text-slate-900">Paracetamol 250 mg</span>
              <span className="block text-xs text-slate-500">Example: within daily limit</span>
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="how-heading" className="space-y-10">
        <div className="max-w-2xl space-y-3">
          <p className="text-sm font-semibold text-teal-700">How DoseSafe works</p>
          <h2 id="how-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
            Three simple steps to a safer dose
          </h2>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm"
              >
                <div className="flex items-center justify-between mb-5">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-teal-50 text-teal-700">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-300">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-[15px] text-slate-600 leading-relaxed">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="features-heading" className="space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold text-teal-700">Features</p>
            <h2 id="features-heading" className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
              Everything you need to take medicines safely
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => openFeature(f.id)}
                className="group text-left p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 hover:border-teal-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <span className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${f.tint}`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-[15px] text-slate-600 leading-relaxed">{f.text}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                  Open
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="trust-heading"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8"
      >
        <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-teal-600 to-sky-700 text-white space-y-5">
          <h2 id="trust-heading" className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
            Why medicine safety matters
          </h2>
          <ul className="space-y-4">
            {SAFETY_FACTS.map((fact) => (
              <li key={fact} className="flex gap-3 text-[15px] leading-relaxed text-teal-50">
                <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0 text-emerald-200" aria-hidden="true" />
                {fact}
              </li>
            ))}
          </ul>
          <p className="text-sm text-teal-100/90 leading-relaxed">
            A quick check before each dose helps you ask your doctor or pharmacist the right questions.
          </p>
        </div>

        <div className="p-6 sm:p-10 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Automated checks are not a prescription
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4 p-4 rounded-2xl bg-sky-50 border border-sky-100">
              <span className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-white text-sky-700 border border-sky-100">
                <Bot className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold text-slate-900">Automated by DoseSafe</p>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Dose estimates, allergy flags and interaction checks generated by software using
                  public drug label data. Results can be incomplete or wrong.
                </p>
              </div>
            </div>
            <div className="flex gap-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
              <span className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-white text-emerald-700 border border-emerald-100">
                <Stethoscope className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-bold text-slate-900">Approved by your doctor or pharmacist</p>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">
                  Only a licensed doctor or pharmacist can approve your treatment. DoseSafe does not
                  replace their advice.
                </p>
              </div>
            </div>
          </div>
          <p className="flex gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            In an emergency, such as trouble breathing or a severe allergic reaction, call emergency
            services right away.
          </p>
        </div>
      </section>

      <section className="text-center p-8 sm:p-14 rounded-3xl bg-white border border-slate-200/80 shadow-sm space-y-5">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 text-balance">
          Ready to check your medicine?
        </h2>
        <p className="text-slate-600 max-w-lg mx-auto">
          It takes less than a minute. No account needed to run a check.
        </p>
        <button
          type="button"
          onClick={() => onNavigate('dosage')}
          className="inline-flex items-center justify-center gap-2 h-12 px-7 text-base font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-md shadow-teal-600/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          Start a dosage check
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
