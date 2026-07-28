import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Siswa, Absensi, TransaksiPerpus, UKSScreening, Buku, AppSettings } from '../../types';
import { cacheStudentRoster, getCachedStudentRoster } from '../../services/offlineStorage';
import { BarcodeGenerator } from '../BarcodeGenerator';
import { TableSkeleton, ProfileSkeleton } from '../SkeletonLoader';
import {
  User,
  QrCode,
  Calendar,
  BookOpen,
  HeartPulse,
  Search,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  School,
  ArrowLeft
} from 'lucide-react';

interface PublicStudentPortalProps {
  settings: AppSettings;
  onBackToApp?: () => void;
  initialNisn?: string;
}

export const PublicStudentPortal: React.FC<PublicStudentPortalProps> = ({
  settings,
  onBackToApp,
  initialNisn = ''
}) => {
  const [searchNisn, setSearchNisn] = useState(initialNisn || '');
  const [selectedStudent, setSelectedStudent] = useState<Siswa | null>(null);
  const [siswaList, setSiswaList] = useState<Siswa[]>(() => getCachedStudentRoster());
  const [absensiList, setAbsensiList] = useState<Absensi[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiPerpus[]>([]);
  const [bukuList, setBukuList] = useState<Buku[]>([]);
  const [uksScreeningList, setUksScreeningList] = useState<UKSScreening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profil' | 'absensi' | 'perpus' | 'uks'>('profil');

  // Fetch all master data for public portal view
  useEffect(() => {
    setIsLoading(true);

    const unsubSiswa = onSnapshot(collection(db, 'siswa'), (snap) => {
      const list: Siswa[] = [];
      snap.forEach((doc) => list.push({ ...doc.data(), id: doc.id } as Siswa));
      if (list.length > 0) {
        setSiswaList(list);
        cacheStudentRoster(list);

        // Auto-select initial student if available
        const found = searchNisn
          ? list.find(s => s.nisn === searchNisn || s.nis === searchNisn || s.id === searchNisn || s.nama.toLowerCase().includes(searchNisn.toLowerCase()))
          : null;
        setSelectedStudent(found || list[0] || null);
      } else {
        const cached = getCachedStudentRoster();
        if (cached.length > 0) {
          setSiswaList(cached);
          setSelectedStudent(cached[0]);
        }
      }
      setIsLoading(false);
    }, err => {
      console.warn('Siswa portal listener info:', err.message);
      const cached = getCachedStudentRoster();
      if (cached.length > 0) {
        setSiswaList(cached);
        setSelectedStudent(cached[0]);
      }
      setIsLoading(false);
    });

    const unsubAbsensi = onSnapshot(collection(db, 'absensi'), (snap) => {
      const list: Absensi[] = [];
      snap.forEach((doc) => list.push({ ...doc.data(), id: doc.id } as Absensi));
      setAbsensiList(list);
    }, err => console.warn('Absensi portal listener info:', err.message));

    const unsubPerpus = onSnapshot(collection(db, 'transaksiPerpus'), (snap) => {
      const list: TransaksiPerpus[] = [];
      snap.forEach((doc) => list.push({ ...doc.data(), id: doc.id } as TransaksiPerpus));
      setTransaksiList(list);
    }, err => console.warn('Transaksi portal listener info:', err.message));

    const unsubBuku = onSnapshot(collection(db, 'buku'), (snap) => {
      const list: Buku[] = [];
      snap.forEach((doc) => list.push({ ...doc.data(), id: doc.id } as Buku));
      setBukuList(list);
    }, err => console.warn('Buku portal listener info:', err.message));

    const unsubUks = onSnapshot(collection(db, 'uksScreening'), (snap) => {
      const list: UKSScreening[] = [];
      snap.forEach((doc) => list.push({ ...doc.data(), id: doc.id } as UKSScreening));
      setUksScreeningList(list);
    }, err => console.warn('UKS portal listener info:', err.message));

    return () => {
      unsubSiswa();
      unsubAbsensi();
      unsubPerpus();
      unsubBuku();
      unsubUks();
    };
  }, []);

  // Handle Search Student
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchNisn.trim()) {
      if (siswaList.length > 0) setSelectedStudent(siswaList[0]);
      return;
    }
    const queryStr = searchNisn.trim().toLowerCase();
    const found = siswaList.find(
      s => (s.nisn && s.nisn.toLowerCase() === queryStr) ||
           (s.nis && s.nis.toLowerCase() === queryStr) ||
           (s.id && s.id.toLowerCase() === queryStr) ||
           (s.nama && s.nama.toLowerCase().includes(queryStr))
    );

    if (found) {
      setSelectedStudent(found);
    } else {
      alert(`Siswa dengan NISN / NIS / Nama "${searchNisn}" tidak ditemukan.`);
    }
  };

  // Filtered student records
  const studentAbsensi = selectedStudent
    ? absensiList.filter(a => a.siswaId === selectedStudent.id || a.nisn === selectedStudent.nisn)
    : [];

  const studentLoans = selectedStudent
    ? transaksiList.filter(t => t.siswaId === selectedStudent.id || t.siswaNisn === selectedStudent.nisn)
    : [];

  const studentUks = selectedStudent
    ? uksScreeningList.find(u => u.siswaId === selectedStudent.id)
    : null;

  // Attendance stats calculation
  const totalDays = studentAbsensi.length;
  const hadirCount = studentAbsensi.filter(a => a.status === 'HADIR').length;
  const sakitCount = studentAbsensi.filter(a => a.status === 'SAKIT').length;
  const izinCount = studentAbsensi.filter(a => a.status === 'IZIN').length;
  const alpaCount = studentAbsensi.filter(a => a.status === 'ALPA').length;
  const attendanceRate = totalDays > 0 ? Math.round((hadirCount / totalDays) * 100) : 100;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Banner Public Header */}
      <header className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700/80 sticky top-0 z-30 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-700 rounded-xl p-1 border border-slate-600 flex items-center justify-center shadow-md overflow-hidden">
              {settings.schoolLogoUrl ? (
                <img
                  src={settings.schoolLogoUrl}
                  alt={settings.schoolName}
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <School className="w-5 h-5 text-indigo-400" />
              )}
            </div>
            <div>
              <h1 className="text-sm font-black text-white">{settings.schoolName}</h1>
              <p className="text-[11px] text-indigo-300 font-semibold">Portal Publik Informasi Siswa & QR Presensi</p>
            </div>
          </div>

          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> Kembali ke Aplikasi
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Student Selector / Search Bar */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-xl space-y-3">
          <label className="block text-xs font-bold text-slate-300">
            🔍 Cari Profil & Kartu Digital Siswa (NISN / Nama / Barcode)
          </label>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchNisn}
                onChange={e => setSearchNisn(e.target.value)}
                placeholder="Masukkan NISN atau Nama Siswa (e.g. 0051234567)..."
                className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all"
              >
                Cari Siswa
              </button>

              {siswaList.length > 0 && (
                <select
                  value={selectedStudent?.id || ''}
                  onChange={e => {
                    const found = siswaList.find(s => s.id === e.target.value);
                    if (found) {
                      setSelectedStudent(found);
                      setSearchNisn(found.nisn);
                    }
                  }}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none"
                >
                  <option value="">-- Pilih Siswa --</option>
                  {siswaList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.nama} ({s.rombelNama})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </form>
        </div>

        {/* Loading State or Skeleton */}
        {isLoading ? (
          <ProfileSkeleton />
        ) : !selectedStudent ? (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-12 text-center text-slate-400 space-y-2">
            <User className="w-12 h-12 mx-auto text-slate-600" />
            <p className="font-bold text-sm">Pilih atau Cari Siswa untuk Menampilkan Informasi Portal</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Student Header Card & Digital Card */}
            <div className="bg-gradient-to-br from-indigo-950 via-slate-800 to-slate-900 border border-indigo-800/60 rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-5 text-center md:text-left">
                  <div className="w-20 h-20 rounded-2xl bg-indigo-600/30 border-2 border-indigo-400/50 flex items-center justify-center text-indigo-200 overflow-hidden shadow-lg">
                    {selectedStudent.fotoUrl ? (
                      <img src={selectedStudent.fotoUrl} alt={selectedStudent.nama} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <span className="px-3 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-black text-[10px] rounded-full uppercase tracking-wider">
                      {selectedStudent.rombelNama}
                    </span>
                    <h2 className="text-xl font-black text-white">{selectedStudent.nama}</h2>
                    <p className="text-xs text-indigo-200 font-mono">
                      NISN: <span className="font-bold text-amber-300">{selectedStudent.nisn}</span> • NIK: {selectedStudent.nik || '-'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Ortu: {selectedStudent.namaOrtu || '-'} ({selectedStudent.noHpOrtu || '-'})
                    </p>
                  </div>
                </div>

                {/* Digital Student Card Barcode / QR */}
                <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-200 text-center space-y-2 max-w-xs w-full">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    KARTU PELAJAR DIGITAL (SCAN BARCODE)
                  </p>
                  <div className="flex justify-center bg-white p-1 rounded-xl">
                    <BarcodeGenerator value={selectedStudent.nisn} width={1.8} height={40} fontSize={11} />
                  </div>
                  <p className="text-[9px] text-slate-500 italic">
                    Tunjukkan barcode ini ke scanner perpustakaan atau mesin absensi
                  </p>
                </div>
              </div>

              {/* Navigation Tabs for Public Portal */}
              <div className="flex flex-wrap gap-2 border-t border-indigo-800/60 pt-4">
                <button
                  onClick={() => setActiveTab('profil')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeTab === 'profil'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <User className="w-4 h-4" /> Profil & Data Diri
                </button>

                <button
                  onClick={() => setActiveTab('absensi')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeTab === 'absensi'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Calendar className="w-4 h-4" /> Riwayat Absensi ({attendanceRate}%)
                </button>

                <button
                  onClick={() => setActiveTab('perpus')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeTab === 'perpus'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <BookOpen className="w-4 h-4" /> Status Perpustakaan ({studentLoans.filter(l => l.status === 'DIPINJAM').length})
                </button>

                <button
                  onClick={() => setActiveTab('uks')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    activeTab === 'uks'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <HeartPulse className="w-4 h-4" /> Catatan Kesehatan UKS
                </button>
              </div>
            </div>

            {/* TAB CONTENT: PROFIL DATA DIRI */}
            {activeTab === 'profil' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
                  <User className="w-4 h-4 text-indigo-400" /> Detail Profil & Data Tempat Tinggal
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-1">
                    <p className="text-slate-400">Jenis Kelamin</p>
                    <p className="font-bold text-slate-100">{selectedStudent.jenisKelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-1">
                    <p className="text-slate-400">Tempat, Tanggal Lahir</p>
                    <p className="font-bold text-slate-100">{selectedStudent.tempatLahir}, {selectedStudent.tanggalLahir}</p>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-1">
                    <p className="text-slate-400">Nama Orang Tua / Wali</p>
                    <p className="font-bold text-slate-100">{selectedStudent.namaOrtu || '-'}</p>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-1">
                    <p className="text-slate-400">Nomor HP / WhatsApp Orang Tua</p>
                    <p className="font-bold text-emerald-400 font-mono">{selectedStudent.noHpOrtu || '-'}</p>
                  </div>

                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 space-y-1 md:col-span-2">
                    <p className="text-slate-400">Alamat Rumah Lengkap</p>
                    <p className="font-bold text-slate-100">{selectedStudent.alamat || '-'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: RIWAYAT ABSENSI */}
            {activeTab === 'absensi' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-6">
                <div className="border-b border-slate-700 pb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" /> Ringkasan Presensi Siswa
                  </h3>
                  <span className="text-xs font-bold px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg">
                    Tingkat Kehadiran: {attendanceRate}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl">
                    <p className="text-[11px] text-emerald-300 font-bold">HADIR</p>
                    <p className="text-2xl font-black text-emerald-400 mt-1">{hadirCount}</p>
                  </div>
                  <div className="p-3 bg-blue-950/40 border border-blue-800/60 rounded-xl">
                    <p className="text-[11px] text-blue-300 font-bold">SAKIT</p>
                    <p className="text-2xl font-black text-blue-400 mt-1">{sakitCount}</p>
                  </div>
                  <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl">
                    <p className="text-[11px] text-amber-300 font-bold">IZIN</p>
                    <p className="text-2xl font-black text-amber-400 mt-1">{izinCount}</p>
                  </div>
                  <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl">
                    <p className="text-[11px] text-rose-300 font-bold">ALPA</p>
                    <p className="text-2xl font-black text-rose-400 mt-1">{alpaCount}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300">Catatan Tanggal Absensi Terakhir</h4>
                  {studentAbsensi.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Belum ada rekaman absensi terdaftar.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-700 text-slate-400 font-semibold">
                            <th className="p-2.5">Tanggal</th>
                            <th className="p-2.5">Waktu Scan</th>
                            <th className="p-2.5">Status</th>
                            <th className="p-2.5">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {studentAbsensi
                            .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
                            .map((a) => (
                              <tr key={a.id} className="hover:bg-slate-700/30">
                                <td className="p-2.5 font-mono text-slate-200">{a.tanggal}</td>
                                <td className="p-2.5 font-mono text-slate-400">{a.waktu || '-'}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 font-bold text-[10px] rounded-md ${
                                    a.status === 'HADIR' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                                    a.status === 'SAKIT' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                                    a.status === 'IZIN' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                    'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  }`}>
                                    {a.status}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-300">{a.keterangan || '-'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: STATUS PERPUSTAKAAN */}
            {activeTab === 'perpus' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-400" /> Status Peminjaman Buku Perpustakaan
                </h3>

                {studentLoans.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Siswa belum memiliki transaksi peminjaman buku.</p>
                ) : (
                  <div className="space-y-3">
                    {studentLoans.map((loan) => {
                      const book = bukuList.find(b => b.id === loan.bukuId);
                      const isOverdue = loan.status === 'DIPINJAM' && new Date(loan.tanggalTenggat) < new Date();
                      return (
                        <div key={loan.id} className="p-4 bg-slate-900/80 border border-slate-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <span className={`px-2 py-0.5 font-bold text-[9px] rounded-md ${
                              loan.status === 'DIKEMBALIKAN' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' :
                              isOverdue ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                              'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}>
                              {loan.status === 'DIKEMBALIKAN' ? 'Sudah Dikembalikan' : isOverdue ? 'Terlambat / Denda' : 'Sedang Dipinjam'}
                            </span>
                            <h4 className="font-bold text-slate-100 text-sm">{loan.bukuJudul || book?.judul || 'Buku Perpustakaan'}</h4>
                            <p className="text-slate-400">
                              Pinjam: <span className="font-mono text-slate-200">{loan.tanggalPinjam}</span> • Tenggat: <span className="font-mono text-amber-300">{loan.tanggalTenggat}</span>
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-[11px] text-slate-400">Denda Terkumpul</p>
                            <p className="text-sm font-black text-amber-400">Rp {(loan.denda || 0).toLocaleString('id-ID')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: CATATAN KESEHATAN UKS */}
            {activeTab === 'uks' && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-700 pb-3 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-rose-400" /> Hasil Screening Kesehatan Berkala UKS
                </h3>

                {!studentUks ? (
                  <p className="text-xs text-slate-400 italic">Belum ada rekaman data kesehatan UKS untuk siswa ini.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700">
                      <p className="text-slate-400">Tinggi Badan</p>
                      <p className="text-lg font-black text-slate-100 mt-1">{studentUks.tinggiBadan || '-'} cm</p>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700">
                      <p className="text-slate-400">Berat Badan</p>
                      <p className="text-lg font-black text-slate-100 mt-1">{studentUks.beratBadan || '-'} kg</p>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700">
                      <p className="text-slate-400">Indeks Massa Tubuh (IMT)</p>
                      <p className="text-lg font-black text-indigo-300 mt-1">{studentUks.imtScore || '-'}</p>
                      <p className="text-[10px] text-emerald-400 font-bold">{studentUks.imtKategori || '-'}</p>
                    </div>

                    <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700">
                      <p className="text-slate-400">Kesehatan Mata & Gigi</p>
                      <p className="font-bold text-slate-100 mt-1">Mata: {studentUks.penglihatan || 'Normal'}</p>
                      <p className="font-bold text-slate-100">Gigi: {studentUks.gigi || 'Sehat'}</p>
                    </div>

                    {studentUks.catatanKhusus && (
                      <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-700 sm:col-span-2 md:col-span-4">
                        <p className="text-slate-400">Catatan Khusus Petugas UKS</p>
                        <p className="font-semibold text-slate-200 mt-1">{studentUks.catatanKhusus}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
