import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Siswa, Absensi, JurnalKBM, Penilaian, InventarisRombel, UKSScreening, UserProfile, AppSettings, JadwalPiket, AcademicCalendarEvent } from '../../types';
import { BarcodeScannerModal } from '../BarcodeScannerModal';
import { sendFonnteWA } from '../../services/fonnteService';
import { downloadElementAsPDF, printElement } from '../../services/pdfService';
import { getDriveAccessToken, uploadToGoogleDrive } from '../../services/driveExportService';
import { cacheStudentRoster, getCachedStudentRoster, subscribeOnlineStatus, isOnline as checkIsOnline } from '../../services/offlineStorage';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  Line
} from 'recharts';
import {
  QrCode,
  BookOpen,
  GraduationCap,
  Package,
  HeartPulse,
  Award,
  CheckCircle2,
  Send,
  Printer,
  Plus,
  AlertTriangle,
  UserCheck,
  WifiOff,
  Calendar,
  Sparkles,
  Trash2,
  UserPlus,
  Bell,
  Search,
  Save,
  Check
} from 'lucide-react';


interface GuruKelasViewsProps {
  activeTab: string;
  user: UserProfile;
  settings: AppSettings;
}

export const GuruKelasViews: React.FC<GuruKelasViewsProps> = ({ activeTab, user, settings }) => {
  const activeRombel = user.rombelBinaan || 'Kelas 1A';

  // Online status state
  const [onlineStatus, setOnlineStatus] = useState<boolean>(checkIsOnline());

  // State
  const [siswaRombel, setSiswaRombel] = useState<Siswa[]>(() => getCachedStudentRoster());
  const [absensiToday, setAbsensiToday] = useState<Absensi[]>([]);
  const [jurnalList, setJurnalList] = useState<JurnalKBM[]>([]);
  const [penilaianList, setPenilaianList] = useState<Penilaian[]>([]);
  const [inventarisList, setInventarisList] = useState<InventarisRombel[]>([]);
  const [uksScreeningList, setUksScreeningList] = useState<UKSScreening[]>([]);
  const [piketList, setPiketList] = useState<JadwalPiket[]>([]);
  const [kalenderEvents, setKalenderEvents] = useState<AcademicCalendarEvent[]>([]);
  const [isSendingPiketWA, setIsSendingPiketWA] = useState(false);

  // Subscribe online status
  useEffect(() => {
    const unsubStatus = subscribeOnlineStatus((isOnline) => setOnlineStatus(isOnline));
    return () => unsubStatus();
  }, []);

  // Barcode Scanner Modal State
  const [showScanner, setShowScanner] = useState(false);
  const [scanResultNotice, setScanResultNotice] = useState<string | null>(null);

  // Quick Daily Attendance States
  const [absensiTanggal, setAbsensiTanggal] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [studentStatusMap, setStudentStatusMap] = useState<Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'>>({});
  const [searchAbsensiQuery, setSearchAbsensiQuery] = useState('');
  const [isSavingAbsensiBatch, setIsSavingAbsensiBatch] = useState(false);
  const [absensiSaveNotice, setAbsensiSaveNotice] = useState<string | null>(null);

  // Sync initial studentStatusMap when siswaRombel, absensiToday, or absensiTanggal changes
  useEffect(() => {
    const map: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
    siswaRombel.forEach(s => {
      const existing = absensiToday.find(a => a.siswaId === s.id && a.tanggal === absensiTanggal);
      if (existing && ['HADIR', 'SAKIT', 'IZIN', 'ALPA'].includes(existing.status)) {
        map[s.id] = existing.status as 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA';
      } else {
        map[s.id] = 'HADIR'; // Default to HADIR for speed
      }
    });
    setStudentStatusMap(map);
  }, [siswaRombel, absensiToday, absensiTanggal]);

  // Handle Mark All Hadir
  const handleMarkAllHadir = () => {
    const updated: Record<string, 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA'> = {};
    siswaRombel.forEach(s => {
      updated[s.id] = 'HADIR';
    });
    setStudentStatusMap(updated);
    setAbsensiSaveNotice('Semua siswa berhasil ditandai HADIR. Klik "Simpan Presensi Harian" untuk menyimpan ke Firestore.');
  };

  // Handle Save All Attendance to Firestore
  const handleSaveBatchAbsensi = async () => {
    setIsSavingAbsensiBatch(true);
    setAbsensiSaveNotice(null);
    let savedCount = 0;
    const timeNowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    try {
      for (const s of siswaRombel) {
        const st = studentStatusMap[s.id] || 'HADIR';
        const absId = `ABS-${s.id}-${absensiTanggal}`;
        const existingRec = absensiToday.find(a => a.siswaId === s.id && a.tanggal === absensiTanggal);

        const absRecord: Absensi = {
          id: absId,
          siswaId: s.id,
          namaSiswa: s.nama,
          rombelId: s.rombelId || activeRombel,
          tanggal: absensiTanggal,
          waktuMasuk: st === 'HADIR' ? (existingRec?.waktuMasuk || timeNowStr) : '-',
          status: st,
          waNotified: existingRec?.waNotified || false
        };

        await setDoc(doc(db, 'absensi', absId), absRecord);
        savedCount++;
      }

      setAbsensiSaveNotice(`✅ Presensi harian tanggal ${absensiTanggal} untuk ${savedCount} siswa berhasil disimpan ke koleksi 'absensi' di Firestore!`);
    } catch (err: any) {
      console.error("Batch save error:", err);
      setAbsensiSaveNotice(`❌ Gagal menyimpan presensi: ${err.message}`);
    } finally {
      setIsSavingAbsensiBatch(false);
    }
  };

  // New Jurnal Form
  const [showAddJurnalModal, setShowAddJurnalModal] = useState(false);
  const [newJurnal, setNewJurnal] = useState<Partial<JurnalKBM>>({
    mapel: 'Tematik Bahasa Indonesia', jamKe: '1 - 3', materi: 'Mengenal Huruf Vokal dan Konsonan', catatanBKB: ''
  });

  // Selected Student for Rapor PTS PDF
  const [selectedRaporSiswa, setSelectedRaporSiswa] = useState<Siswa | null>(null);
  const [isExportingDrive, setIsExportingDrive] = useState(false);

  // Google Drive Export for Rapor PTS
  const handleExportRaporToDrive = async (s: Siswa) => {
    setIsExportingDrive(true);
    try {
      const token = await getDriveAccessToken();
      const content = `
RAPOR PENILAIAN TENGAH SEMESTER (PTS) GANJIL 2025/2026
------------------------------------------------------
Sekolah: ${settings.schoolName}
Alamat: ${settings.schoolAddress}

Nama Siswa: ${s.nama}
NISN / NIS: ${s.nisn} / ${s.nis}
Kelas: ${s.rombelNama}

DAFTAR NILAI CAPAIAN PEMBELAJARAN:
1. Bahasa Indonesia: 88 - ${getAutoCPDescription(88)}
2. Matematika: 82 - ${getAutoCPDescription(82)}
3. Pendidikan Agama Islam: 90 - ${getAutoCPDescription(90)}
4. PJOK: 85 - ${getAutoCPDescription(85)}

Catatan Wali Kelas:
Ananda ${s.nama} menunjukkan disiplin yang baik, rajin membaca di perpustakaan, dan aktif dalam kegiatan kelas.

Wali Kelas: ${user.displayName}
Orang Tua / Wali: ${s.namaOrtu || '-'}
      `.trim();

      const fileName = `Rapor_PTS_${s.nisn}_${s.nama.replace(/\s+/g, '_')}.txt`;
      const res = await uploadToGoogleDrive(token, fileName, 'text/plain', content, 'Laporan Rapor PTS SD');
      if (res.success) {
        alert(`✅ Rapor PTS berhasil diekspor ke Google Drive Sekolah!\nLink: ${res.webViewLink}`);
        if (res.webViewLink) window.open(res.webViewLink, '_blank');
      } else {
        alert(`❌ Gagal mengekspor: ${res.error}`);
      }
    } catch (err: any) {
      alert(`❌ Google Drive Export Error: ${err.message}`);
    } finally {
      setIsExportingDrive(false);
    }
  };

  // Subscribe Real-time
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const unsubSiswa = onSnapshot(collection(db, 'siswa'), snap => {
      const list: Siswa[] = [];
      snap.forEach(d => {
        const s = { ...d.data(), id: d.id } as Siswa;
        if (s.rombelNama === activeRombel || s.rombelId.includes('1a')) {
          list.push(s);
        }
      });
      if (list.length > 0) {
        setSiswaRombel(list);
        cacheStudentRoster(list);
      }
    }, (err) => {
      console.warn('Firestore offline fallback for siswa:', err);
      const cached = getCachedStudentRoster();
      if (cached.length > 0) setSiswaRombel(cached);
    });

    const unsubAbs = onSnapshot(collection(db, 'absensi'), snap => {
      const list: Absensi[] = [];
      snap.forEach(d => {
        const a = { ...d.data(), id: d.id } as Absensi;
        if (a.tanggal === todayStr) list.push(a);
      });
      setAbsensiToday(list);
    }, err => console.warn('Absensi listener error:', err));

    const unsubJur = onSnapshot(collection(db, 'jurnalKBM'), snap => {
      const list: JurnalKBM[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as JurnalKBM));
      setJurnalList(list);
    }, err => console.warn('JurnalKBM listener error:', err));

    const unsubNil = onSnapshot(collection(db, 'penilaian'), snap => {
      const list: Penilaian[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Penilaian));
      setPenilaianList(list);
    }, err => console.warn('Penilaian listener error:', err));

    const unsubInv = onSnapshot(collection(db, 'inventarisRombel'), snap => {
      const list: InventarisRombel[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as InventarisRombel));
      setInventarisList(list);
    }, err => console.warn('InventarisRombel listener error:', err));

    const unsubUks = onSnapshot(collection(db, 'uksScreening'), snap => {
      const list: UKSScreening[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as UKSScreening));
      setUksScreeningList(list);
    }, err => console.warn('UksScreening listener error:', err));

    const unsubPiket = onSnapshot(collection(db, 'jadwalPiket'), snap => {
      const list: JadwalPiket[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as JadwalPiket));
      setPiketList(list);
    }, err => console.warn('JadwalPiket listener error:', err));

    const unsubKalender = onSnapshot(collection(db, 'kalenderAkademik'), snap => {
      const list: AcademicCalendarEvent[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as AcademicCalendarEvent));
      setKalenderEvents(list);
    }, err => console.warn('KalenderAkademik listener error:', err));

    return () => {
      unsubSiswa(); unsubAbs(); unsubJur();
      unsubNil(); unsubInv(); unsubUks(); unsubPiket(); unsubKalender();
    };

  }, [activeRombel]);

  // Handle Camera Barcode Attendance Scan Success
  const handleBarcodeScanSuccess = async (decodedCode: string) => {
    // Find student by NISN or NIS or ID
    const student = siswaRombel.find(s => s.nisn === decodedCode || s.nis === decodedCode || s.id === decodedCode);
    if (!student) {
      setScanResultNotice(`❌ Siswa dengan Barcode/NISN "${decodedCode}" tidak ditemukan di ${activeRombel}`);
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const timeNowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const absId = `ABS-${student.id}-${todayStr}`;
    const absRecord: Absensi = {
      id: absId,
      siswaId: student.id,
      namaSiswa: student.nama,
      rombelId: student.rombelId,
      tanggal: todayStr,
      waktuMasuk: timeNowStr,
      status: 'HADIR',
      waNotified: true
    };

    // Save attendance in Firestore
    await setDoc(doc(db, 'absensi', absId), absRecord);

    // AUTO-TRIGGER WA FONNTE TO PARENT!
    const waMsg = `Yth. Bpk/Ibu ${student.namaOrtu},\n\nPemberitahuan Absensi ${settings.schoolName}:\nAnanda *${student.nama}* telah TIBA di sekolah pada jam *${timeNowStr}* WIB (Status: HADIR).\n\nTerima kasih.`;

    if (student.noWaOrtu) {
      await sendFonnteWA({
        target: student.noWaOrtu,
        message: waMsg,
        token: settings.fonnteToken
      });
    }

    setScanResultNotice(`✅ BARCODE TERSCAN: ${student.nama} (HADIR jam ${timeNowStr}). WA Otomatis terkirim ke Ortu!`);
  };

  // Rule-based Auto Generate CP Description
  const getAutoCPDescription = (score: number) => {
    if (score >= 85) return "Menunjukkan penguasaan yang SANGAT BAIK dalam memahami materi capaian pembelajaran.";
    if (score >= 70) return "Menunjukkan penguasaan yang BAIK dalam materi capaian pembelajaran.";
    return "PERLU BIMBINGAN lebih lanjut untuk mencapai kriteria ketuntasan minimal.";
  };

  // Handle Save Grade
  const handleSaveGrade = async (siswaId: string, mapel: string, formatifVal: number, sumatifVal: number, ptsVal: number) => {
    const cpDesc = getAutoCPDescription(ptsVal);
    const penId = `NIL-${siswaId}-${mapel.replace(/\s+/g, '')}`;
    const payload: Penilaian = {
      id: penId,
      siswaId,
      rombelId: activeRombel,
      mapel,
      semester: '1',
      nilaiFormatif: [formatifVal],
      nilaiSumatif: sumatifVal,
      nilaiPTS: ptsVal,
      deskripsiCP: cpDesc,
      catatanWali: 'Menunjukkan perkembangan minat belajar yang positif.',
      ekskul: 'Pramuka (A - Sangat Baik)'
    };
    await setDoc(doc(db, 'penilaian', penId), payload);
    alert("Nilai & Auto-Deskripsi CP Berhasil Disimpan!");
  };

  // Handle Add Jurnal
  const handleAddJurnal = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: JurnalKBM = {
      id: `JUR-${Date.now()}`,
      guruId: user.uid,
      guruNama: user.displayName,
      rombelId: activeRombel,
      mapel: newJurnal.mapel || 'Tematik',
      tanggal: new Date().toISOString().split('T')[0],
      jamKe: newJurnal.jamKe || '1 - 3',
      materi: newJurnal.materi || '',
      catatanBKB: newJurnal.catatanBKB || ''
    };
    await addDoc(collection(db, 'jurnalKBM'), payload);
    setShowAddJurnalModal(false);
    alert("Jurnal KBM & Catatan BKB Berhasil Disimpan!");
  };

  // Handle Assign Student to Piket Day
  const handleAssignPiketStudent = async (hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu', siswaId: string) => {
    if (!siswaId) return;
    const sFound = siswaRombel.find(s => s.id === siswaId);
    if (!sFound) return;

    const piketDocId = `${activeRombel}_${hari}`;
    const existing = piketList.find(p => p.hari === hari && p.rombelId === activeRombel);

    const currentIds = existing?.siswaIds || [];
    const currentNames = existing?.siswaNames || [];

    if (currentIds.includes(siswaId)) {
      alert(`Siswa ${sFound.nama} sudah ada di jadwal piket hari ${hari}`);
      return;
    }

    const updatedIds = [...currentIds, siswaId];
    const updatedNames = [...currentNames, sFound.nama];

    await setDoc(doc(db, 'jadwalPiket', piketDocId), {
      rombelId: activeRombel,
      hari,
      siswaIds: updatedIds,
      siswaNames: updatedNames
    }, { merge: true });
  };

  // Handle Remove Student from Piket Day
  const handleRemovePiketStudent = async (hari: string, siswaId: string) => {
    const piketDocId = `${activeRombel}_${hari}`;
    const existing = piketList.find(p => p.hari === hari && p.rombelId === activeRombel);
    if (!existing) return;

    const idx = existing.siswaIds.indexOf(siswaId);
    if (idx === -1) return;

    const updatedIds = [...existing.siswaIds];
    const updatedNames = [...existing.siswaNames];
    updatedIds.splice(idx, 1);
    updatedNames.splice(idx, 1);

    await setDoc(doc(db, 'jadwalPiket', piketDocId), {
      rombelId: activeRombel,
      hari,
      siswaIds: updatedIds,
      siswaNames: updatedNames
    }, { merge: true });
  };

  // Handle Send WA Notification H-1 to Piket Team
  const handleSendWAAlertPiket = async (piketItem: JadwalPiket) => {
    if (!piketItem.siswaIds || piketItem.siswaIds.length === 0) {
      alert("Belum ada siswa yang ditugaskan pada piket hari ini!");
      return;
    }

    setIsSendingPiketWA(true);
    let sentCount = 0;

    for (const sId of piketItem.siswaIds) {
      const student = siswaRombel.find(s => s.id === sId);
      if (student && student.noHpOrtu) {
        const msg = `📌 *PEMBERITAHUAN JADWAL PIKET KELAS H-1*\n\nYth. Orang Tua dari *${student.nama}* (${student.rombelNama}),\n\nDiberitahukan bahwa ananda *${student.nama}* memiliki jadwal *PIKET KEBERSIHAN KELAS* untuk hari *${piketItem.hari}*.\n\nPetugas Piket Hari ${piketItem.hari}: ${piketItem.siswaNames.join(', ')}.\n\nMohon bantu diingatkan agar ananda datang 15 menit lebih awal untuk menjaga kebersihan kelas. Terima kasih!\n\n_Wali Kelas: ${user.displayName}_`;
        await sendFonnteWA({ target: student.noHpOrtu, message: msg, token: settings.fonnteToken });
        sentCount++;
      }
    }

    setIsSendingPiketWA(false);
    alert(`✅ Notifikasi WA Pengingat Piket Hari ${piketItem.hari} berhasil dikirim ke ${sentCount} orang tua siswa!`);
  };


  return (
    <div className="space-y-6">

      {!onlineStatus && (
        <div className="bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-3.5 rounded-2xl flex items-center justify-between text-xs font-semibold shadow-xs">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span>Mode Akses Luring (Offline): Koneksi terputus. Anda tetap dapat melihat daftar siswa & data roster tersimpan ({siswaRombel.length} siswa).</span>
          </div>
          <span className="bg-amber-500/20 px-2 py-0.5 rounded-md font-mono text-[10px] text-amber-700 dark:text-amber-300">SW Active</span>
        </div>
      )}

      {/* KALENDER AKADEMIK & AGENDAS SYNC BANNER UNTUK GURU */}
      {kalenderEvents.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-800/50 space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-400/30">
                <Calendar className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  Pengingat Kalender Akademik Sekolah (Sinkronisasi Admin)
                </h3>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                  Agenda penting sekolah untuk panduan pelaksanaan KBM, Penilaian, dan Kegiatan Kelas.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-1 bg-indigo-800/60 border border-indigo-600/40 rounded-lg text-indigo-200">
              {kalenderEvents.length} Agenda Tersimpan
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
            {kalenderEvents
              .sort((a, b) => new Date(a.tanggalMulai).getTime() - new Date(b.tanggalMulai).getTime())
              .slice(0, 3)
              .map(ev => {
                const getBadge = (kat: string) => {
                  switch (kat) {
                    case 'LIBUR': return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                    case 'PTS': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                    case 'PAS': return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
                    case 'RAPOR': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
                    default: return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
                  }
                };

                return (
                  <div key={ev.id} className="p-3 bg-indigo-900/40 border border-indigo-700/50 rounded-xl flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 font-bold text-[9px] rounded-md border uppercase tracking-wide ${getBadge(ev.kategori)}`}>
                          {ev.kategori}
                        </span>
                        <span className="text-[10px] font-mono text-indigo-300">{ev.tanggalMulai}</span>
                      </div>
                      <p className="font-bold text-xs text-white leading-snug">{ev.judul}</p>
                    </div>
                    {ev.keterangan && (
                      <p className="text-[10px] text-indigo-200 line-clamp-1 italic">{ev.keterangan}</p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB: PENCATATAN ABSENSI HARIAN SISWA CEPAT & CAMERA SCANNER */}
      {(activeTab === 'guru-absensi-cepat' || activeTab === 'guru-scan') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 space-y-6 transition-colors">
          {/* Header & Sub-Navigation */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Pencatatan Absensi Harian Siswa Cepat ({activeRombel})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Tandai status kehadiran siswa (Hadir, Sakit, Izin, Alpa) dan simpan hasilnya secara instan ke koleksi 'absensi' di Firestore.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowScanner(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <QrCode className="w-4 h-4 text-amber-300" />
                Buka Kamera Scan Barcode
              </button>
            </div>
          </div>

          {/* Quick Attendance Control Toolbar */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Picker & Quick Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Tanggal Presensi:
                  </label>
                  <input
                    type="date"
                    value={absensiTanggal}
                    onChange={(e) => setAbsensiTanggal(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>

                <div className="self-end">
                  <button
                    onClick={handleMarkAllHadir}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Tandai Semua HADIR
                  </button>
                </div>
              </div>

              {/* Search Bar & Save Button */}
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchAbsensiQuery}
                    onChange={(e) => setSearchAbsensiQuery(e.target.value)}
                    placeholder="Cari nama atau NISN..."
                    className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  {searchAbsensiQuery && (
                    <button
                      onClick={() => setSearchAbsensiQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  onClick={handleSaveBatchAbsensi}
                  disabled={isSavingAbsensiBatch}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {isSavingAbsensiBatch ? 'Menyimpan...' : 'Simpan Presensi Harian'}
                </button>
              </div>
            </div>

            {/* Attendance Status Counter Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/80 text-xs font-semibold">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>Hadir</span>
                <span className="font-mono font-bold text-sm bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                  {Object.values(studentStatusMap).filter(v => v === 'HADIR').length}
                </span>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 rounded-xl text-blue-800 dark:text-blue-300 flex items-center justify-between">
                <span>Sakit</span>
                <span className="font-mono font-bold text-sm bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-md">
                  {Object.values(studentStatusMap).filter(v => v === 'SAKIT').length}
                </span>
              </div>
              <div className="p-2.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 rounded-xl text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span>Izin</span>
                <span className="font-mono font-bold text-sm bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md">
                  {Object.values(studentStatusMap).filter(v => v === 'IZIN').length}
                </span>
              </div>
              <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-800 dark:text-rose-300 flex items-center justify-between">
                <span>Alpa</span>
                <span className="font-mono font-bold text-sm bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-md">
                  {Object.values(studentStatusMap).filter(v => v === 'ALPA').length}
                </span>
              </div>
              <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 flex items-center justify-between col-span-2 sm:col-span-1">
                <span>Total Siswa</span>
                <span className="font-mono font-bold text-sm bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                  {siswaRombel.length}
                </span>
              </div>
            </div>
          </div>

          {absensiSaveNotice && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
              absensiSaveNotice.startsWith('❌')
                ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-800'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{absensiSaveNotice}</span>
              </div>
              <button onClick={() => setAbsensiSaveNotice(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">✕</button>
            </div>
          )}

          {scanResultNotice && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{scanResultNotice}</span>
            </div>
          )}

          {/* Table list for quick status marking */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3 w-12 text-center">No</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">NISN / NIS</th>
                  <th className="p-3 text-center">Pilih Status Presensi Harian</th>
                  <th className="p-3 text-right">Status Tersimpan (Firestore)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {siswaRombel
                  .filter(s => {
                    if (!searchAbsensiQuery.trim()) return true;
                    const q = searchAbsensiQuery.toLowerCase().trim();
                    return (
                      s.nama.toLowerCase().includes(q) ||
                      (s.nisn && s.nisn.includes(q)) ||
                      (s.nis && s.nis.includes(q))
                    );
                  })
                  .map((s, idx) => {
                    const currentStatus = studentStatusMap[s.id] || 'HADIR';
                    const dbAbs = absensiToday.find(a => a.siswaId === s.id && a.tanggal === absensiTanggal);

                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 text-center text-slate-500 dark:text-slate-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                          {s.nama}
                          {s.gender && (
                            <span className="ml-2 text-[10px] font-normal text-slate-400">
                              ({s.gender})
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-slate-600 dark:text-slate-300">{s.nisn || s.nis || '-'}</td>
                        <td className="p-3">
                          {/* 4 Interactive Radio Status Pills */}
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={() => setStudentStatusMap(prev => ({ ...prev, [s.id]: 'HADIR' }))}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border ${
                                currentStatus === 'HADIR'
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100'
                              }`}
                            >
                              {currentStatus === 'HADIR' && <Check className="w-3.5 h-3.5" />}
                              Hadir
                            </button>

                            <button
                              type="button"
                              onClick={() => setStudentStatusMap(prev => ({ ...prev, [s.id]: 'SAKIT' }))}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border ${
                                currentStatus === 'SAKIT'
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                  : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50 hover:bg-blue-100'
                              }`}
                            >
                              {currentStatus === 'SAKIT' && <Check className="w-3.5 h-3.5" />}
                              Sakit
                            </button>

                            <button
                              type="button"
                              onClick={() => setStudentStatusMap(prev => ({ ...prev, [s.id]: 'IZIN' }))}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border ${
                                currentStatus === 'IZIN'
                                  ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                                  : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100'
                              }`}
                            >
                              {currentStatus === 'IZIN' && <Check className="w-3.5 h-3.5" />}
                              Izin
                            </button>

                            <button
                              type="button"
                              onClick={() => setStudentStatusMap(prev => ({ ...prev, [s.id]: 'ALPA' }))}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 border ${
                                currentStatus === 'ALPA'
                                  ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                  : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50 hover:bg-rose-100'
                              }`}
                            >
                              {currentStatus === 'ALPA' && <Check className="w-3.5 h-3.5" />}
                              Alpa
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          {dbAbs ? (
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                              dbAbs.status === 'HADIR' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300' :
                              dbAbs.status === 'SAKIT' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' :
                              dbAbs.status === 'IZIN' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300' :
                              'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300'
                            }`}>
                              {dbAbs.status} ({dbAbs.waktuMasuk || 'Tercatat'})
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                              Belum disimpan
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <BarcodeScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onScanSuccess={handleBarcodeScanSuccess}
            title="Scan Barcode ID Absensi Siswa"
          />
        </div>
      )}

      {/* TAB 2: JURNAL KBM & CATATAN BKB */}
      {activeTab === 'guru-jurnal' && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                Jurnal KBM & Catatan BKB / Perilaku Siswa
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Isi jurnal harian materi KBM dan catatan bimbingan konseling/perilaku siswa {activeRombel}.
              </p>
            </div>
            <button
              onClick={() => setShowAddJurnalModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Input Jurnal KBM
            </button>
          </div>

          <div className="space-y-3">
            {jurnalList.map((j) => (
              <div key={j.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-sm">{j.mapel} (Jam ke {j.jamKe})</span>
                  <span className="font-mono text-slate-500">{j.tanggal}</span>
                </div>
                <p className="text-slate-700 font-medium"><span className="text-slate-400">Materi:</span> {j.materi}</p>
                {j.catatanBKB && (
                  <div className="p-2.5 bg-amber-50 text-amber-900 rounded-xl border border-amber-200">
                    <span className="font-bold">Catatan BKB / Perilaku:</span> {j.catatanBKB}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Modal Add Jurnal */}
          {showAddJurnalModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
              <form onSubmit={handleAddJurnal} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">Input Jurnal KBM & Catatan BKB</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Mata Pelajaran</label>
                    <input
                      type="text"
                      value={newJurnal.mapel}
                      onChange={(e) => setNewJurnal({ ...newJurnal, mapel: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Materi Pembelajaran *</label>
                    <textarea
                      required
                      value={newJurnal.materi}
                      onChange={(e) => setNewJurnal({ ...newJurnal, materi: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl h-20"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Catatan BKB / Perilaku Siswa (Opsional)</label>
                    <input
                      type="text"
                      value={newJurnal.catatanBKB}
                      onChange={(e) => setNewJurnal({ ...newJurnal, catatanBKB: e.target.value })}
                      placeholder="misal: Ananda Bagas sangat aktif membantu teman"
                      className="w-full px-3 py-2 border rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-2">
                  <button type="button" onClick={() => setShowAddJurnalModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs">
                    Batal
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs">
                    Simpan Jurnal
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MODUL PENILAIAN LENGKAP & AUTO CP */}
      {activeTab === 'guru-penilaian' && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                Modul Penilaian (Formatif, Sumatif, PTS) & Auto-CP
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Aturan Sistem: Deskripsi Capaian Pembelajaran (CP) digenerate otomatis berdasarkan threshold nilai PTS.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => printElement('report-nilai-pdf', `Cetak_Laporan_Nilai_${activeRombel.replace(/\s+/g, '_')}`)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4 text-amber-300" /> Cetak ke Printer (Fisik)
              </button>
              <button
                onClick={() => downloadElementAsPDF('report-nilai-pdf', `Laporan_Rekap_Nilai_${activeRombel.replace(/\s+/g, '_')}.pdf`)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4 text-amber-400" /> Download PDF Laporan
              </button>
            </div>
          </div>

          {/* Visualisasi Grafik Tren Nilai Siswa (Recharts) */}
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wide">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Grafik Perbandingan Tren Nilai Kelas (Formatif vs Sumatif vs PTS)
              </h3>
              <span className="text-[11px] font-semibold text-slate-500">Rombel: {activeRombel}</span>
            </div>
            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={siswaRombel.slice(0, 10).map(s => {
                    const pen = penilaianList.find(p => p.siswaId === s.id);
                    return {
                      nama: s.nama.split(' ')[0],
                      Formatif: pen?.nilaiFormatif[0] || 80,
                      Sumatif: pen?.nilaiSumatif || 82,
                      PTS: pen?.nilaiPTS || 88,
                    };
                  })}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nama" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Formatif" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Sumatif" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="PTS" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>


          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Mapel</th>
                  <th className="p-3">Nilai Formatif</th>
                  <th className="p-3">Nilai Sumatif</th>
                  <th className="p-3">Nilai PTS</th>
                  <th className="p-3">Auto Deskripsi Capaian (CP)</th>
                  <th className="p-3 text-right">Simpan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaRombel.map((s) => {
                  const pen = penilaianList.find(p => p.siswaId === s.id);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{s.nama}</td>
                      <td className="p-3 font-medium">Tematik / Bahasa Ind.</td>
                      <td className="p-3">
                        <input
                          type="number"
                          defaultValue={pen?.nilaiFormatif[0] || 80}
                          id={`fmt-${s.id}`}
                          className="w-16 px-2 py-1 border rounded-lg text-center"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          defaultValue={pen?.nilaiSumatif || 82}
                          id={`smt-${s.id}`}
                          className="w-16 px-2 py-1 border rounded-lg text-center"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          defaultValue={pen?.nilaiPTS || 88}
                          id={`pts-${s.id}`}
                          className="w-16 px-2 py-1 border rounded-lg font-bold text-emerald-700 bg-emerald-50 text-center"
                        />
                      </td>
                      <td className="p-3 text-[11px] text-slate-600 italic">
                        {pen?.deskripsiCP || getAutoCPDescription(88)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            const fmt = Number((document.getElementById(`fmt-${s.id}`) as HTMLInputElement)?.value || 80);
                            const smt = Number((document.getElementById(`smt-${s.id}`) as HTMLInputElement)?.value || 82);
                            const pts = Number((document.getElementById(`pts-${s.id}`) as HTMLInputElement)?.value || 88);
                            handleSaveGrade(s.id, 'Tematik', fmt, smt, pts);
                          }}
                          className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
                        >
                          Simpan
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB JADWAL PIKET KELAS & WA REMINDER */}
      {activeTab === 'guru-piket' && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Modul Jadwal Piket Kebersihan Kelas & Notifikasi WA H-1 ({activeRombel})
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Atur petugas piket kebersihan harian dan kirimkan pengingat pesan WhatsApp otomatis via Fonnte H-1 kepada orang tua siswa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const).map((hari) => {
              const piketItem = piketList.find(p => p.hari === hari && p.rombelId === activeRombel) || {
                hari,
                rombelId: activeRombel,
                siswaIds: [],
                siswaNames: []
              };

              return (
                <div key={hari} className="bg-slate-50 rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-extrabold text-sm text-indigo-950 uppercase tracking-wide">Hari {hari}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md">
                        {piketItem.siswaIds.length} Siswa
                      </span>
                    </div>

                    {/* Student List */}
                    <div className="space-y-1.5 min-h-[100px]">
                      {piketItem.siswaIds.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center pt-6">Belum ada siswa ditugaskan</p>
                      ) : (
                        piketItem.siswaIds.map((sId, idx) => (
                          <div key={sId} className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
                            <span className="font-semibold text-slate-800">{idx + 1}. {piketItem.siswaNames[idx] || sId}</span>
                            <button
                              onClick={() => handleRemovePiketStudent(hari, sId)}
                              className="text-rose-500 hover:text-rose-700 p-1 rounded-md"
                              title="Hapus dari piket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add Student Dropdown */}
                    <div className="flex gap-2 pt-2">
                      <select
                        id={`select-piket-${hari}`}
                        className="flex-1 px-2.5 py-1.5 border rounded-xl text-xs bg-white"
                        defaultValue=""
                      >
                        <option value="">+ Pilih Siswa</option>
                        {siswaRombel.map(s => (
                          <option key={s.id} value={s.id}>{s.nama}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          const el = document.getElementById(`select-piket-${hari}`) as HTMLSelectElement;
                          if (el && el.value) {
                            handleAssignPiketStudent(hari, el.value);
                            el.value = "";
                          }
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-xs"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Send WA Button */}
                  <button
                    onClick={() => handleSendWAAlertPiket(piketItem)}
                    disabled={isSendingPiketWA || piketItem.siswaIds.length === 0}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
                  >
                    <Send className="w-3.5 h-3.5" /> Kirim Pengingat WA (Fonnte H-1)
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: INVENTARIS ROMBEL / KELAS */}

      {activeTab === 'guru-inventaris' && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-amber-600" />
              Kelola Inventaris Rombel ({activeRombel}) & Pengajuan Perbaikan
            </h2>
            <p className="text-xs text-slate-500 mt-1">Ceklis kondisi fisik barang sarpras kelas dan ajukan perbaikan barang rusak ke Admin/TU.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inventarisList.map((inv) => (
              <div key={inv.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800 text-sm">{inv.namaBarang}</span>
                  <span className="font-bold text-slate-600">Total: {inv.jumlah} Unit</span>
                </div>
                <div className="flex gap-4">
                  <span className="text-emerald-700 font-semibold">Baik: {inv.kondisiBaik}</span>
                  <span className="text-rose-600 font-semibold">Rusak: {inv.kondisiRusak}</span>
                </div>
                {inv.pengajuanPerbaikan && (
                  <p className="p-2 bg-rose-50 text-rose-800 rounded-xl border border-rose-200 text-[11px] font-semibold">
                    ⚠️ Pengajuan Perbaikan Diajukan ke TU: {inv.catatan || 'Perlu perbaikan segera'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: KESEHATAN & TUMBUH KEMBANG (REAL-TIME SYNC FROM UKS) */}
      {activeTab === 'guru-kesehatan' && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-rose-600" />
              Tab Kesehatan & Tumbuh Kembang Siswa (Auto-Sync Real-time UKS)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Data pemeriksaan fisik, IMT, gigi, mata, dan pendengaran di-update secara real-time dari hasil screening Petugas UKS.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Tinggi / Berat</th>
                  <th className="p-3">Kategori IMT</th>
                  <th className="p-3">Kondisi Gigi</th>
                  <th className="p-3">Mata</th>
                  <th className="p-3">Pendengaran</th>
                  <th className="p-3">Catatan Petugas UKS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaRombel.map((s) => {
                  const scr = uksScreeningList.find(x => x.siswaId === s.id);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{s.nama}</td>
                      <td className="p-3 font-mono">{scr ? `${scr.tinggiBadan} cm / ${scr.beratBadan} kg` : '-'}</td>
                      <td className="p-3">
                        {scr ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 font-bold rounded-md">
                            {scr.imtKategori} ({scr.imtSkor})
                          </span>
                        ) : (
                          <span className="text-slate-400">Belum Screening</span>
                        )}
                      </td>
                      <td className="p-3">{scr?.kondisiGigi || '-'}</td>
                      <td className="p-3">{scr?.kondisiMata || '-'}</td>
                      <td className="p-3">{scr?.kondisiPendengaran || '-'}</td>
                      <td className="p-3 italic text-slate-600">{scr?.catatanPetugas || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: KONSOLIDASI & AUTO-GENERATE RAPOR PTS 1 LEMBAR PDF */}
      {activeTab === 'guru-rapor' && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Konsolidasi Nilai & Cetak Rapor PTS 1 Lembar Per Siswa
            </h2>
            <p className="text-xs text-slate-500 mt-1">Cetak Rapor Penilaian Tengah Semester (PTS) Kurikulum Merdeka format 1 lembar PDF resmi.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {siswaRombel.map((s) => (
              <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{s.nama}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">NISN: {s.nisn}</p>
                  <p className="text-xs text-blue-600 font-medium mt-1">Rombel: {s.rombelNama}</p>
                </div>
                <button
                  onClick={() => setSelectedRaporSiswa(s)}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
                >
                  <Printer className="w-4 h-4" /> Pratinjau & Cetak Rapor
                </button>
              </div>
            ))}
          </div>

          {/* Modal Pratinjau Rapor PTS 1 Lembar */}
          {selectedRaporSiswa && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-3xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-slate-800">Pratinjau Rapor PTS 1 Lembar</h3>
                  <button onClick={() => setSelectedRaporSiswa(null)} className="text-slate-400">✕</button>
                </div>

                {/* Printable Rapor PDF Element */}
                <div id="rapor-pts-pdf" className="p-8 border border-slate-300 bg-white text-slate-900 font-serif leading-relaxed text-xs">
                  {/* Kop Rapor */}
                  <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                    <h2 className="font-bold text-sm uppercase tracking-wider">{settings.schoolName}</h2>
                    <p className="text-[10px] text-slate-600">{settings.schoolAddress}</p>
                    <p className="font-bold text-xs uppercase underline mt-2">RAPOR PENILAIAN TENGAH SEMESTER (PTS) GANJIL</p>
                    <p className="text-[10px] text-slate-700">Tahun Ajaran 2025/2026</p>
                  </div>

                  {/* Student Details */}
                  <table className="w-full mb-4 text-xs font-sans">
                    <tbody>
                      <tr>
                        <td className="w-28 py-0.5 font-semibold">Nama Siswa</td><td>: {selectedRaporSiswa.nama}</td>
                        <td className="w-28 py-0.5 font-semibold">Kelas / Rombel</td><td>: {selectedRaporSiswa.rombelNama}</td>
                      </tr>
                      <tr>
                        <td className="py-0.5 font-semibold">NISN / NIS</td><td className="font-mono">: {selectedRaporSiswa.nisn} / {selectedRaporSiswa.nis}</td>
                        <td className="py-0.5 font-semibold">Fase</td><td>: A / SD</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Grades Table */}
                  <table className="w-full border-collapse border border-slate-800 mb-4 text-xs">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-800 text-center">
                        <th className="border border-slate-800 p-2 w-10">No</th>
                        <th className="border border-slate-800 p-2 text-left">Mata Pelajaran</th>
                        <th className="border border-slate-800 p-2 w-20">Nilai PTS</th>
                        <th className="border border-slate-800 p-2 text-left">Capaian Pembelajaran (CP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-slate-800">
                        <td className="border border-slate-800 p-2 text-center font-mono">1</td>
                        <td className="border border-slate-800 p-2 font-semibold">Bahasa Indonesia</td>
                        <td className="border border-slate-800 p-2 text-center font-bold font-mono">88</td>
                        <td className="border border-slate-800 p-2 text-[11px]">{getAutoCPDescription(88)}</td>
                      </tr>
                      <tr className="border-b border-slate-800">
                        <td className="border border-slate-800 p-2 text-center font-mono">2</td>
                        <td className="border border-slate-800 p-2 font-semibold">Matematika</td>
                        <td className="border border-slate-800 p-2 text-center font-bold font-mono">82</td>
                        <td className="border border-slate-800 p-2 text-[11px]">{getAutoCPDescription(82)}</td>
                      </tr>
                      <tr className="border-b border-slate-800">
                        <td className="border border-slate-800 p-2 text-center font-mono">3</td>
                        <td className="border border-slate-800 p-2 font-semibold">Pendidikan Agama Islam</td>
                        <td className="border border-slate-800 p-2 text-center font-bold font-mono">90</td>
                        <td className="border border-slate-800 p-2 text-[11px]">{getAutoCPDescription(90)}</td>
                      </tr>
                      <tr className="border-b border-slate-800">
                        <td className="border border-slate-800 p-2 text-center font-mono">4</td>
                        <td className="border border-slate-800 p-2 font-semibold">PJOK</td>
                        <td className="border border-slate-800 p-2 text-center font-bold font-mono">85</td>
                        <td className="border border-slate-800 p-2 text-[11px]">{getAutoCPDescription(85)}</td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Notes & Signatures */}
                  <div className="p-3 border border-slate-800 rounded-md mb-6 font-sans">
                    <p className="font-bold text-xs">Catatan Wali Kelas:</p>
                    <p className="text-xs italic text-slate-700 mt-1">
                      Ananda {selectedRaporSiswa.nama} menunjukkan disiplin yang baik, rajin membaca di perpustakaan, dan aktif dalam kegiatan kelas. Tingkatkan terus semangat belajarnya.
                    </p>
                  </div>

                  <div className="flex justify-between pt-4 font-sans text-xs">
                    <div className="text-center w-48">
                      <p>Orang Tua / Wali,</p>
                      <p className="mt-12 font-bold underline">( {selectedRaporSiswa.namaOrtu || '............................'} )</p>
                    </div>
                    <div className="text-center w-48">
                      <p>Wali Kelas,</p>
                      <p className="mt-12 font-bold underline">{user.displayName}</p>
                      <p className="text-[10px]">NIP. 198204152009022001</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
                  <button
                    onClick={() => handleExportRaporToDrive(selectedRaporSiswa)}
                    disabled={isExportingDrive}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
                  >
                    <Send className="w-4 h-4" /> {isExportingDrive ? 'Mengunggah...' : 'Ekspor ke Google Drive'}
                  </button>
                  <button
                    onClick={() => printElement('rapor-pts-pdf', `Rapor_PTS_${selectedRaporSiswa.nama.replace(/\s+/g, '_')}`)}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
                  >
                    <Printer className="w-4 h-4 text-amber-300" /> Cetak ke Printer / PDF
                  </button>
                  <button
                    onClick={() => downloadElementAsPDF('rapor-pts-pdf', `Rapor_PTS_${selectedRaporSiswa.nisn}.pdf`)}
                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs"
                  >
                    <Printer className="w-4 h-4" /> Download File PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HIDDEN PRINT CONTAINER FOR REKAP NILAI KELAS PDF */}
      <div className="hidden">
        <div id="report-nilai-pdf" className="p-8 bg-white text-slate-900 font-serif text-xs leading-relaxed space-y-4">
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
              <h2 className="text-lg font-black uppercase text-emerald-900">{settings.schoolName}</h2>
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
            <h3 className="text-sm font-bold underline uppercase">LAPORAN REKAPITULASI PENILAIAN HASIL BELAJAR SISWA</h3>
            <p className="text-[11px] font-sans font-bold">Rombongan Belajar: {activeRombel} • Semester 1 Ganjil 2025/2026</p>
            <p className="text-[10px] font-sans text-slate-500">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          {/* Tabel Rekapitulasi Nilai Siswa */}
          <div className="space-y-1 font-sans">
            <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-center font-bold">
                  <th className="p-1.5 border-r w-8">No</th>
                  <th className="p-1.5 border-r text-left">Nama Siswa</th>
                  <th className="p-1.5 border-r w-16">NISN</th>
                  <th className="p-1.5 border-r w-16">Formatif</th>
                  <th className="p-1.5 border-r w-16">Sumatif</th>
                  <th className="p-1.5 border-r w-16">Nilai PTS</th>
                  <th className="p-1.5 text-left">Capaian Pembelajaran (CP)</th>
                </tr>
              </thead>
              <tbody>
                {siswaRombel.map((s, idx) => {
                  const pen = penilaianList.find(p => p.siswaId === s.id);
                  const ptsVal = pen?.nilaiPTS || 88;
                  return (
                    <tr key={s.id || idx} className="border-b border-slate-200">
                      <td className="p-1.5 border-r text-center">{idx + 1}</td>
                      <td className="p-1.5 border-r font-semibold">{s.nama}</td>
                      <td className="p-1.5 border-r text-center font-mono">{s.nisn}</td>
                      <td className="p-1.5 border-r text-center">{pen?.nilaiFormatif[0] || 80}</td>
                      <td className="p-1.5 border-r text-center">{pen?.nilaiSumatif || 82}</td>
                      <td className="p-1.5 border-r text-center font-bold text-emerald-800">{ptsVal}</td>
                      <td className="p-1.5 italic text-slate-700">{pen?.deskripsiCP || getAutoCPDescription(ptsVal)}</td>
                    </tr>
                  );
                })}
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
              <p className="font-bold">Wali Kelas {activeRombel}</p>
              <div className="h-16"></div>
              <p className="font-bold underline">{user.displayName}</p>
              <p className="text-[10px] text-slate-500">NIP. 198204152009022001</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

