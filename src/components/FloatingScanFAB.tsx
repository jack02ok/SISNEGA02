import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, setDoc } from 'firebase/firestore';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { Siswa, Buku, Role } from '../types';
import { logAuditEvent } from '../services/auditService';
import { sendFonnteWA } from '../services/fonnteService';
import { QrCode, CheckCircle2, User, BookOpen, Clock, AlertCircle, X, Sparkles } from 'lucide-react';

interface FloatingScanFABProps {
  activeRole: Role;
  actorName: string;
}

export const FloatingScanFAB: React.FC<FloatingScanFABProps> = ({ activeRole, actorName }) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedData, setScannedData] = useState<{
    siswa?: Siswa;
    buku?: Buku;
    code: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quickMessage, setQuickMessage] = useState<string | null>(null);

  const handleScanSuccess = async (code: string) => {
    setIsProcessing(true);
    setQuickMessage(null);
    try {
      // 1. Search student by NISN or NIS
      const siswaRef = collection(db, 'siswa');
      const qNisn = query(siswaRef, where('nisn', '==', code.trim()));
      let siswaSnap = await getDocs(qNisn);

      if (siswaSnap.empty) {
        const qNis = query(siswaRef, where('nis', '==', code.trim()));
        siswaSnap = await getDocs(qNis);
      }

      // 2. Search book by kodeBuku
      const bukuRef = collection(db, 'buku');
      const qBuku = query(bukuRef, where('kodeBuku', '==', code.trim()));
      const bukuSnap = await getDocs(qBuku);

      let foundSiswa: Siswa | undefined;
      let foundBuku: Buku | undefined;

      if (!siswaSnap.empty) {
        foundSiswa = { ...siswaSnap.docs[0].data(), id: siswaSnap.docs[0].id } as Siswa;
      }
      if (!bukuSnap.empty) {
        foundBuku = { ...bukuSnap.docs[0].data(), id: bukuSnap.docs[0].id } as Buku;
      }

      setScannedData({
        siswa: foundSiswa,
        buku: foundBuku,
        code
      });
    } catch (err) {
      console.error('Quick scan search error:', err);
      setScannedData({ code });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick Action 1: Instant Presensi Hadir for Student
  const handleQuickAbsensi = async (status: 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA') => {
    if (!scannedData?.siswa) return;
    setIsProcessing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      const s = scannedData.siswa;
      const absId = `ABS-${s.id}-${today}`;

      await setDoc(doc(db, 'absensi', absId), {
        id: absId,
        siswaId: s.id,
        nisn: s.nisn,
        namaSiswa: s.nama,
        rombelId: s.rombelId,
        rombelNama: s.rombelNama || 'Kelas',
        tanggal: today,
        waktuMasuk: timeStr,
        status,
        waNotified: true
      });

      // Trigger 'Siswa Tiba' WA Notification via Fonnte API
      if (s.noWaOrtu) {
        const statusLabel = status === 'HADIR' ? 'TIBA di Sekolah' : `Absensi: ${status}`;
        const waMsg = `Yth. Bapak/Ibu ${s.namaOrtu || 'Orang Tua'},\n\nPemberitahuan Absensi Sekolah:\nAnanda *${s.nama}* (${s.rombelNama || 'Kelas'}) telah *${statusLabel}* pada jam *${timeStr}* WIB.\n\nTerima kasih.`;
        await sendFonnteWA({
          target: s.noWaOrtu,
          message: waMsg
        });
      }

      await logAuditEvent(
        actorName || 'Petugas Scan',
        activeRole,
        'SYSTEM',
        `Presensi Cepat FAB Barcode (${status}): ${s.nama} (${s.rombelNama})`
      );

      setQuickMessage(`✅ Presensi [${status}] berhasil dicatat & WA Otomatis terkirim untuk ${s.nama}!`);
      setTimeout(() => {
        setScannedData(null);
        setQuickMessage(null);
      }, 2000);
    } catch (err: any) {
      alert('Gagal mencatat presensi: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        <button
          onClick={() => setIsScannerOpen(true)}
          title="Quick Scan Barcode NISN / Buku (Akses Cepat)"
          className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all border border-blue-400/40"
        >
          <div className="p-1.5 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs tracking-wide">Scan Barcode</span>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
          </span>
        </button>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title="Scan Barcode / QR ID Card & Buku"
        placeholderText="Akses cepat: Ketik NISN siswa / Kode buku..."
      />

      {/* Quick Result Result Card Floating Overlay */}
      {scannedData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 text-slate-800 dark:text-slate-100">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" /> Hasil Scan Cepat (FAB)
              </div>
              <button
                onClick={() => setScannedData(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {quickMessage ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 rounded-2xl text-xs font-bold text-center border border-emerald-200 animate-in zoom-in-95">
                {quickMessage}
              </div>
            ) : (
              <>
                {/* Student Result */}
                {scannedData.siswa ? (
                  <div className="p-4 bg-blue-50/60 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{scannedData.siswa.nama}</h4>
                        <p className="text-xs text-slate-500 font-mono">NISN: {scannedData.siswa.nisn} • Rombel: {scannedData.siswa.rombelNama}</p>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium pt-1">
                      Catat Presensi Hari Ini ({new Date().toLocaleDateString('id-ID')}):
                    </p>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleQuickAbsensi('HADIR')}
                        disabled={isProcessing}
                        className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> HADIR
                      </button>
                      <button
                        onClick={() => handleQuickAbsensi('SAKIT')}
                        disabled={isProcessing}
                        className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        <Clock className="w-3.5 h-3.5" /> SAKIT
                      </button>
                      <button
                        onClick={() => handleQuickAbsensi('IZIN')}
                        disabled={isProcessing}
                        className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        IZIN
                      </button>
                      <button
                        onClick={() => handleQuickAbsensi('ALPA')}
                        disabled={isProcessing}
                        className="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                      >
                        ALPA
                      </button>
                    </div>
                  </div>
                ) : scannedData.buku ? (
                  /* Book Result */
                  <div className="p-4 bg-purple-50/60 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800 space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">{scannedData.buku.judul}</h4>
                        <p className="text-xs text-slate-500">Kode: {scannedData.buku.kodeBuku} • Pengarang: {scannedData.buku.pengarang}</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 pt-2">
                      Stok Tersedia: <strong className="text-purple-600 dark:text-purple-300">{scannedData.buku.stokTersedia} unit</strong>
                    </p>
                  </div>
                ) : (
                  /* Unknown Code */
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl text-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                    <p className="text-xs font-bold">Kode tidak terdaftar sebagai Siswa atau Buku</p>
                    <p className="text-[11px] text-slate-400 font-mono">{scannedData.code}</p>
                  </div>
                )}
              </>
            )}

            <div className="text-center pt-2">
              <button
                onClick={() => setScannedData(null)}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline font-medium"
              >
                Tutup Overlay Scan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
