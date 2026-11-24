import { useState } from 'react';
import { AlertTriangle, Bot, ShieldCheck, Stethoscope } from 'lucide-react';

const SAFETY_IMAGE_PATH = '/src/assets/images/patient_safety_care_1795065406105.jpg';

const VERIFICATION_STEPS = [
  {
    number: '01',
    title: 'Live checks against public drug data (FDA, NIH & web)',
    description:
      'During every dosage or drug interaction lookup, DoseSafe connects live to the U.S. FDA OpenFDA drug label database, the NIH National Library of Medicine RxNorm registry, and real-time Google Search grounding, and shows clickable citations for the sources it used.',
  },
  {
    number: '02',
    title: 'Brand and generic name recognition',
    description:
      'Whether you type a brand name (such as Augmentin, Calpol, Dolo 650, Azithral, Zithromax, Advil, Disprin or Lipitor) or a generic ingredient, DoseSafe resolves it to the generic medicine before running safety rules.',
  },
  {
    number: '03',
    title: 'Age and sex-specific protections',
    description:
      'Every lookup considers sex and age in years or months, flagging sex-specific FDA dose limits (such as lower female dosing for zolpidem), pregnancy precautions, contraceptive interactions, Reye syndrome risk (aspirin under 18), infant NSAID restrictions and Beers Criteria considerations for adults 65+.',
  },
  {
    number: '04',
    title: 'Optional weight, daily limits and exact mL volume',
    description:
      'Weight is optional so adults can check standard dosing quickly. When entered (kg or lbs), DoseSafe checks it makes sense for the age, calculates mg/kg/day guidance capped at the maximum daily limit, and converts to exact mL from your bottle strength.',
  },
  {
    number: '05',
    title: 'Allergy screening and private records',
    description:
      'Your allergies are checked against the medicine name, brand name and related medicine families (Penicillin/Beta-Lactam, Sulfa, NSAIDs, Macrolides, Fluoroquinolones). Signed-in records are restricted to the account owner, with SHA-256 checksummed JSON downloads and rabies vaccine date planning.',
  },
];

export function SafetyProtocol() {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-4">
          <p className="text-sm font-semibold text-teal-700">How DoseSafe works</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
            How our automated safety checks work
          </h1>
          <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
            DoseSafe combines fixed safety rules for age, sex, weight and allergies with live public
            drug label data and AI summaries that reference FDA prescribing information and guidance
            from organisations such as the AAP, IDSA, WHO and BNF.
          </p>
          <div className="pt-1 flex flex-wrap gap-2">
            {['FDA drug labels', 'NIH RxNorm', 'AAP & IDSA guidance', 'WHO & BNF references'].map((t) => (
              <span
                key={t}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5">
          {!imgFailed ? (
            <div className="h-full min-h-[240px] rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
              <img
                src={SAFETY_IMAGE_PATH}
                alt="Pharmacy vials and a stainless steel measuring spoon"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="h-full min-h-[240px] rounded-2xl border border-slate-200 bg-teal-50 flex items-center justify-center">
              <ShieldCheck className="w-12 h-12 text-teal-600" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      <section aria-labelledby="who-decides" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <h2 id="who-decides" className="sr-only">Automated results versus professional approval</h2>
        <div className="flex gap-4 p-5 rounded-2xl bg-white border border-sky-100 shadow-sm">
          <span className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-sky-50 text-sky-700">
            <Bot className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-sky-700">Automated result</p>
            <p className="mt-1 font-bold text-slate-900">What DoseSafe does</p>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Software-generated dose estimates, allergy flags and interaction warnings. Useful for
              awareness, but they can be incomplete or wrong.
            </p>
          </div>
        </div>
        <div className="flex gap-4 p-5 rounded-2xl bg-white border border-emerald-100 shadow-sm">
          <span className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-xl bg-emerald-50 text-emerald-700">
            <Stethoscope className="w-5 h-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Professional approval</p>
            <p className="mt-1 font-bold text-slate-900">What your doctor or pharmacist does</p>
            <p className="mt-1 text-sm text-slate-600 leading-relaxed">
              Reviews your full health history and approves the actual prescription and dose. Always
              follow their advice over any automated result.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="space-y-4">
        <h2 id="steps-heading" className="text-xl font-bold text-slate-900">
          The five automated checks
        </h2>
        <ol className="grid grid-cols-1 gap-3">
          {VERIFICATION_STEPS.map((step) => (
            <li
              key={step.number}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-6 items-start"
            >
              <div className="md:col-span-4 flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg bg-teal-50 font-mono text-sm font-bold text-teal-700 tabular-nums">
                  {step.number}
                </span>
                <h3 className="pt-1.5 text-[15px] font-bold text-slate-900">{step.title}</h3>
              </div>
              <p className="md:col-span-8 text-sm text-slate-600 leading-relaxed">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="notice-heading"
        className="flex gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-5 sm:p-6"
      >
        <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
        <div className="space-y-2">
          <h2 id="notice-heading" className="text-sm font-bold text-amber-900">
            Important medical notice
          </h2>
          <p className="text-sm text-amber-900/90 leading-relaxed">
            DoseSafe is an educational safety companion. Doses can vary with kidney function, liver
            health, pregnancy, infection severity and lab results. Never start, stop or change a
            prescribed medicine without confirming with your doctor or licensed pharmacist. In a
            medical emergency (such as trouble breathing, throat swelling or a severe allergic
            reaction), call emergency services immediately.
          </p>
        </div>
      </section>
    </div>
  );
}
