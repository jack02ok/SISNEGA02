import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { Siswa, Rombel, AppSettings } from '../types';
import { downloadElementAsPDF, printElement } from '../services/pdfService';
import { Printer, Download, CreditCard, Search, X, Users, BookOpen, Sparkles, Check, School } from 'lucide-react';

interface StudentCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  siswaList?: Siswa[];
  rombelList?: Rombel[];
  settings?: AppSettings;
  initialSiswaId?: string;
  defaultSelectedSiswaId?: string;
}

// Sub-component to render barcode on SVG
const StudentBarcodeSvg: React.FC<{ value: string; height?: number }> = ({ value, height = 32 }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: 1.4,
          height: height,
          displayValue: true,
          fontSize: 10,
          font: 'monospace',
          margin: 0,
          background: '#ffffff',
          lineColor: '#0f172a'
        });
      } catch (err) {
        console.warn('JsBarcode render error:', err);
      }
    }
  }, [value, height]);

  return <svg ref={svgRef} className="max-w-full h-auto mx-auto"></svg>;
};

export const StudentCardModal: React.FC<StudentCardModalProps> = ({
  isOpen,
  onClose,
  siswaList: propSiswaList,
  rombelList: propRombelList,
  settings: propSettings,
  initialSiswaId,
  defaultSelectedSiswaId
}) => {
  const [localSiswa, setLocalSiswa] = useState<Siswa[]>([]);
  const [localRombel, setLocalRombel] = useState<Rombel[]>([]);
  const [localSettings, setLocalSettings] = useState<AppSettings>({
    fonnteToken: '',
    schoolName: 'SD Negeri Neglasari 02',
    schoolAddress: 'Jl. Raya Neglasari No. 02',
    schoolNPSN: '20109876',
    kepsekNama: 'Drs. H. Ahmad Wijaya, M.Pd.',
    kepsekNip: '196805121992031004',
    dendaPerHari: 1000,
    schoolLogoUrl: 'https://raw.githubusercontent.com/jack02ok/osnsd/refs/heads/main/logosd.png'
  });

  const [selectedRombelId, setSelectedRombelId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSiswaIds, setSelectedSiswaIds] = useState<string[]>([]);
  const [cardOrientation, setCardOrientation] = useState<'FRONT' | 'BACK' | 'BOTH'>('BOTH');

  // Fallback real-time Firestore subscription if props not passed
  useEffect(() => {
    if (!isOpen) return;

    if (!propSiswaList) {
      const unsubSiswa = onSnapshot(collection(db, 'siswa'), (snap) => {
        const list: Siswa[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Siswa));
        setLocalSiswa(list);
      });
      return () => unsubSiswa();
    }
  }, [isOpen, propSiswaList]);

  useEffect(() => {
    if (!isOpen) return;

    if (!propRombelList) {
      const unsubRombel = onSnapshot(collection(db, 'rombel'), (snap) => {
        const list: Rombel[] = [];
        snap.forEach((d) => list.push({ ...d.data(), id: d.id } as Rombel));
        setLocalRombel(list);
      });
      return () => unsubRombel();
    }
  }, [isOpen, propRombelList]);

  useEffect(() => {
    if (!isOpen) return;

    if (!propSettings) {
      const unsubConfig = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
        if (snap.exists()) setLocalSettings(snap.data() as AppSettings);
      });
      return () => unsubConfig();
    }
  }, [isOpen, propSettings]);

  const activeSiswaList = propSiswaList || localSiswa;
  const activeRombelList = propRombelList || localRombel;
  const activeSettings = propSettings || localSettings;

  const targetSiswaId = initialSiswaId || defaultSelectedSiswaId;

  // Initialize selected student on open
  useEffect(() => {
    if (targetSiswaId) {
      setSelectedSiswaIds([targetSiswaId]);
    } else if (activeSiswaList.length > 0 && selectedSiswaIds.length === 0) {
      setSelectedSiswaIds([activeSiswaList[0].id]);
    }
  }, [targetSiswaId, activeSiswaList]);

  if (!isOpen) return null;

  // Filter students
  const filteredSiswa = activeSiswaList.filter((s) => {
    const matchRombel = selectedRombelId === 'ALL' || s.rombelId === selectedRombelId;
    const q = searchQuery.toLowerCase();
    const matchQuery =
      s.nama.toLowerCase().includes(q) ||
      (s.nisn && s.nisn.includes(q)) ||
      (s.nis && s.nis.includes(q)) ||
      (s.rombelNama && s.rombelNama.toLowerCase().includes(q));
    return matchRombel && matchQuery;
  });

  const toggleSelectSiswa = (id: string) => {
    if (selectedSiswaIds.includes(id)) {
      setSelectedSiswaIds(selectedSiswaIds.filter((x) => x !== id));
    } else {
      setSelectedSiswaIds([...selectedSiswaIds, id]);
    }
  };

  const handleSelectAllInFilter = () => {
    const allFilteredIds = filteredSiswa.map((s) => s.id);
    const isAllSelected = allFilteredIds.every((id) => selectedSiswaIds.includes(id));

    if (isAllSelected) {
      setSelectedSiswaIds(selectedSiswaIds.filter((id) => !allFilteredIds.includes(id)));
    } else {
      const combined = Array.from(new Set([...selectedSiswaIds, ...allFilteredIds]));
      setSelectedSiswaIds(combined);
    }
  };

  const selectedStudents = activeSiswaList.filter((s) => selectedSiswaIds.includes(s.id));

  const handlePrint = () => {
    printElement('id-cards-printable-container', 'Kartu Pelajar & Perpustakaan');
  };

  const handleDownloadPDF = () => {
    downloadElementAsPDF('id-cards-printable-container', `Kartu_Pelajar_SD_${Date.now()}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Generator Kartu Pelajar & Perpustakaan Digital
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] rounded-full font-bold">
                  Barcode Code128 Ready
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kartu pelajar resmi multifungsi terintegrasi sistem absen otomatis & peminjaman perpustakaan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-hidden">
          
          {/* Left Panel: Filter & Student Selection Checklist */}
          <div className="lg:col-span-4 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900/50 overflow-y-auto max-h-[40vh] lg:max-h-none">
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Pilih Kelas / Rombel:</span>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                  {selectedSiswaIds.length} Siswa Dipilih
                </span>
              </label>
              <select
                value={selectedRombelId}
                onChange={(e) => setSelectedRombelId(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100"
              >
                <option value="ALL">-- Semua Rombel ({activeSiswaList.length} Siswa) --</option>
                {activeRombelList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama / NISN..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleSelectAllInFilter}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Users className="w-3.5 h-3.5" />
                {filteredSiswa.every((s) => selectedSiswaIds.includes(s.id))
                  ? 'Batalkan Semua Kelas Ini'
                  : 'Pilih Semua Siswa Kelas Ini'}
              </button>
              <span className="text-[11px] text-slate-400">Total: {filteredSiswa.length}</span>
            </div>

            {/* Student List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[160px] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-800/80 p-2">
              {filteredSiswa.length === 0 ? (
                <p className="text-center text-xs text-slate-400 py-6">Tidak ditemukan siswa.</p>
              ) : (
                filteredSiswa.map((s) => {
                  const isChecked = selectedSiswaIds.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelectSiswa(s.id)}
                      className={`p-2 rounded-lg text-xs cursor-pointer border flex items-center justify-between transition-all ${
                        isChecked
                          ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 font-bold'
                          : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div>
                        <p className="line-clamp-1">{s.nama}</p>
                        <p className="text-[10px] text-slate-400 font-normal">
                          NISN: {s.nisn || '-'} • {s.rombelNama}
                        </p>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Display Mode Selection */}
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl space-y-1">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block">
                Sisi Kartu Yang Dicetak:
              </label>
              <div className="grid grid-cols-3 gap-1 text-[11px]">
                <button
                  onClick={() => setCardOrientation('BOTH')}
                  className={`py-1 rounded-lg font-bold border transition-colors ${
                    cardOrientation === 'BOTH'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  Depan & Belakang
                </button>
                <button
                  onClick={() => setCardOrientation('FRONT')}
                  className={`py-1 rounded-lg font-bold border transition-colors ${
                    cardOrientation === 'FRONT'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  Hanya Depan
                </button>
                <button
                  onClick={() => setCardOrientation('BACK')}
                  className={`py-1 rounded-lg font-bold border transition-colors ${
                    cardOrientation === 'BACK'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  Hanya Belakang
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Live Card Preview & Printable Area */}
          <div className="lg:col-span-8 p-4 sm:p-6 bg-slate-200/80 dark:bg-slate-950 flex flex-col overflow-y-auto max-h-[70vh] lg:max-h-none">
            
            <div className="flex items-center justify-between mb-3 no-print">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Preview Tampilan Kartu ({selectedStudents.length} Kartu Siap)
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPDF}
                  disabled={selectedStudents.length === 0}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
                >
                  <Download className="w-4 h-4" /> Download PDF
                </button>
                <button
                  onClick={handlePrint}
                  disabled={selectedStudents.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-colors"
                >
                  <Printer className="w-4 h-4" /> Cetak Kartu
                </button>
              </div>
            </div>

            {/* Printable Container */}
            <div
              id="id-cards-printable-container"
              className="space-y-6 p-4 bg-slate-300/40 dark:bg-slate-900/50 rounded-2xl border border-slate-300 dark:border-slate-800 flex flex-col items-center"
            >
              {selectedStudents.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p className="font-bold text-sm">Pilih minimal 1 siswa dari daftar di samping</p>
                  <p className="text-xs">Kartu pelajar dengan barcode resmi akan otomatis di-generate.</p>
                </div>
              ) : (
                selectedStudents.map((siswa) => {
                  const barcodeValue = siswa.nisn || siswa.id;
                  return (
                    <div
                      key={siswa.id}
                      className="flex flex-col md:flex-row items-center justify-center gap-6 p-2 page-break-after-always"
                    >
                      {/* FRONT CARD */}
                      {(cardOrientation === 'BOTH' || cardOrientation === 'FRONT') && (
                        <div className="w-[330px] h-[210px] bg-gradient-to-br from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-3 shadow-xl border-2 border-amber-400/80 relative overflow-hidden flex flex-col justify-between shrink-0 font-sans">
                          
                          {/* Background Decorative Waves */}
                          <div className="absolute -right-10 -top-10 w-36 h-36 bg-amber-400/10 rounded-full blur-xl pointer-events-none"></div>
                          <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-blue-500/20 rounded-full blur-xl pointer-events-none"></div>

                          {/* Card Header */}
                          <div className="flex items-center gap-2 border-b border-amber-400/40 pb-2 relative z-10">
                            <img
                              src={
                                activeSettings.schoolLogoUrl ||
                                'https://images.unsplash.com/photo-1594312915251-48db9280c8f1?w=100&h=100&fit=crop'
                              }
                              alt="Logo"
                              className="w-9 h-9 object-contain bg-white rounded-full p-0.5 border border-amber-400/60"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="flex-1 leading-tight">
                              <h4 className="font-extrabold text-[11px] uppercase tracking-wider text-amber-300">
                                {activeSettings.schoolName || 'SD NEGERI NEGLASARI 02'}
                              </h4>
                              <p className="text-[9px] font-bold text-blue-200 tracking-tight">
                                KARTU PELAJAR & PERPUSTAKAAN
                              </p>
                            </div>
                            <BookOpen className="w-5 h-5 text-amber-400 shrink-0" />
                          </div>

                          {/* Card Body: Photo & Student Data */}
                          <div className="grid grid-cols-12 gap-2 my-1 items-center relative z-10">
                            <div className="col-span-4 flex flex-col items-center">
                              <div className="w-16 h-20 bg-slate-100 rounded-xl border-2 border-amber-400 overflow-hidden shadow-inner flex items-center justify-center">
                                <img
                                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${siswa.id}`}
                                  alt={siswa.nama}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="text-[8px] font-bold text-amber-300 mt-1 uppercase tracking-tighter">
                                {siswa.gender === 'L' ? 'LAKI-LAKI' : 'PEREMPUAN'}
                              </span>
                            </div>

                            <div className="col-span-8 text-[10px] space-y-0.5 leading-snug">
                              <div>
                                <span className="text-[8px] text-slate-300 block font-medium">NAMA LENGKAP</span>
                                <h5 className="font-extrabold text-[11px] text-white uppercase tracking-tight line-clamp-1">
                                  {siswa.nama}
                                </h5>
                              </div>

                              <div className="grid grid-cols-2 gap-1 pt-0.5">
                                <div>
                                  <span className="text-[8px] text-slate-300 block font-medium">NISN</span>
                                  <span className="font-mono font-bold text-amber-300">{siswa.nisn || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-[8px] text-slate-300 block font-medium">KELAS / ROMBEL</span>
                                  <span className="font-bold text-blue-200">{siswa.rombelNama || 'Kelas 1'}</span>
                                </div>
                              </div>

                              <div>
                                <span className="text-[8px] text-slate-300 block font-medium">ORANG TUA / WALI</span>
                                <span className="font-semibold text-slate-200 line-clamp-1">
                                  {siswa.namaOrtu || '-'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer */}
                          <div className="border-t border-amber-400/30 pt-1.5 flex items-end justify-between text-[8px] relative z-10">
                            <div>
                              <p className="text-slate-300">Masa Berlaku:</p>
                              <p className="font-bold text-amber-300">Selama Menjadi Siswa</p>
                            </div>

                            <div className="text-right leading-none">
                              <p className="text-[7px] text-slate-300">Kepala Sekolah,</p>
                              <p className="font-bold text-white mt-2 border-b border-amber-400/60 pb-0.5">
                                {activeSettings.kepsekNama || 'Hj. Syarifah, M.Pd'}
                              </p>
                              <p className="text-[7px] text-slate-300 mt-0.5 font-mono">
                                NIP. {activeSettings.kepsekNip || '197508122005012003'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* BACK CARD */}
                      {(cardOrientation === 'BOTH' || cardOrientation === 'BACK') && (
                        <div className="w-[330px] h-[210px] bg-white text-slate-900 rounded-2xl p-3 shadow-xl border-2 border-slate-300 relative overflow-hidden flex flex-col justify-between shrink-0 font-sans">
                          
                          {/* Header Back */}
                          <div className="border-b border-slate-200 pb-1 text-center">
                            <h5 className="font-extrabold text-[10px] text-blue-900 uppercase tracking-wider">
                              TATA TERTIB PERPUSTAKAAN & KARTU DIGITAL
                            </h5>
                          </div>

                          {/* Rules */}
                          <div className="text-[8.5px] text-slate-700 space-y-1 my-1 leading-tight px-1">
                            <p>1. Kartu ini wajib dibawa saat melakukan presensi & peminjaman buku perpustakaan.</p>
                            <p>2. Dilarang merusak, meminjamkan, atau memalsukan kartu pelajar ini.</p>
                            <p>3. Peminjaman buku berlaku maksimal 7 hari kerja. Keterlambatan dikenakan denda Rp {activeSettings.dendaPerHari || 1000}/hari.</p>
                            <p>4. Jika kartu hilang, segera laporkan ke Pengelola TU atau Pustakawan Sekolah.</p>
                          </div>

                          {/* Barcode Area */}
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-1.5 text-center flex flex-col items-center justify-center">
                            <StudentBarcodeSvg value={barcodeValue} height={28} />
                            <p className="text-[8px] font-mono text-slate-500 mt-0.5">
                              ID BARCODE PERPUS: {barcodeValue}
                            </p>
                          </div>

                          {/* Footer Back */}
                          <div className="text-[7.5px] text-slate-400 text-center border-t border-slate-200 pt-1">
                            {activeSettings.schoolAddress || 'Jl. Raya Pendidikan No. 02, Kabupaten Tangerang'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
