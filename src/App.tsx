import React, { useState, useEffect } from 'react';
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
import { seedDatabaseIfEmpty } from './services/seedData';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, School, ShieldAlert, QrCode } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRole] = useState<Role>('ADMIN');
  const [activeTab, setActiveTab] = useState<string>('admin-users');
  const [showPublicPortal, setShowPublicPortal] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>({
    fonnteToken: 'mBya#Xq@4Y!p9zK12345',
    schoolName: 'SD Negeri Neglasari 02',
    schoolAddress: 'Jl. Raya Neglasari No. 02, Kec. Neglasari',
    schoolNPSN: '20109876',
    kepsekNama: 'Drs. H. Ahmad Wijaya, M.Pd.',
    kepsekNip: '196805121992031004',
    dendaPerHari: 1000,
    schoolLogoUrl: 'https://raw.githubusercontent.com/jack02ok/osnsd/refs/heads/main/logosd.png'
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

    // Subscribe Auth
    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const userRef = doc(db, 'users', fbUser.uid);
        const userSnap = await getDoc(userRef);

        let userProfile: UserProfile;
        if (userSnap.exists()) {
          userProfile = userSnap.data() as UserProfile;
        } else {
          // Default multi-role assignment for new Google login user (e.g. Admin + Guru Kelas + Pustakawan for full test capability)
          userProfile = {
            uid: fbUser.uid,
            email: fbUser.email || 'user@sd.sch.id',
            displayName: fbUser.displayName || 'Guru / Staf SD',
            photoURL: fbUser.photoURL || '',
            roles: ['ADMIN', 'KEPSEK', 'GURU_KELAS', 'GURU_MAPEL', 'PUSTAKAWAN', 'UKS'],
            activeRole: 'ADMIN',
            rombelBinaan: 'Kelas 1A',
            mapelBinaan: ['PJOK', 'Pendidikan Agama Islam']
          };
          await setDoc(userRef, userProfile);
        }

        setCurrentUser(userProfile);
        setActiveRole(userProfile.activeRole || 'ADMIN');
        setActiveTab(DEFAULT_TABS[userProfile.activeRole || 'ADMIN']);
      } else {
        setCurrentUser(null);
      }
    });

    return () => {
      unsubConfig();
      unsubAuth();
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
  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

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
        /* Login Hero Section for unauthenticated user */
        <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white">
          <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-md rounded-3xl p-8 border border-slate-700 shadow-2xl text-center space-y-6">
            <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20 p-2 border border-white/20">
              {settings.schoolLogoUrl ? (
                <img
                  src={settings.schoolLogoUrl}
                  alt={settings.schoolName}
                  className="w-full h-full object-contain drop-shadow-md"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <School className="w-10 h-10 text-white" />
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white">{settings.schoolName}</h2>
              <p className="text-xs text-blue-300 font-medium">Sistem Informasi Sekolah Dasar Terpadu</p>
              <p className="text-xs text-slate-400 pt-2 leading-relaxed">
                Silakan masuk menggunakan Akun Google resmi sekolah untuk mengakses fitur Admin, Kepala Sekolah, Guru, Pustakawan, atau Petugas UKS.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3"
              >
                <LogIn className="w-5 h-5" />
                Masuk dengan Google OAuth
              </button>

              <button
                onClick={() => setShowPublicPortal(true)}
                className="w-full py-3 bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-200 border border-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4 text-amber-300" />
                Akses Portal Siswa & Kartu Digital (Publik)
              </button>
            </div>

            <div className="pt-4 border-t border-slate-700/60 text-[11px] text-slate-400 space-y-1">
              <p className="flex items-center justify-center gap-1.5 text-amber-300 font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                Mendukung Multi-Role RBAC & Dropdown Switcher
              </p>
              <p>Firebase Firestore • Fonnte WA Gateway • Barcode Scanner</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
