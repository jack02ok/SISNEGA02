import React, { useState, useEffect, useCallback } from 'react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, db } from './lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { UserProfile, Role, AppSettings } from './types';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { FloatingScanFAB } from './components/FloatingScanFAB';
import { AdminViews } from './components/views/AdminViews';
import { KepsekViews } from './components/views/KepsekViews';
import { GuruKelasViews } from './components/views/GuruKelasViews';
import { GuruMapelViews } from './components/views/GuruMapelViews';
import { PustakawanViews } from './components/views/PustakawanViews';
import { UKSViews } from './components/views/UKSViews';
import { PublicStudentPortal } from './components/views/PublicStudentPortal';
import { StudentCardModal } from './components/StudentCardModal';
import { KalenderAkademikModal } from './components/KalenderAkademikModal';
import { seedDatabaseIfEmpty } from './services/seedData';
import { logAuditEvent } from './services/auditService';
import { useInactivityLogout } from './hooks/useInactivityLogout';
import { InactivityModal } from './components/InactivityModal';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, School, ShieldAlert, QrCode } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<Role>('ADMIN');
  const [activeTab, setActiveTab] = useState<string>('admin-users');
  const [showPublicPortal, setShowPublicPortal] = useState<boolean>(false);
  const [isKalenderOpen, setIsKalenderOpen] = useState<boolean>(false);
  const [isStudentCardOpen, setIsStudentCardOpen] = useState<boolean>(false);
  const [selectedSiswaIdForCard, setSelectedSiswaIdForCard] = useState<string | undefined>(undefined);
  const [settings, setSettings] = useState<AppSettings>({
    fonnteToken: 'mBya#Xq@4Y!p9zK12345',
    schoolName: 'SD Negeri Neglasari 02',
    schoolAddress: 'Jl. Raya Neglasari No. 02, Kec. Neglasari',
    schoolNPSN: '20109876',
    kepsekNama: 'Drs. H. Ahmad Wijaya, M.Pd.',
    kepsekNip: '196805121992031004',
    dendaPerHari: 1000,
    schoolLogoUrl: 'https://raw.githubusercontent.com/jack02ok/osnsd/refs/heads/main/logosd.png',
    schoolBgUrl: '/sd_neglasari_02.svg'
  });

  // Default initial tabs when role switches
  const DEFAULT_TABS: Record<Role, string> = {
    ADMIN: 'admin-users',
    KEPSEK: 'kepsek-dashboard',
    GURU_KELAS: 'guru-scan',
    GURU_MAPEL: 'mapel-jurnal',
    PUSTAKAWAN: 'pustakawan-katalog',
    UKS: 'uks-screening',
  };

  // On App Mount: seed database & subscribe config
  useEffect(() => {
    seedDatabaseIfEmpty();

    // Subscribe global school settings
    const unsubConfig = onSnapshot(
      doc(db, 'settings', 'config'),
      (snap) => {
        if (snap.exists()) {
          setSettings(snap.data() as AppSettings);
        }
      },
      (err) => console.warn('Firestore settings listener error:', err)
    );

    // Subscribe Auth & User Document for real-time profile & theme sync
    let unsubUserDoc: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        unsubUserDoc = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const userProfile = userSnap.data() as UserProfile;
            setCurrentUser(userProfile);
            setActiveRole(prev => prev || userProfile.activeRole || 'ADMIN');

            // Apply theme preference from Firestore if present
            if (userProfile.themePreference) {
              if (userProfile.themePreference === 'dark') {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              localStorage.setItem('sisfo_theme', userProfile.themePreference);
            }
          } else {
            // New user default profile creation
            const initialTheme = (localStorage.getItem('sisfo_theme') as 'light' | 'dark') || 'light';
            const userProfile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || 'user@sd.sch.id',
              displayName: fbUser.displayName || 'Guru / Staf SD',
              photoURL: fbUser.photoURL || '',
              roles: ['ADMIN', 'KEPSEK', 'GURU_KELAS', 'GURU_MAPEL', 'PUSTAKAWAN', 'UKS'],
              activeRole: 'ADMIN',
              rombelBinaan: 'Kelas 1A',
              mapelBinaan: ['PJOK', 'Pendidikan Agama Islam'],
              themePreference: initialTheme
            };
            await setDoc(userRef, userProfile);
          }
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubConfig();
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  // Handle Google Login
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Google Auth error:", err);
      alert("Gagal Login Google: " + (err.message || 'Error autentikasi'));
    }
  };

  // Handle Logout
  const handleLogout = useCallback(async () => {
    await signOut(auth);
    setCurrentUser(null);
  }, []);

  // 30-Minute Inactivity Auto-Logout Hook
  const { remainingSeconds, showWarningModal, extendSession } = useInactivityLogout({
    timeoutMs: 30 * 60 * 1000, // 30 Minutes Security Timeout
    enabled: !!currentUser,
    onLogout: handleLogout
  });

  // Switch Role
  const handleSwitchRole = async (newRole: Role) => {
    if (!currentUser) return;
    setActiveRole(newRole);
    setActiveTab(DEFAULT_TABS[newRole]);

    // Save activeRole preference in Firestore user document
    const updatedUser = { ...currentUser, activeRole: newRole };
    setCurrentUser(updatedUser);
    await setDoc(doc(db, 'users', currentUser.uid), { activeRole: newRole }, { merge: true });
  };

  // Update Settings
  const handleUpdateSettings = async (newConfig: AppSettings) => {
    setSettings(newConfig);
    await setDoc(doc(db, 'settings', 'config'), newConfig);
    await logAuditEvent(
      currentUser?.displayName || 'Administrator / Operator TU',
      activeRole || 'ADMIN',
      'CONFIG_UPDATE',
      `Memperbarui konfigurasi identitas & pengaturan sekolah: ${newConfig.schoolName}`,
      {
        schoolName: newConfig.schoolName,
        kepsekNama: newConfig.kepsekNama,
        dendaPerHari: newConfig.dendaPerHari
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col text-slate-800 dark:text-slate-100 font-sans antialiased transition-colors duration-200">
      
      {/* Top Header */}
      <Header
        user={currentUser}
        onLogin={handleGoogleLogin}
        onLogout={handleLogout}
        onSwitchRole={handleSwitchRole}
        activeRole={activeRole}
        schoolName={settings.schoolName}
        schoolLogoUrl={settings.schoolLogoUrl}
        onSelectTab={(tabId) => {
          setShowPublicPortal(false);
          setActiveTab(tabId);
        }}
        onOpenPublicPortal={() => setShowPublicPortal(true)}
        onOpenKalender={() => setIsKalenderOpen(true)}
        onOpenKartuSiswa={currentUser && activeRole === 'ADMIN' ? () => {
          setSelectedSiswaIdForCard(undefined);
          setIsStudentCardOpen(true);
        } : undefined}
      />

      {showPublicPortal ? (
        <PublicStudentPortal
          settings={settings}
          onBackToApp={() => setShowPublicPortal(false)}
        />
      ) : currentUser ? (
        <div className="flex-1 flex flex-col md:flex-row">
          {/* Left Navigation Sidebar */}
          <Sidebar
            activeRole={activeRole}
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId)}
          />

          {/* Main Work Area */}
          <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeRole}-${activeTab}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeRole === 'ADMIN' && (
                  <AdminViews
                    activeTab={activeTab}
                    settings={settings}
                    onUpdateSettings={handleUpdateSettings}
                    onOpenStudentCardModal={(siswaId) => {
                      setSelectedSiswaIdForCard(siswaId);
                      setIsStudentCardOpen(true);
                    }}
                    onOpenKalenderModal={() => setIsKalenderOpen(true)}
                  />
                )}

                {activeRole === 'KEPSEK' && (
                  <KepsekViews
                    activeTab={activeTab}
                    settings={settings}
                  />
                )}

                {activeRole === 'GURU_KELAS' && (
                  <GuruKelasViews
                    activeTab={activeTab}
                    user={currentUser}
                    settings={settings}
                  />
                )}

                {activeRole === 'GURU_MAPEL' && (
                  <GuruMapelViews
                    activeTab={activeTab}
                    user={currentUser}
                    settings={settings}
                  />
                )}

                {activeRole === 'PUSTAKAWAN' && (
                  <PustakawanViews
                    activeTab={activeTab}
                    settings={settings}
                  />
                )}

                {activeRole === 'UKS' && (
                  <UKSViews
                    activeTab={activeTab}
                    settings={settings}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Global Floating Action Button for Quick Barcode Scanning */}
            <FloatingScanFAB activeRole={activeRole} actorName={currentUser.displayName} />
          </main>
        </div>
      ) : (
        /* Login Hero Section for unauthenticated user with Clean White Background */
        <div className="relative flex-1 flex items-center justify-center p-6 bg-white text-slate-800 min-h-[calc(100vh-64px)]">
          {/* Subtle decorative background pattern / light gradient */}
          <div className="absolute inset-0 z-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-70" />
          <div className="absolute inset-0 z-0 bg-gradient-to-b from-slate-50/50 via-white to-blue-50/30" />

          {/* Login Card Container */}
          <div className="relative z-10 max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200/80 shadow-2xl shadow-slate-200/50 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto shadow-md p-2 border border-emerald-100">
              {settings.schoolLogoUrl ? (
                <img
                  src={settings.schoolLogoUrl}
                  alt={settings.schoolName}
                  className="w-full h-full object-contain drop-shadow-sm"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <School className="w-10 h-10 text-emerald-600" />
              )}
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 bg-emerald-100/80 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold tracking-wider uppercase inline-block">
                SD Negeri Neglasari 02
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">{settings.schoolName}</h2>
              <p className="text-xs text-blue-600 font-semibold">Sistem Informasi Sekolah Dasar Terpadu</p>
              <p className="text-xs text-slate-600 pt-2 leading-relaxed">
                Silakan masuk menggunakan Akun Google resmi sekolah untuk mengakses fitur Admin, Kepala Sekolah, Guru, Pustakawan, atau Petugas UKS.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-3"
              >
                <LogIn className="w-5 h-5" />
                Masuk dengan Google OAuth
              </button>

              <button
                onClick={() => setShowPublicPortal(true)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                Akses Portal Siswa & Kartu Digital (Publik)
              </button>
            </div>

            <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
              <p className="flex items-center justify-center gap-1.5 text-emerald-700 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-600" />
                Mendukung Multi-Role RBAC & Dropdown Switcher
              </p>
              <p className="text-slate-400">Firebase Firestore • Fonnte WA Gateway • Barcode Scanner</p>
            </div>
          </div>
        </div>
      )}

      {/* 30-Minute Inactivity Warning Modal */}
      <InactivityModal
        isOpen={showWarningModal}
        remainingSeconds={remainingSeconds}
        onExtendSession={extendSession}
        onLogoutNow={handleLogout}
      />

      {/* Centralized Academic Calendar Modal */}
      <KalenderAkademikModal
        isOpen={isKalenderOpen}
        onClose={() => setIsKalenderOpen(false)}
        currentUserRole={currentUser ? activeRole : undefined}
        currentUserName={currentUser?.displayName}
      />

      {/* Student ID Card Barcode & Library Card Generator Modal */}
      <StudentCardModal
        isOpen={isStudentCardOpen}
        onClose={() => setIsStudentCardOpen(false)}
        initialSiswaId={selectedSiswaIdForCard}
      />

    </div>
  );
}
