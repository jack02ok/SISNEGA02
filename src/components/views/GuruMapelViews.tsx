import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Siswa, JurnalKBM, Penilaian, Rombel, UserProfile, JadwalPelajaran } from '../../types';
import { cacheStudentRoster, getCachedStudentRoster, cacheRombelList, getCachedRombelList, subscribeOnlineStatus, isOnline as checkIsOnline } from '../../services/offlineStorage';
import { BookOpen, GraduationCap, Plus, Save, WifiOff, Calendar, Clock, Trash2, MapPin, Tag, Filter } from 'lucide-react';

interface GuruMapelViewsProps {
  activeTab: string;
  user: UserProfile;
}

const HARI_LIST = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;

export const GuruMapelViews: React.FC<GuruMapelViewsProps> = ({ activeTab, user }) => {
  const [selectedRombel, setSelectedRombel] = useState('rombel-1a');
  const [selectedMapel, setSelectedMapel] = useState(user.mapelBinaan?.[0] || 'PJOK');

  const [onlineStatus, setOnlineStatus] = useState<boolean>(checkIsOnline());
  const [rombelList, setRombelList] = useState<Rombel[]>(() => getCachedRombelList());
  const [siswaList, setSiswaList] = useState<Siswa[]>(() => getCachedStudentRoster());
  const [jurnalList, setJurnalList] = useState<JurnalKBM[]>([]);
  const [penilaianList, setPenilaianList] = useState<Penilaian[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalPelajaran[]>([]);

  // Jurnal Form
  const [showAddJurnal, setShowAddJurnal] = useState(false);
  const [materi, setMateri] = useState('');

  // Jadwal Form State
  const [showAddJadwal, setShowAddJadwal] = useState(false);
  const [formHari, setFormHari] = useState<'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu'>('Senin');
  const [formJamMulai, setFormJamMulai] = useState('07:30');
  const [formJamSelesai, setFormJamSelesai] = useState('09:00');
  const [formJamKe, setFormJamKe] = useState('Jam 1 - 2');
  const [formRombelId, setFormRombelId] = useState('rombel-1a');
  const [formMapel, setFormMapel] = useState(user.mapelBinaan?.[0] || 'PJOK');
  const [formRuangan, setFormRuangan] = useState('Lapangan / R. Kelas');
  const [formKeterangan, setFormKeterangan] = useState('');
  const [filterHari, setFilterHari] = useState<string>('SEMUA');

  useEffect(() => {
    const unsubStatus = subscribeOnlineStatus((isOnline) => setOnlineStatus(isOnline));

    const unsubRombel = onSnapshot(collection(db, 'rombel'), snap => {
      const l: Rombel[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as Rombel));
      if (l.length > 0) { setRombelList(l); cacheRombelList(l); }
    }, (err) => {
      console.warn('Rombel offline fallback:', err);
      const cached = getCachedRombelList();
      if (cached.length > 0) setRombelList(cached);
    });

    const unsubSiswa = onSnapshot(collection(db, 'siswa'), snap => {
      const l: Siswa[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as Siswa));
      if (l.length > 0) { setSiswaList(l); cacheStudentRoster(l); }
    }, (err) => {
      console.warn('Siswa offline fallback:', err);
      const cached = getCachedStudentRoster();
      if (cached.length > 0) setSiswaList(cached);
    });

    const unsubJurnal = onSnapshot(collection(db, 'jurnalKBM'), snap => {
      const l: JurnalKBM[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as JurnalKBM)); setJurnalList(l);
    }, err => console.warn('Jurnal listener error:', err));

    const unsubPen = onSnapshot(collection(db, 'penilaian'), snap => {
      const l: Penilaian[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as Penilaian)); setPenilaianList(l);
    }, err => console.warn('Penilaian listener error:', err));

    // Real-time listener for Firestore collection 'jadwal'
    const unsubJadwal = onSnapshot(collection(db, 'jadwal'), snap => {
      const l: JadwalPelajaran[] = [];
      snap.forEach(d => l.push({ ...d.data(), id: d.id } as JadwalPelajaran));
      setJadwalList(l);
    }, err => console.warn('Jadwal listener error:', err));

    return () => {
      unsubStatus(); unsubRombel(); unsubSiswa(); unsubJurnal(); unsubPen(); unsubJadwal();
    };
  }, []);

  const handleAddJurnal = async (e: React.FormEvent) => {
    e.preventDefault();
    const rNama = rombelList.find(r => r.id === selectedRombel)?.nama || 'Kelas';
    const payload: JurnalKBM = {
      id: `JUR-${Date.now()}`,
      guruId: user.uid,
      guruNama: user.displayName,
      rombelId: rNama,
      mapel: selectedMapel,
      tanggal: new Date().toISOString().split('T')[0],
      jamKe: '1 - 2',
      materi
    };
    await addDoc(collection(db, 'jurnalKBM'), payload);
    setMateri('');
    setShowAddJurnal(false);
    alert(`Jurnal KBM ${selectedMapel} berhasil disimpan!`);
  };

  const handleSaveMapelGrade = async (siswaId: string, ptsVal: number) => {
    const penId = `NIL-${siswaId}-${selectedMapel}`;
    const payload: Penilaian = {
      id: penId,
      siswaId,
      rombelId: selectedRombel,
      mapel: selectedMapel,
      semester: '1',
      nilaiFormatif: [ptsVal - 2],
      nilaiSumatif: ptsVal,
      nilaiPTS: ptsVal,
      deskripsiCP: `Menunjukkan penguasaan kompetensi ${selectedMapel} yang sangat baik.`
    };
    await setDoc(doc(db, 'penilaian', penId), payload);
    alert(`Nilai ${selectedMapel} berhasil disimpan!`);
  };

  // Submit new Jadwal to Firestore collection 'jadwal'
  const handleAddJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const rObj = rombelList.find(r => r.id === formRombelId);
      const rNama = rObj?.nama || formRombelId;

      const payload: Omit<JadwalPelajaran, 'id'> = {
        hari: formHari,
        jamMulai: formJamMulai,
        jamSelesai: formJamSelesai,
        jamKe: formJamKe,
        rombelId: formRombelId,
        rombelNama: rNama,
        mapel: formMapel,
        guruId: user.uid,
        guruNama: user.displayName,
        ruangan: formRuangan,
        keterangan: formKeterangan,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'jadwal'), payload);
      setShowAddJadwal(false);
      setFormKeterangan('');
      alert(`Jadwal pelajaran ${formMapel} (${formHari}, ${formJamMulai}-${formJamSelesai}) berhasil disimpan ke koleksi 'jadwal'!`);
    } catch (err) {
      console.error('Error adding schedule:', err);
      alert('Gagal menyimpan jadwal pelajaran. Silakan periksa koneksi.');
    }
  };

  const handleDeleteJadwal = async (id: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus item jadwal pelajaran ini?')) {
      try {
        await deleteDoc(doc(db, 'jadwal', id));
      } catch (err) {
        console.error('Error deleting schedule:', err);
        alert('Gagal menghapus jadwal.');
      }
    }
  };

  const currentSiswa = siswaList.filter(s => s.rombelId === selectedRombel || s.rombelNama?.includes('1A'));

  return (
    <div className="space-y-6">

      {!onlineStatus && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Mode Akses Luring (Offline): Koneksi terputus. Roster siswa tersimpan tetap dapat diakses ({currentSiswa.length} siswa).</span>
          </div>
          <span className="bg-amber-500/20 px-2 py-0.5 rounded-md font-mono text-[10px] text-amber-700 dark:text-amber-300">SW Active</span>
        </div>
      )}

      {/* Rombel & Mapel Switcher Bar (for Jurnal & Nilai tabs) */}
      {activeTab !== 'mapel-jadwal' && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <label className="font-bold text-slate-700">Mata Pelajaran:</label>
            <select
              value={selectedMapel}
              onChange={(e) => setSelectedMapel(e.target.value)}
              className="px-3 py-1.5 border rounded-xl font-bold text-emerald-700 bg-emerald-50"
            >
              <option value="PJOK">PJOK (Pendidikan Jasmani)</option>
              <option value="Pendidikan Agama Islam">Pendidikan Agama Islam</option>
              <option value="Bahasa Inggris">Bahasa Inggris</option>
              <option value="Seni Budaya">Seni Budaya</option>
            </select>

            <label className="font-bold text-slate-700 ml-2">Pilih Rombel / Kelas:</label>
            <select
              value={selectedRombel}
              onChange={(e) => setSelectedRombel(e.target.value)}
              className="px-3 py-1.5 border rounded-xl font-semibold"
            >
              {rombelList.map(r => (
                <option key={r.id} value={r.id}>{r.nama}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* TAB 1: JURNAL & PRESENSI MAPEL KHUSUS */}
      {activeTab === 'mapel-jurnal' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              Jurnal & Presensi KBM Mapel Khusus ({selectedMapel})
            </h2>
            <button
              onClick={() => setShowAddJurnal(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Input Jurnal Mapel
            </button>
          </div>

          <div className="space-y-3">
            {jurnalList.filter(j => j.mapel === selectedMapel).map(j => (
              <div key={j.id} className="p-3 bg-slate-50 rounded-xl border text-xs">
                <p className="font-bold text-slate-800">{j.mapel} - {j.rombelId} ({j.tanggal})</p>
                <p className="text-slate-600 mt-1"><span className="font-semibold">Materi:</span> {j.materi}</p>
              </div>
            ))}
          </div>

          {showAddJurnal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
              <form onSubmit={handleAddJurnal} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">Jurnal KBM {selectedMapel}</h3>
                <textarea
                  required
                  value={materi}
                  onChange={(e) => setMateri(e.target.value)}
                  placeholder="Tuliskan materi KBM yang diajarkan..."
                  className="w-full p-3 border rounded-xl text-xs h-24"
                />
                <div className="flex justify-end gap-2 border-t pt-2 text-xs">
                  <button type="button" onClick={() => setShowAddJurnal(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl">Batal</button>
                  <button type="submit" className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl">Simpan</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INPUT NILAI MAPEL KHUSUS */}
      {activeTab === 'mapel-nilai' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2 border-b pb-3">
            <GraduationCap className="w-5 h-5 text-emerald-600" />
            Input Nilai Harian / PTS ({selectedMapel})
          </h2>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                <th className="p-3">Nama Siswa</th>
                <th className="p-3">NISN</th>
                <th className="p-3">Nilai PTS ({selectedMapel})</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentSiswa.map((s) => {
                const pen = penilaianList.find(p => p.siswaId === s.id && p.mapel === selectedMapel);
                return (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{s.nama}</td>
                    <td className="p-3 font-mono">{s.nisn}</td>
                    <td className="p-3">
                      <input
                        type="number"
                        defaultValue={pen?.nilaiPTS || 85}
                        id={`mapel-pts-${s.id}`}
                        className="w-20 px-2 py-1 border rounded-lg font-bold text-center bg-emerald-50 text-emerald-800"
                      />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => {
                          const pts = Number((document.getElementById(`mapel-pts-${s.id}`) as HTMLInputElement)?.value || 85);
                          handleSaveMapelGrade(s.id, pts);
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto"
                      >
                        <Save className="w-3.5 h-3.5" /> Simpan
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: JADWAL PELAJARAN MINGGUAN (FIRESTORE KOLEKSI 'jadwal') */}
      {activeTab === 'mapel-jadwal' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                      Jadwal Pelajaran Mingguan
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Pengelolaan jadwal mengajar berdasarkan Hari & Jam (Tersimpan otomatis di Firestore koleksi <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 font-mono text-[11px]">'jadwal'</code>)
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Collection 'jadwal' Active ({jadwalList.length})
                </span>

                <button
                  onClick={() => setShowAddJadwal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" /> Tambah Jadwal Pelajaran
                </button>
              </div>
            </div>

            {/* Filter Hari */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
              <span className="font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                <Filter className="w-3.5 h-3.5" /> Filter Hari:
              </span>
              <button
                onClick={() => setFilterHari('SEMUA')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  filterHari === 'SEMUA'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                Semua Hari
              </button>
              {HARI_LIST.map(h => (
                <button
                  key={h}
                  onClick={() => setFilterHari(h)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    filterHari === h
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Jadwal berdasarkan Hari */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {HARI_LIST.filter(h => filterHari === 'SEMUA' || filterHari === h).map(hari => {
              const schedulesForDay = jadwalList
                .filter(j => j.hari === hari)
                .sort((a, b) => (a.jamMulai || '').localeCompare(b.jamMulai || ''));

              return (
                <div key={hari} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden flex flex-col">
                  {/* Card Header for Day */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">{hari}</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      {schedulesForDay.length} Sesi
                    </span>
                  </div>

                  {/* Body Schedule Items */}
                  <div className="p-4 space-y-3 flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    {schedulesForDay.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <p className="text-xs text-slate-400 font-medium">Belum ada jadwal untuk hari {hari}</p>
                      </div>
                    ) : (
                      schedulesForDay.map(j => (
                        <div key={j.id} className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 shadow-2xs hover:shadow-xs transition-all space-y-2 relative group">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                {j.mapel}
                              </span>
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white mt-1">
                                {j.rombelNama || j.rombelId}
                              </h4>
                            </div>

                            <button
                              onClick={() => handleDeleteJadwal(j.id)}
                              className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                              title="Hapus Jadwal"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-1.5 font-medium">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" />
                              <span>{j.jamMulai} - {j.jamSelesai}</span>
                            </div>
                            {j.jamKe && (
                              <div className="flex items-center gap-1.5 font-medium">
                                <Tag className="w-3.5 h-3.5 text-amber-500" />
                                <span>{j.jamKe}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/80 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[120px]">{j.ruangan || 'Ruang Kelas'}</span>
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[110px]">
                              {j.guruNama || 'Guru Mapel'}
                            </span>
                          </div>

                          {j.keterangan && (
                            <p className="text-[11px] italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800">
                              "{j.keterangan}"
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Form Tambah Jadwal Pelajaran */}
          {showAddJadwal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <form onSubmit={handleAddJadwal} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">
                      Tambah Jadwal Pelajaran (Firestore 'jadwal')
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddJadwal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Hari Pelaksanaan</label>
                    <select
                      value={formHari}
                      onChange={(e) => setFormHari(e.target.value as any)}
                      className="w-full p-2.5 border rounded-xl font-bold bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                    >
                      {HARI_LIST.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Pilih Rombel / Kelas</label>
                    <select
                      value={formRombelId}
                      onChange={(e) => setFormRombelId(e.target.value)}
                      className="w-full p-2.5 border rounded-xl font-bold bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                    >
                      {rombelList.map(r => (
                        <option key={r.id} value={r.id}>{r.nama}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Mata Pelajaran</label>
                    <input
                      type="text"
                      required
                      value={formMapel}
                      onChange={(e) => setFormMapel(e.target.value)}
                      className="w-full p-2.5 border rounded-xl font-bold bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="e.g. PJOK / Agama / B. Inggris"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Jam Ke- (Slot)</label>
                    <input
                      type="text"
                      value={formJamKe}
                      onChange={(e) => setFormJamKe(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="e.g. Jam 1 - 2"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Jam Mulai</label>
                    <input
                      type="time"
                      required
                      value={formJamMulai}
                      onChange={(e) => setFormJamMulai(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Jam Selesai</label>
                    <input
                      type="time"
                      required
                      value={formJamSelesai}
                      onChange={(e) => setFormJamSelesai(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ruangan / Tempat</label>
                    <input
                      type="text"
                      value={formRuangan}
                      onChange={(e) => setFormRuangan(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="e.g. Lapangan Olahraga / R. Kelas 1A / Lab Komputer"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Catatan / Keterangan (Opsional)</label>
                    <textarea
                      value={formKeterangan}
                      onChange={(e) => setFormKeterangan(e.target.value)}
                      className="w-full p-2.5 border rounded-xl bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-xs h-16"
                      placeholder="Catatan seperti materi praktek luar kelas, perlengkapan, dsb."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowAddJadwal(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/20"
                  >
                    Simpan ke Koleksi 'jadwal'
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
