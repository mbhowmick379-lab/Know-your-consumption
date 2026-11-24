import { useState } from 'react';
import {
  Activity,
  Beaker,
  FolderHeart,
  Home,
  LogIn,
  LogOut,
  Menu,
  Pill,
  ShieldCheck,
  Waypoints,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AppSection } from '../types/clinical';
import { usePatient } from '../contexts/PatientContext';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  activeSection: AppSection;
  onSelectSection: (section: AppSection) => void;
}

export const NAV_ITEMS: { id: AppSection; label: string; icon: LucideIcon }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'dosage', label: 'Dosage Check', icon: Pill },
  { id: 'ml-calculator', label: 'mL Calculator', icon: Beaker },
  { id: 'vitals', label: 'BP & Sugar', icon: Activity },
  { id: 'interactions', label: 'Interactions', icon: Waypoints },
  { id: 'records', label: 'My Records', icon: FolderHeart },
  { id: 'safety', label: 'How It Works', icon: ShieldCheck },
];

export function Header({ activeSection, onSelectSection }: HeaderProps) {
  const { user, authBusy, signInWithGoogle, signOut } = usePatient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const select = (id: AppSection) => {
    onSelectSection(id);
    setMobileMenuOpen(false);
  };

  return (
    <header className="no-print sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200/80">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            select('home');
          }}
          className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          aria-label="DoseSafe home"
        >
          <BrandLogo />
        </a>

        <nav aria-label="Primary navigation" className="hidden xl:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`px-3 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              disabled={authBusy}
              className="inline-flex items-center gap-2 h-10 px-3.5 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-60"
              aria-label={`Sign out ${user.displayName || user.email || 'patient account'}`}
            >
              <LogOut className="w-4 h-4 text-slate-500" aria-hidden="true" />
              <span className="max-w-[90px] sm:max-w-[130px] truncate">
                {user.displayName?.split(' ')[0] || 'Sign Out'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              disabled={authBusy}
              className="inline-flex items-center gap-2 h-10 px-4 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-sm shadow-teal-600/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>{authBusy ? 'Signing in...' : 'Sign in'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            className="xl:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="xl:hidden border-t border-slate-200 bg-white px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 shadow-lg shadow-slate-900/5"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => select(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 text-left px-3.5 py-3 rounded-xl text-[15px] font-semibold transition-colors ${
                  isActive ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </nav>
      )}
    </header>
  );
}
