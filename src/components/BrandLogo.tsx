import { ShieldPlus } from 'lucide-react';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-sky-600 text-white shadow-sm shadow-teal-600/30">
        <ShieldPlus className="w-5 h-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none text-left">
        <span className="text-lg font-extrabold tracking-tight text-slate-900">
          Dose<span className="text-teal-600">Safe</span>
        </span>
        {!compact && (
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Know Your Consumption
          </span>
        )}
      </span>
    </span>
  );
}
