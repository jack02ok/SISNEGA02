import React, { useState, useEffect } from 'react';
import { Siswa, AppSettings } from '../types';
import { BarcodeGenerator } from './BarcodeGenerator';
import { downloadElementAsPDF } from '../services/pdfService';
import { BookOpen, X, Printer, CheckCircle2, User, Search, Sparkles } from 'lucide-react';

interface DigitalLibraryCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  siswa: Siswa | null;
  siswaList?: Siswa[];
  settings: AppSettings;
}

export const DigitalLibraryCardModal: React.FC<DigitalLibraryCardModalProps> = ({
  isOpen,
  onClose,
  siswa: initialSiswa,
  siswaList = [],
  settings,
}) => {
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | null>(initialSiswa);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSelectedSiswa(initialSiswa);
  }, [initialSiswa]);

  if (!isOpen) return null;

  // Filter student list if searching
  const filteredSiswaList = siswaList.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      s.nama.toLowerCase().includes(q) ||
      (s.nisn && s.nisn.includes(q)) ||
      (s.nis && s.nis.includes(q)) ||
      (s.rombelNama && s.rombelNama.toLowerCase().includes(q))
    );
  });

  const activeStudent = selectedSiswa || (siswaList.length > 0 ? siswaList[0] : null);

  const handleDownloadPDF = () => {
    if (!activeStudent) return;
    const filename = `Kartu_Perpus_${activeStudent.nisn || activeStudent.id}_${activeStudent.nama.replace(/\s+/g, '_')}.pdf`;
    downloadElementAsPDF('digital-library-card-content', filename);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 transition-colors">
        {/* Header Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 text-white flex items-center justify-between border-b border-teal-600/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-teal-500/20 rounded-xl border border-teal-400/30">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Kartu Perpustakaan Digital
                <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 text-[10px] font-extrabold rounded-md border border-amber-400/30">
                  BARCODE SCANNER READY
                </span>
              </h3>
              <p className="text-[11px] text-teal-200">
                Kartu Anggota Perpustakaan Resmi & Kode Barcode Transaksi Sirkulasi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-teal-900/50 hover:bg-teal-900 text-teal-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Selector if list provided */}
          {siswaList.length > 0 && (
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                Pilih Siswa untuk Kartu Perpustakaan Digital:
              </label>
              <div className="flex gap-2">
                <select
                  value={activeStudent?.id || ''}
                  onChange={(e) => {
                    const found = siswaList.find((s) => s.id === e.target.value);
                    if (found) setSelectedSiswa(found);
                  }}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                >
                  {filteredSiswaList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.nisn || s.nis || 'No NISN'}) - {s.rombelNama || s.rombelId}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* CARD CONTAINER FOR PREVIEW & PDF DOWNLOAD */}
          {activeStudent ? (
            <div className="flex flex-col items-center">
              <div
                id="digital-library-card-content"
                className="w-full max-w-md bg-gradient-to-br from-teal-900 via-slate-900 to-teal-950 text-white rounded-2xl p-5 border-2 border-teal-500/40 shadow-xl relative overflow-hidden"
              >
                {/* Subtle Background Pattern Accent */}
                <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>
                <div className="absolute -left-10 -top-10 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>

                {/* Card Top Header */}
                <div className="flex items-center gap-3 border-b border-teal-700/60 pb-3 mb-4">
                  {settings.schoolLogoUrl ? (
                    <img
                      src={settings.schoolLogoUrl}
                      alt="Logo Sekolah"
                      className="w-10 h-10 object-contain rounded-lg bg-white/10 p-1 border border-white/20"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white text-sm shadow-inner">
                      SD
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-teal-300 font-semibold">
                      PERPUSTAKAAN DIGITAL
                    </p>
                    <h4 className="text-xs font-bold truncate text-white leading-tight">
                      {settings.schoolName || 'SD NEGERI 01 JAKARTA'}
                    </h4>
                    <p className="text-[9px] text-teal-200/80 truncate">
                      NPSN: {settings.schoolNPSN || '10293847'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded-md uppercase tracking-wide shadow-xs">
                      ANGGOTA
                    </span>
                  </div>
                </div>

                {/* Card Middle Student Body */}
                <div className="grid grid-cols-3 gap-3 items-center mb-4">
                  {/* Photo / Avatar */}
                  <div className="col-span-1 flex flex-col items-center">
                    <div className="w-20 h-24 rounded-xl bg-gradient-to-b from-teal-800 to-slate-800 border-2 border-teal-400/50 flex flex-col items-center justify-center shadow-md p-1 relative overflow-hidden">
                      <User className="w-10 h-10 text-teal-200" />
                      <span className="text-[8px] font-mono text-teal-300 mt-1 uppercase font-bold">
                        {activeStudent.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                      </span>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="col-span-2 space-y-1.5 text-xs">
                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-teal-300/80 font-bold">
                        Nama Lengkap Siswa
                      </p>
                      <p className="font-extrabold text-sm text-amber-300 leading-snug line-clamp-2">
                        {activeStudent.nama}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-teal-300/80 font-semibold">
                          NISN / NIS
                        </p>
                        <p className="font-mono text-xs font-bold text-white">
                          {activeStudent.nisn || activeStudent.nis || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-teal-300/80 font-semibold">
                          Rombel / Kelas
                        </p>
                        <p className="font-bold text-xs text-white">
                          {activeStudent.rombelNama || activeStudent.rombelId || 'Kelas 1A'}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[9px] uppercase tracking-wider text-teal-300/80 font-semibold">
                        Status Bebas Pustaka
                      </p>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        activeStudent.bebasPustaka
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        <CheckCircle2 className="w-3 h-3" />
                        {activeStudent.bebasPustaka ? 'Bebas Pustaka' : 'Aktif Meminjam'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom Barcode Section */}
                <div className="bg-white rounded-xl p-2.5 text-center shadow-inner flex flex-col items-center justify-center">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">
                    SCAN BARCODE KARTU PERPUSTAKAAN
                  </p>
                  <BarcodeGenerator
                    value={activeStudent.nisn || activeStudent.nis || activeStudent.id}
                    width={1.6}
                    height={40}
                    fontSize={11}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-500 py-6">
              Tidak ada data siswa yang dipilih.
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            Kartu dapat discan langsung dengan kamera scanner perpustakaan
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Printer className="w-4 h-4" />
              Unduh / Cetak PDF Kartu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
