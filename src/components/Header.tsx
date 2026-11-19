import { useState } from 'react';
import { LogIn, LogOut, Menu, X } from 'lucide-react';
import type { AppSection } from '../types/clinical';
import { usePatient } from '../contexts/PatientContext';

interface HeaderProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
}

const NAV_ITEMS: { id: AppSection; label: string; activeClass: string; barClass: string }[] = [
  { id: 'dosage', label: 'Dosage Guide', activeClass: 'text-teal-300', barClass: 'after:bg-teal-400' },
  { id: 'ml-calculator', label: 'mL Calculator', activeClass: 'text-violet-300', barClass: 'after:bg-violet-400' },
  { id: 'vitals', label: 'BP & Sugar', activeClass: 'text-emerald-300', barClass: 'after:bg-emerald-400' },
  { id: 'interactions', label: 'Interactions', activeClass: 'text-rose-300', barClass: 'after:bg-rose-400' },
  { id: 'records', label: 'Health Records', activeClass: 'text-sky-300', barClass: 'after:bg-sky-400' },
  { id: 'safety', label: 'Safety Protocol', activeClass: 'text-amber-300', barClass: 'after:bg-amber-400' },
];

export function Header({ activeSection, onSelectSection }: HeaderProps) {
  const { user, authBusy, signInWithGoogle, signOut } = usePatient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/90">
      <div
        aria-hidden="true"
        className="h-1 w-full bg-gradient-to-r from-teal-400 via-sky-400 via-violet-500 to-rose-500"
      />
      {/* Unified Cool-Font Masthead: Know Your Consumption(KYC) designed by Manoj */}
      <div className="border-b border-slate-800/75 bg-slate-950/95">
        <div className="max-w-[1280px] mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-center">
          <a
            href="#dosage"
            onClick={(e) => {
              e.preventDefault();
              onSelectSection('dosage');
              setMobileMenuOpen(false);
            }}
            className="inline-flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-0.5 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded-md px-1"
          >
            <span className="[font-family:var(--font-brand)] text-base sm:text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-teal-300 via-cyan-300 to-violet-400 bg-clip-text text-transparent">
              Know Your Consumption(KYC)
            </span>
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] text-fuchsia-300/90">
                designed by
              </span>
              <span className="[font-family:var(--font-signature)] text-lg sm:text-2xl leading-none bg-gradient-to-r from-amber-300 via-rose-400 to-fuchsia-400 bg-clip-text text-transparent pr-0.5">
                Manoj
              </span>
            </span>
          </a>
        </div>
      </div>

      <div className="max-w-[1280px] mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-6">
        {/* Left spacer on desktop to keep primary nav balanced, compact label on mobile */}
        <div className="flex lg:hidden items-center text-xs font-bold text-teal-300 tracking-wide">
          {NAV_ITEMS.find((i) => i.id === activeSection)?.label || 'Dosage Guide'}
        </div>
        <div className="hidden lg:block w-[120px] shrink-0" aria-hidden="true" />

        {/* Zone 2: 5 Clean Single-Line Nav Links */}
        <nav aria-label="Primary navigation" className="hidden lg:flex items-center gap-7 shrink-0">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative py-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded ${
                  isActive
                    ? `${item.activeClass} after:content-[""] after:absolute after:left-0 after:right-0 after:-bottom-[17px] after:h-[3px] after:rounded-full ${item.barClass}`
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Auth Control + Mobile Toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={authBusy}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-indigo-100 bg-indigo-950/80 hover:bg-indigo-900/90 border border-indigo-500/40 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-60"
              aria-label={`Sign out ${user.displayName || user.email || 'patient account'}`}
            >
              <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-300" aria-hidden="true" />
              <span className="max-w-[90px] sm:max-w-[130px] truncate">
                {user.displayName?.split(' ')[0] || 'Sign Out'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={authBusy}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-lg shadow-xs transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-60"
            >
              <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden="true" />
              <span>
                {authBusy ? (
                  'Signing In...'
                ) : (
                  <>
                    <span className="hidden sm:inline">Patient </span>Login
                  </>
                )}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 shrink-0"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          aria-label="Mobile navigation"
          className="lg:hidden border-t border-slate-800 bg-slate-950 px-4 py-3 flex flex-col gap-1"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  setMobileMenuOpen(false);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full text-left px-3.5 py-3 rounded-lg text-sm font-semibold transition-colors ${
                  isActive ? 'bg-slate-800 text-teal-300' : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
