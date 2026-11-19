import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const SAFETY_IMAGE_PATH = '/src/assets/images/patient_safety_care_1795065406105.jpg';

const VERIFICATION_STEPS = [
  {
    number: '01',
    title: 'Live Internet Clinical Cross-Verification (FDA, NIH & Web)',
    description:
      'During every dosage or drug interaction lookup, Know Your Consumption(KYC) connects live over the internet to the U.S. FDA OpenFDA Official Drug Label database, the NIH National Library of Medicine RxNorm registry, and real-time Google Search clinical grounding so results reflect up-to-date prescribing guidelines with clickable citations.',
  },
  {
    number: '02',
    title: 'Brand & Generic Drug Identity Resolution',
    description:
      'Whether a patient types a commercial brand name (such as Augmentin, Calpol, Dolo 650, Azithral, Zithromax, Advil, Disprin, or Lipitor) or a generic active ingredient, Know Your Consumption(KYC) automatically resolves it to the exact generic pharmacology before running safety rules.',
  },
  {
    number: '03',
    title: 'Sex-Specific (Male/Female) & Age-Band Clinical Protections',
    description:
      'Every lookup evaluates patient sex (Male or Female) alongside age in years or months — flagging sex-specific FDA dose ceilings (such as lower female dosing for zolpidem), reproductive-age teratogen precautions, hormonal contraceptive interactions, Reye syndrome risks (aspirin under 18), infant NSAID restrictions, and Beers Criteria considerations for older adults (65+).',
  },
  {
    number: '04',
    title: 'Optional Weight Precision, Daily Ceilings & Exact mL Volume',
    description:
      'Weight is always optional so adults can verify standard dosing quickly. When weight is entered (in kg or lbs), Know Your Consumption(KYC) verifies unit plausibility against age and computes weight-based mg/kg/day guidance capped strictly at the maximum safe daily ceiling — plus exact mL liquid volumes from mg per 5 mL or 10 mL bottles.',
  },
  {
    number: '05',
    title: 'Direct & Cross-Reactivity Allergy Screening & Private Records',
    description:
      'Documented patient allergies are screened immediately against exact drug names, resolved brand names, and chemical families (Penicillin/Beta-Lactam, Sulfa, NSAIDs, Macrolides, Fluoroquinolones). Signed-in patient profiles and health records are isolated under owner-only database rules, with SHA-256 portable JSON downloads and local WHO/CDC rabies vaccination date planning.',
  },
];

export function SafetyProtocol() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pb-8 border-b border-slate-800">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
          <p className="text-xs font-semibold text-amber-400">
            Know Your Consumption(KYC) · Live Clinical Standards &amp; Privacy
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-50 text-balance">
            How our live internet &amp; automated safety verification protects every lookup
          </h1>
          <p className="text-[15px] text-slate-300 leading-relaxed max-w-2xl">
            Know Your Consumption(KYC) layers deterministic sex, age, weight, and allergy safety
            rules on top of live U.S. FDA OpenFDA drug labels, NIH RxNorm records, and web-grounded
            medical AI aligned with FDA prescribing guidelines, AAP, IDSA, WHO, and BNF standards.
          </p>
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-medium text-teal-300">
            <span>Live U.S. FDA Labels</span>
            <span>NIH RxNorm API</span>
            <span>AAP &amp; IDSA Guidelines</span>
            <span>WHO &amp; BNF Standards</span>
          </div>
        </div>

        <div className="lg:col-span-5">
          {!imgFailed ? (
            <div className="h-full min-h-[240px] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <img
                src={SAFETY_IMAGE_PATH}
                alt="Frosted pharmacy vials and stainless steel measuring spoon on stone"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover opacity-90"
              />
            </div>
          ) : (
            <div className="h-full min-h-[240px] rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-teal-400/70" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <section aria-label="Five-stage automated verification protocol" className="space-y-4">
        <h2 className="text-xl font-bold text-slate-50">Five-Stage Live Automated Verification</h2>
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-900/90 overflow-hidden">
          {VERIFICATION_STEPS.map((step) => (
            <div
              key={step.number}
              className="p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start"
            >
              <div className="md:col-span-4 flex items-baseline gap-3">
                <span className="font-mono text-sm font-bold text-teal-400 tabular-nums">
                  {step.number}.
                </span>
                <h3 className="text-sm font-bold text-slate-100">{step.title}</h3>
              </div>
              <p className="md:col-span-8 text-sm text-slate-300 leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section
        aria-label="Important patient medical notice"
        className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-6 space-y-2"
      >
        <h2 className="text-sm font-bold text-amber-200">Important Medical Notice for Patients</h2>
        <p className="text-sm text-amber-100/90 leading-relaxed">
          Know Your Consumption(KYC) is an educational safety and continuity-of-care companion for
          patients. Individual doses can vary based on kidney function, liver health, pregnancy,
          infection severity, and lab cultures. Never start, stop, or alter a prescribed antibiotic
          or medication without confirming with your physician or licensed pharmacist. In a medical
          emergency (such as trouble breathing, throat swelling, or severe allergic reaction), call
          emergency services immediately.
        </p>
      </section>
    </div>
  );
}
