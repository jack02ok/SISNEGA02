import React, { useState, useEffect } from 'react';
import { UserProfile, Role } from '../types';
import { NotificationComponent } from './NotificationComponent';
import { LogIn, LogOut, School, ShieldCheck, UserCheck, ChevronDown, Sun, Moon, QrCode } from 'lucide-react';

interface HeaderProps {
  user: UserProfile | null;
  onLogin: () => void;
  onLogout: () => void;
  onSwitchRole: (newRole: Role) => void;
  activeRole: Role;
  schoolName: string;
  schoolLogoUrl?: string;
  onSelectTab?: (tab: string) => void;
  onOpenPublicPortal?: () => void;
}

const ROLE_LABELS: Record<Role, { label: string; bg: string; text: string }> = {
  ADMIN: { label: 'Admin (Operator / TU)', bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-300' },
  KEPSEK: { label: 'Kepala Sekolah', bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-800 dark:text-amber-300' },
  GURU_KELAS: { label: 'Guru Kelas (Wali Kelas)', bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300' },
  GURU_MAPEL: { label: 'Guru Mapel (PJOK/Agama)', bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-300' },
  PUSTAKAWAN: { label: 'Pustakawan', bg: 'bg-teal-100 dark:bg-teal-900/50', text: 'text-teal-700 dark:text-teal-300' },
  UKS: { label: 'Petugas UKS', bg: 'bg-rose-100 dark:bg-rose-900/50', text: 'text-rose-700 dark:text-rose-300' },
};

export const Header: React.FC<HeaderProps> = ({
  user,
  onLogin,
  onLogout,
  onSwitchRole,
  activeRole,
  schoolName,
  schoolLogoUrl,
  onSelectTab,
  onOpenPublicPortal,
}) => {
  const [logoError, setLogoError] = useState(false);

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('sisfo_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('sisfo_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <header className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs dark:shadow-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Left: Brand / School Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab && onSelectTab('admin-users')}>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs overflow-hidden p-1">
            {schoolLogoUrl && !logoError ? (
              <img
                src={schoolLogoUrl}
                alt={schoolName}
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center">
                <School className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
          <div>
            <h1 className="font-bold text-base tracking-wide text-slate-800 dark:text-slate-100">{schoolName}</h1>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Sistem Informasi Sekolah Terpadu (SISFO SD)</p>
          </div>
        </div>

        {/* Right: Auth, Real-time Notification, Public Portal & Theme Toggle */}
        <div className="flex items-center gap-2.5">

          {/* Public Portal QR Access Button */}
          {onOpenPublicPortal && (
            <button
              onClick={onOpenPublicPortal}
              title="Buka Portal Publik Siswa & Kartu Digital QR"
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30"
            >
              <QrCode className="w-4 h-4 text-amber-300" />
              <span className="hidden sm:inline">Portal Siswa (QR)</span>
            </button>
          )}

          {/* Real-time Notification Component */}
          <NotificationComponent activeRole={activeRole} onSelectTab={onSelectTab} />

          {/* Global Light / Dark Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Beralih ke Mode Terang (Light Mode)' : 'Beralih ke Mode Gelap (Dark Mode)'}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5 shadow-xs font-semibold text-xs"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden md:inline text-amber-300">Mode Terang</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                <span className="hidden md:inline text-slate-600 dark:text-slate-300">Mode Gelap</span>
              </>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              
              {/* Role Switcher Selector Dropdown */}
              <div className="relative group">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-750 transition-colors">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-slate-600 dark:text-slate-300">Role:</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold ${ROLE_LABELS[activeRole]?.bg || 'bg-slate-200 dark:bg-slate-700'} ${ROLE_LABELS[activeRole]?.text || 'text-slate-800 dark:text-slate-200'}`}>
                    {ROLE_LABELS[activeRole]?.label || activeRole}
                  </span>
                  {user.roles.length > 1 && (
                    <span className="ml-1 text-xs text-amber-600 dark:text-amber-400 font-medium bg-amber-400/10 px-1.5 py-0.5 rounded-sm">
                      {user.roles.length} Role
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </div>

                {/* Dropdown Menu for Switching Roles */}
                <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-2 hidden group-hover:block group-focus-within:block z-50">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
                    Pilih Peran Akses (Multi-Role)
                  </div>
                  {user.roles.map((r) => (
                    <button
                      key={r}
                      onClick={() => onSwitchRole(r)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${
                        r === activeRole ? 'bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-300 font-semibold' : 'text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      <span>{ROLE_LABELS[r]?.label || r}</span>
                      {r === activeRole && <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* User Avatar & Logout */}
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
                <img
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full border border-slate-300 dark:border-slate-600 object-cover"
                />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-none">{user.displayName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-none">{user.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  title="Keluar / Logout"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

            </div>
          ) : (
            <button
              onClick={onLogin}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Masuk dengan Google
            </button>
          )}
        </div>

      </div>
    </header>
  );
};
