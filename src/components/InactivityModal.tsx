import React from 'react';
import { ShieldAlert, Clock, RefreshCw } from 'lucide-react';

interface InactivityModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onExtendSession: () => void;
  onLogoutNow: () => void;
}

export const InactivityModal: React.FC<InactivityModalProps> = ({
  isOpen,
  remainingSeconds,
  onExtendSession,
  onLogoutNow
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-6 border border-amber-500/30 shadow-2xl space-y-5 text-slate-800 dark:text-slate-100">
        
        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Peringatan Inaktivitas Sesi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pengamanan Otomatis Akun Sekolah
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-900/40 text-center space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
            Sesi Anda tidak aktif. Akun Anda akan otomatis keluar dalam:
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl font-mono text-2xl font-black shadow-md shadow-amber-500/20">
            <Clock className="w-6 h-6 animate-pulse" />
            <span>{formattedTime}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
            Fitur ini mencegah akses tak berwenang saat perangkat ditinggalkan di lingkungan sekolah.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onLogoutNow}
            className="flex-1 py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs transition-all border border-slate-200 dark:border-slate-700"
          >
            Keluar Sekarang
          </button>
          <button
            onClick={onExtendSession}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Lanjutkan Sesi
          </button>
        </div>

      </div>
    </div>
  );
};
