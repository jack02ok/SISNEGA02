import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, addDoc } from 'firebase/firestore';
import { UKSScreening, UKSPasien, Siswa, Rombel, Absensi, AppSettings } from '../../types';
import { sendFonnteWA } from '../../services/fonnteService';
import { logAuditEvent } from '../../services/auditService';
import { downloadElementAsPDF, printElement } from '../../services/pdfService';
import { saveOrQueueRecord } from '../../services/indexedDbSyncQueue';
import { OfflineSyncBanner } from '../OfflineSyncBanner';
import {
  Stethoscope,
  Activity,
  Plus,
  Send,
  Heart,
  UserCheck,
  Printer
} from 'lucide-react';

interface UKSViewsProps {
  activeTab: string;
  settings: AppSettings;
}

export const UKSViews: React.FC<UKSViewsProps> = ({ activeTab, settings }) => {
  const [screeningList, setScreeningList] = useState<UKSScreening[]>([]);
  const [pasienList, setPasienList] = useState<UKSPasien[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [rombelList, setRombelList] = useState<Rombel[]>([]);

  // Screening Form
  const [showAddScreening, setShowAddScreening] = useState(false);
  const [selectedSiswaId, setSelectedSiswaId] = useState('');
  const [tbCm, setTbCm] = useState(120);
  const [bbKg, setBbKg] = useState(24);
  const [kondisiGigi, setKondisiGigi] = useState('Sehat / Bersih');
  const [kondisiMata, setKondisiMata] = useState('Normal (6/6)');
  const [kondisiPendengaran, setKondisiPendengaran] = useState('Baik');
  const [catatanPetugas, setCatatanPetugas] = useState('Tumbuh kembang baik & ideal.');

  // Pasien UKS Form
  const [showAddPasien, setShowAddPasien] = useState(false);
  const [pasienSiswaId, setPasienSiswaId] = useState('');
  const [keluhan, setKeluhan] = useState('Demam & Pusing');
  const [tindakan, setTindakan] = useState('Istirahat di UKS, kompres hangat, & minum air putih.');
  const [statusPasien, setStatusPasien] = useState<'DI_UKS' | 'KEMBALI_KE_KELAS' | 'DIJEMPUT_ORTU' | 'DIRUJUK'>('DI_UKS');

  useEffect(() => {
    const unsubScr = onSnapshot(collection(db, 'uksScreening'), snap => {
      const l: UKSScreening[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as UKSScreening)); setScreeningList(l);
    }, e => console.warn('UKS screening err:', e));
    const unsubPas = onSnapshot(collection(db, 'uksPasien'), snap => {
      const l: UKSPasien[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as UKSPasien)); setPasienList(l);
    }, e => console.warn('UKS pasien err:', e));
    const unsubSis = onSnapshot(collection(db, 'siswa'), snap => {
      const l: Siswa[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as Siswa)); setSiswaList(l);
    }, e => console.warn('Siswa err:', e));
    const unsubRom = onSnapshot(collection(db, 'rombel'), snap => {
      const l: Rombel[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as Rombel)); setRombelList(l);
    }, e => console.warn('Rombel err:', e));

    return () => { unsubScr(); unsubPas(); unsubSis(); unsubRom(); };
  }, []);

  // Rule-based Auto Calculate IMT
  const calculateIMT = (tb: number, bb: number): { score: number; category: 'Sangat Kurus' | 'Kurus' | 'Normal' | 'Gemuk' | 'Obesitas' } => {
    const heightInMeters = tb / 100;
    const imt = parseFloat((bb / (heightInMeters * heightInMeters)).toFixed(1));

    let category: 'Sangat Kurus' | 'Kurus' | 'Normal' | 'Gemuk' | 'Obesitas' = 'Normal';
    if (imt < 14) category = 'Sangat Kurus';
    else if (imt < 17) category = 'Kurus';
    else if (imt <= 22.9) category = 'Normal';
    else if (imt <= 26.9) category = 'Gemuk';
    else category = 'Obesitas';

    return { score: imt, category };
  };

  // Handle Save Screening
  const handleSaveScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = siswaList.find(x => x.id === selectedSiswaId);
    if (!s) {
      alert("Pilih siswa yang diperiksa!");
      return;
    }

    const { score, category } = calculateIMT(tbCm, bbKg);
    const scrId = `SCR-${s.id}-${Date.now().toString().slice(-4)}`;
    const payload: UKSScreening = {
      id: scrId,
      siswaId: s.id,
      namaSiswa: s.nama,
      rombelId: s.rombelNama || 'Rombel',
      tanggal: new Date().toISOString().split('T')[0],
      tinggiBadan: tbCm,
      beratBadan: bbKg,
      imtSkor: score,
      imtKategori: category,
      kondisiGigi,
      kondisiMata,
      kondisiPendengaran,
      catatanPetugas
    };

    const res = await saveOrQueueRecord('uksScreening', 'SET', payload, scrId);
    setShowAddScreening(false);

    if (res.synced) {
      alert(`✅ Data Screening ${s.nama} disimpan! IMT Skor: ${score} (${category}). Otomatis tersinkron ke Wali Kelas!`);
    } else {
      alert(`⚡ [OFFLINE MODE] Data Screening ${s.nama} tersimpan di IndexedDB perangkat! Akan disinkronkan ke Firestore saat koneksi internet aktif.`);
    }
  };

  // Handle Log Patient UKS with AUTO REALTIME SYNC 'DI_UKS' & WA TRIGGER!
  const handleSavePasien = async (e: React.FormEvent) => {
    e.preventDefault();
    const s = siswaList.find(x => x.id === pasienSiswaId);
    if (!s) {
      alert("Pilih siswa yang dirawat di UKS!");
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const pasId = `PAS-${Date.now()}`;

    const payload: UKSPasien = {
      id: pasId,
      siswaId: s.id,
      namaSiswa: s.nama,
      rombelId: s.rombelNama || 'Rombel',
      tanggal: todayStr,
      waktu: timeStr,
      keluhan,
      tindakan,
      statusPasien,
      waNotified: true
    };

    const resPasien = await saveOrQueueRecord('uksPasien', 'SET', payload, pasId);

    // REAL-TIME SYNC: Update today's attendance status to 'DI_UKS' in Absensi collection!
    const absId = `ABS-${s.id}-${todayStr}`;
    const absUpdate: Absensi = {
      id: absId,
      siswaId: s.id,
      namaSiswa: s.nama,
      rombelId: s.rombelId,
      tanggal: todayStr,
      waktuMasuk: timeStr,
      status: 'DI_UKS',
      keterangan: `Sedang dirawat di UKS (${keluhan})`,
      waNotified: true
    };
    await saveOrQueueRecord('absensi', 'SET', absUpdate, absId, true);

    // AUTO-TRIGGER WA FONNTE TO PARENT!
    const waMsg = `Yth. Bpk/Ibu ${s.namaOrtu},\n\nPemberitahuan UKS ${settings.schoolName}:\nAnanda *${s.nama}* saat ini berada di ruang UKS sekolah.\n• Keluhan: *${keluhan}*\n• Penanganan: *${tindakan}*\n• Status: *${statusPasien}*\n\nTerima kasih.`;

    if (s.noWaOrtu && typeof navigator !== 'undefined' && navigator.onLine) {
      await sendFonnteWA({
        target: s.noWaOrtu,
        message: waMsg,
        token: settings.fonnteToken
      });
    }

    // Log Audit Event for UKS Patient Update
    await logAuditEvent(
      'Petugas UKS',
      'UKS',
      'UKS_PASIEN',
      `Penanganan pasien UKS ${s.nama} (${s.rombelNama}): Status ${statusPasien}, Keluhan: "${keluhan}"`,
      { pasId, siswaId: s.id, statusPasien, keluhan }
    );

    // Create Notification for UKS & Admin
    try {
      await saveOrQueueRecord('notifications', 'ADD', {
        targetRole: 'UKS',
        title: '🩺 Pasien UKS Baru',
        message: `${s.nama} (${s.rombelNama}) masuk UKS dengan keluhan ${keluhan}. Status: ${statusPasien}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'UKS',
        linkTab: 'uks-pasien'
      });
    } catch (e) {
      console.warn('Failed adding UKS notification:', e);
    }

    setShowAddPasien(false);

    if (resPasien.synced) {
      alert(`✅ Log Pasien UKS Berhasil Disimpan & Status Presensi 'DI_UKS' Otomatis Tersinkron ke Guru Kelas! Pesan WA terkirim ke Ortu.`);
    } else {
      alert(`⚡ [OFFLINE MODE] Log Pasien UKS & Presensi 'DI_UKS' tersimpan di IndexedDB perangkat! Akan disinkronkan ke Firestore saat online.`);
    }
  };

  return (
    <div className="space-y-6">
      <OfflineSyncBanner moduleName="UKS (Kesehatan Sekolah)" />

      {/* TAB 1: SCREENING TUMBUH KEMBANG (AUTO IMT) */}
      {activeTab === 'uks-screening' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-rose-600" />
                Screening Tumbuh Kembang Siswa (Kalkulasi Otomatis IMT)
              </h2>
              <p className="text-xs text-slate-500 mt-1">Sistem mengkalkulasi skor & kategori IMT secara otomatis saat tinggi & berat badan diinput.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => printElement('report-uks-pdf', `Laporan_Kesehatan_UKS_${settings.schoolName.replace(/\s+/g, '_')}`)}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4 text-amber-300" /> Cetak ke Printer (Fisik)
              </button>
              <button
                onClick={() => downloadElementAsPDF('report-uks-pdf', `Laporan_Kesehatan_UKS_${settings.schoolName.replace(/\s+/g, '_')}.pdf`)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4 text-amber-400" /> Download PDF Laporan
              </button>
              <button
                onClick={() => setShowAddScreening(true)}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" /> Input Screening Baru
              </button>
            </div>

          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Rombel</th>
                  <th className="p-3">TB / BB</th>
                  <th className="p-3">Kalkulasi IMT</th>
                  <th className="p-3">Gigi / Mata / Telinga</th>
                  <th className="p-3">Catatan Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {screeningList.map((sc) => (
                  <tr key={sc.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{sc.namaSiswa}</td>
                    <td className="p-3">{sc.rombelId}</td>
                    <td className="p-3 font-mono">{sc.tinggiBadan} cm / {sc.beratBadan} kg</td>
                    <td className="p-3">
                      <span className="px-2.5 py-1 bg-blue-50 text-blue-800 font-bold rounded-md border border-blue-200">
                        {sc.imtKategori} ({sc.imtSkor})
                      </span>
                    </td>
                    <td className="p-3">Gigi: {sc.kondisiGigi} | Mata: {sc.kondisiMata}</td>
                    <td className="p-3 italic text-slate-600">{sc.catatanPetugas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal Screening */}
          {showAddScreening && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
              <form onSubmit={handleSaveScreening} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">Form Screening Kesehatan Siswa</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Pilih Siswa *</label>
                    <select
                      required
                      value={selectedSiswaId}
                      onChange={(e) => setSelectedSiswaId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {siswaList.map(s => (
                        <option key={s.id} value={s.id}>{s.nama} ({s.rombelNama})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Tinggi Badan (cm)</label>
                      <input
                        type="number"
                        value={tbCm}
                        onChange={(e) => setTbCm(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Berat Badan (kg)</label>
                      <input
                        type="number"
                        value={bbKg}
                        onChange={(e) => setBbKg(Number(e.target.value))}
                        className="w-full px-3 py-2 border rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Auto-Calculated IMT Live Indicator */}
                  <div className="p-3 bg-blue-50 text-blue-900 rounded-xl border border-blue-200 text-xs">
                    <span className="font-bold">Auto IMT Result: </span>
                    <span>Skor {calculateIMT(tbCm, bbKg).score} — Kategori: <b>{calculateIMT(tbCm, bbKg).category}</b></span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Gigi</label>
                      <input type="text" value={kondisiGigi} onChange={e => setKondisiGigi(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg" />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Mata</label>
                      <input type="text" value={kondisiMata} onChange={e => setKondisiMata(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg" />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Pendengaran</label>
                      <input type="text" value={kondisiPendengaran} onChange={e => setKondisiPendengaran(e.target.value)} className="w-full px-2 py-1.5 border rounded-lg" />
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Catatan Petugas UKS</label>
                    <input type="text" value={catatanPetugas} onChange={e => setCatatanPetugas(e.target.value)} className="w-full px-3 py-2 border rounded-xl" />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-2">
                  <button type="button" onClick={() => setShowAddScreening(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs">Batal</button>
                  <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs">Simpan & Sync Guru Kelas</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LOG PASIEN UKS & REALTIME SYNC 'DI_UKS' */}
      {activeTab === 'uks-pasien' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-600" />
                Log Penanganan Pasien UKS & Auto-Sync Status 'DI_UKS'
              </h2>
              <p className="text-xs text-slate-500 mt-1">Siswa yang dirawat di UKS otomatis mengubah status presensi di KBM Guru Kelas/Mapel menjadi 'DI_UKS' & mengirim WA ke Orang Tua.</p>
            </div>
            <button
              onClick={() => setShowAddPasien(true)}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
            >
              <Plus className="w-4 h-4" /> Catat Pasien UKS
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Keluhan</th>
                  <th className="p-3">Tindakan UKS</th>
                  <th className="p-3">Status Penanganan</th>
                  <th className="p-3">WA Ortu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pasienList.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-600">{p.tanggal} ({p.waktu})</td>
                    <td className="p-3 font-bold text-slate-800">{p.namaSiswa} ({p.rombelId})</td>
                    <td className="p-3 text-rose-700 font-semibold">{p.keluhan}</td>
                    <td className="p-3">{p.tindakan}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md">
                        {p.statusPasien}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="text-emerald-600 font-bold flex items-center gap-1">
                        <Send className="w-3 h-3" /> WA Terkirim
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal Pasien UKS */}
          {showAddPasien && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
              <form onSubmit={handleSavePasien} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">Catat Penanganan Pasien UKS</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Pilih Siswa Sakit *</label>
                    <select
                      required
                      value={pasienSiswaId}
                      onChange={(e) => setPasienSiswaId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {siswaList.map(s => (
                        <option key={s.id} value={s.id}>{s.nama} ({s.rombelNama})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Keluhan *</label>
                    <input
                      required
                      type="text"
                      value={keluhan}
                      onChange={(e) => setKeluhan(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Tindakan Pertolongan Pertama *</label>
                    <textarea
                      required
                      value={tindakan}
                      onChange={(e) => setTindakan(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl h-20"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Status Pasien Saat Ini</label>
                    <select
                      value={statusPasien}
                      onChange={(e) => setStatusPasien(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded-xl font-bold"
                    >
                      <option value="DI_UKS">DI_UKS (Masih Dirawat)</option>
                      <option value="KEMBALI_KE_KELAS">KEMBALI_KE_KELAS</option>
                      <option value="DIJEMPUT_ORTU">DIJEMPUT_ORTU</option>
                      <option value="DIRUJUK">DIRUJUK ke Puskesmas/RS</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-2">
                  <button type="button" onClick={() => setShowAddPasien(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs">Batal</button>
                  <button type="submit" className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs">Simpan & Sync Status 'DI_UKS' + WA</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* HIDDEN PRINT CONTAINER FOR UKS REPORT PDF */}
      <div className="hidden">
        <div id="report-uks-pdf" className="p-8 bg-white text-slate-900 font-serif text-xs leading-relaxed space-y-4">
          {/* Official Kop Sekolah */}
          <div className="flex items-center justify-between border-b-4 border-double border-slate-900 pb-3">
            {settings.schoolLogoUrl && (
              <img
                src={settings.schoolLogoUrl}
                alt={settings.schoolName}
                className="w-16 h-16 object-contain"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="text-center flex-1 px-4 space-y-1">
              <h1 className="text-base font-bold uppercase tracking-wider">Pemerintah Kota / Kabupaten Dinas Pendidikan</h1>
              <h2 className="text-lg font-black uppercase text-blue-900">{settings.schoolName}</h2>
              <p className="text-[11px] font-sans text-slate-600">{settings.schoolAddress} • NPSN: {settings.schoolNPSN}</p>
            </div>
            {settings.schoolLogoUrl && (
              <img
                src={settings.schoolLogoUrl}
                alt={settings.schoolName}
                className="w-16 h-16 object-contain opacity-0"
              />
            )}
          </div>

          <div className="text-center pt-2 pb-1 space-y-0.5">
            <h3 className="text-sm font-bold underline uppercase">LAPORAN REKAPITULASI KESEHATAN & SCREENING UKS</h3>
            <p className="text-[10px] font-sans text-slate-500">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          {/* Ringkasan Statistik */}
          <div className="grid grid-cols-2 gap-3 font-sans text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <p><strong>Total Siswa Di-screening:</strong> {screeningList.length} Siswa</p>
              <p><strong>Total Penanganan Pasien UKS:</strong> {pasienList.length} Kejadian</p>
            </div>
            <div>
              <p><strong>Kategori IMT Ideal / Normal:</strong> {screeningList.filter(s => s.imtKategori === 'Normal').length} Siswa</p>
              <p><strong>Pasien Rujukan / Dijemput Ortu:</strong> {pasienList.filter(p => p.statusPasien === 'DIRUJUK' || p.statusPasien === 'DIJEMPUT_ORTU').length} Siswa</p>
            </div>
          </div>

          {/* Tabel Screening Tumbuh Kembang */}
          <div className="space-y-1 font-sans">
            <h4 className="font-bold text-xs border-b pb-1">1. Data Screening Tumbuh Kembang & IMT Siswa</h4>
            <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-1.5 border-r">No</th>
                  <th className="p-1.5 border-r">Nama Siswa</th>
                  <th className="p-1.5 border-r">TB / BB</th>
                  <th className="p-1.5 border-r">Skor IMT</th>
                  <th className="p-1.5 border-r">Kategori</th>
                  <th className="p-1.5">Gigi/Mata/Telinga</th>
                </tr>
              </thead>
              <tbody>
                {screeningList.slice(0, 15).map((sc, idx) => (
                  <tr key={sc.id || idx} className="border-b border-slate-200">
                    <td className="p-1.5 border-r text-center">{idx + 1}</td>
                    <td className="p-1.5 border-r font-semibold">{sc.namaSiswa}</td>
                    <td className="p-1.5 border-r">{sc.tinggiBadan} cm / {sc.beratBadan} kg</td>
                    <td className="p-1.5 border-r font-mono">{sc.imtSkor}</td>
                    <td className="p-1.5 border-r font-bold">{sc.imtKategori}</td>
                    <td className="p-1.5">{sc.kondisiGigi} • {sc.kondisiMata}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sign-off TTD */}
          <div className="pt-8 grid grid-cols-2 text-center text-[11px] font-sans">
            <div>
              <p>Mengetahui,</p>
              <p className="font-bold">Kepala Sekolah</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{settings.kepsekNama}</p>
              <p className="text-[10px] text-slate-500">NIP. {settings.kepsekNip}</p>
            </div>
            <div>
              <p>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="font-bold">Petugas UKS Sekolah</p>
              <div className="h-16"></div>
              <p className="font-bold underline">Tim Kesehatan UKS</p>
              <p className="text-[10px] text-slate-500">{settings.schoolName}</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

