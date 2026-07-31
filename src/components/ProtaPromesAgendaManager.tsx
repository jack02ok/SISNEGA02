import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import {
  UserProfile,
  AppSettings,
  Rombel,
  AcademicCalendarEvent,
  JadwalPelajaran,
  ProtaItem,
  PromesItem,
  AgendaHarianGuru,
  JurnalKBM,
  CapaianPembelajaran
} from '../types';
import { saveOrQueueRecord } from '../services/indexedDbSyncQueue';
import { printElement, downloadElementAsPDF } from '../services/pdfService';
import { OfflineSyncBanner } from './OfflineSyncBanner';
import {
  Calendar,
  BookOpen,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Save,
  CheckCircle2,
  Sparkles,
  Printer,
  Zap,
  AlertCircle,
  FileSpreadsheet,
  Check,
  MapPin,
  ListOrdered,
  ChevronRight,
  Filter,
  Layers,
  ArrowRight,
  Target,
  FileCheck
} from 'lucide-react';

interface ProtaPromesAgendaManagerProps {
  user: UserProfile;
  settings: AppSettings;
  role: 'GURU_KELAS' | 'GURU_MAPEL';
  rombelList: Rombel[];
  initialTab?: 'CAPAIAN_PEMBELAJARAN' | 'AGENDA_HARIAN' | 'PROTA' | 'PROMES' | 'JADWAL_KALENDER';
}

const BULAN_SEM_1 = ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const BULAN_SEM_2 = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];
const HARI_ARRAY = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export const ProtaPromesAgendaManager: React.FC<ProtaPromesAgendaManagerProps> = ({
  user,
  settings,
  role,
  rombelList,
  initialTab
}) => {
  // Navigation Sub-tabs
  const [subTab, setSubTab] = useState<'CAPAIAN_PEMBELAJARAN' | 'AGENDA_HARIAN' | 'PROTA' | 'PROMES' | 'JADWAL_KALENDER'>(
    initialTab || 'CAPAIAN_PEMBELAJARAN'
  );

  useEffect(() => {
    if (initialTab) {
      setSubTab(initialTab);
    }
  }, [initialTab]);

  // Common Selection Filters
  const [selectedRombelId, setSelectedRombelId] = useState<string>(
    role === 'GURU_KELAS' ? (user.rombelBinaan || rombelList[0]?.id || 'rombel-1a') : (rombelList[0]?.id || 'rombel-1a')
  );
  const [selectedMapel, setSelectedMapel] = useState<string>(
    role === 'GURU_MAPEL' ? (user.mapelBinaan?.[0] || 'PJOK') : 'Bahasa Indonesia'
  );
  const [selectedTahunAjaran, setSelectedTahunAjaran] = useState<string>('2025/2026');
  const [selectedSemester, setSelectedSemester] = useState<'1' | '2'>('1');

  // Firestore Realtime Collections
  const [kalenderEvents, setKalenderEvents] = useState<AcademicCalendarEvent[]>([]);
  const [jadwalList, setJadwalList] = useState<JadwalPelajaran[]>([]);
  const [protaList, setProtaList] = useState<ProtaItem[]>([]);
  const [promesList, setPromesList] = useState<PromesItem[]>([]);
  const [agendaList, setAgendaList] = useState<AgendaHarianGuru[]>([]);
  const [capaianList, setCapaianList] = useState<CapaianPembelajaran[]>([]);

  // Capaian Pembelajaran (CP) Form States
  const [showAddCP, setShowAddCP] = useState(false);
  const [formCPKode, setFormCPKode] = useState('');
  const [formCPFase, setFormCPFase] = useState('Fase A (Kelas 1-2)');
  const [formCPElemen, setFormCPElemen] = useState('Membaca & Memirsa');
  const [formCPDeskripsi, setFormCPDeskripsi] = useState('');
  const [formCPTPInput, setFormCPTPInput] = useState('');
  const [formCPTPList, setFormCPTPList] = useState<string[]>([]);
  const [editingCPId, setEditingCPId] = useState<string | null>(null);

  // Agenda Form States
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [showAddAgenda, setShowAddAgenda] = useState(false);
  const [formAgendaJamKe, setFormAgendaJamKe] = useState('Jam 1 - 2');
  const [formAgendaMateri, setFormAgendaMateri] = useState('');
  const [formAgendaTujuan, setFormAgendaTujuan] = useState('');
  const [formAgendaKegiatan, setFormAgendaKegiatan] = useState('Pendahuluan (10m) -> Inti/Diskusi (50m) -> Penutup (10m)');
  const [formAgendaPencapaian, setFormAgendaPencapaian] = useState('Tuntas 85% Siswa');
  const [formAgendaStatus, setFormAgendaStatus] = useState<'TERLAKSANA' | 'TERTUNDA' | 'LIBUR_AKADEMIK' | 'DIUBAH'>('TERLAKSANA');
  const [formAgendaCatatan, setFormAgendaCatatan] = useState('');
  const [selectedCPIdForAgenda, setSelectedCPIdForAgenda] = useState<string>('');

  // Prota Form States
  const [showAddProta, setShowAddProta] = useState(false);
  const [formProtaCP, setFormProtaCP] = useState('');
  const [formProtaTP, setFormProtaTP] = useState('');
  const [formProtaJP, setFormProtaJP] = useState<number>(12);
  const [formProtaBulan, setFormProtaBulan] = useState('Juli');
  const [selectedCPIdForProta, setSelectedCPIdForProta] = useState<string>('');

  // Promes Form States
  const [showAddPromes, setShowAddPromes] = useState(false);
  const [formPromesMateri, setFormPromesMateri] = useState('');
  const [formPromesTP, setFormPromesTP] = useState('');
  const [formPromesJP, setFormPromesJP] = useState<number>(8);
  const [formPromesDistribusi, setFormPromesDistribusi] = useState<Record<string, number>>({});
  const [selectedCPIdForPromes, setSelectedCPIdForPromes] = useState<string>('');

  // Listen to Firestore Collections
  useEffect(() => {
    // 1. Kalender Akademik
    const unsubKalender = onSnapshot(collection(db, 'kalender'), snap => {
      const l: AcademicCalendarEvent[] = [];
      snap.forEach(d => l.push({ ...d.data(), id: d.id } as AcademicCalendarEvent));
      setKalenderEvents(l);
    });

    // 2. Jadwal Pelajaran
    const unsubJadwal = onSnapshot(collection(db, 'jadwal'), snap => {
      const l: JadwalPelajaran[] = [];
      snap.forEach(d => l.push({ ...d.data(), id: d.id } as JadwalPelajaran));
      setJadwalList(l);
    });

    // 3. Prota
    const unsubProta = onSnapshot(collection(db, 'prota'), snap => {
      const l: ProtaItem[] = [];
      snap.forEach(d => l.push({ ...d.data(), id: d.id } as ProtaItem));
      setProtaList(l);
    });

    // 4. Promes
    const unsubPromes = onSnapshot(collection(db, 'promes'), snap => {
      const l: PromesItem[] = [];
      snap.forEach(d => l.push({ ...d.data(), id: d.id } as PromesItem));
      setPromesList(l);
    });

    // 5. Agenda Harian
    const unsubAgenda = onSnapshot(collection(db, 'agendaHarianGuru'), snap => {
      const l: AgendaHarianGuru[] = [];
      snap.forEach(d => l.push({ ...d.data(), id: d.id } as AgendaHarianGuru));
      setAgendaList(l);
    });

    // 6. Capaian Pembelajaran (CP)
    const unsubCP = onSnapshot(collection(db, 'capaianPembelajaran'), snap => {
      const l: CapaianPembelajaran[] = [];
      snap.forEach(d => l.push({ ...d.data(), id: d.id } as CapaianPembelajaran));
      setCapaianList(l);
    });

    return () => {
      unsubKalender();
      unsubJadwal();
      unsubProta();
      unsubPromes();
      unsubAgenda();
      unsubCP();
    };
  }, []);

  // Get Day Name from YYYY-MM-DD
  const getDayName = (dateStr: string): string => {
    const d = new Date(dateStr);
    return HARI_ARRAY[d.getDay()] || 'Senin';
  };

  // Find Calendar Event for Selected Date
  const getCalendarEventForDate = (dateStr: string): AcademicCalendarEvent | undefined => {
    return kalenderEvents.find(e => dateStr >= e.tanggalMulai && dateStr <= e.tanggalSelesai);
  };

  // Get Today's Schedule for Teacher / Class
  const dayNameSelected = getDayName(selectedDate);
  const todaysSchedule = jadwalList.filter(j => {
    const matchDay = j.hari === dayNameSelected;
    const matchRombel = j.rombelId === selectedRombelId || j.rombelNama === rombelList.find(r => r.id === selectedRombelId)?.nama;
    const matchMapel = role === 'GURU_MAPEL' ? j.mapel === selectedMapel : true;
    return matchDay && matchRombel && matchMapel;
  });

  // CAPAIAN PEMBELAJARAN (CP) HANDLERS
  const handleAddTPToList = () => {
    if (!formCPTPInput.trim()) return;
    setFormCPTPList(prev => [...prev, formCPTPInput.trim()]);
    setFormCPTPInput('');
  };

  const handleRemoveTPFromList = (index: number) => {
    setFormCPTPList(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveCP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCPElemen || !formCPDeskripsi) {
      alert('Isi Elemen CP dan Teks Deskripsi Capaian Pembelajaran!');
      return;
    }

    const cpId = editingCPId || `CP-${selectedMapel.replace(/\s+/g, '')}-${Date.now()}`;
    const generatedKode = formCPKode.trim() || `CP-${selectedMapel.substring(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`;

    const payload: CapaianPembelajaran = {
      id: cpId,
      kodeCP: generatedKode,
      fase: formCPFase,
      mapel: selectedMapel,
      elemen: formCPElemen,
      deskripsiCP: formCPDeskripsi,
      tujuanPembelajaranList: formCPTPList.length > 0 ? formCPTPList : ['Memahami materi ' + formCPElemen + ' sesuai kriteria ketercapaian'],
      tahunAjaran: selectedTahunAjaran,
      semester: selectedSemester,
      guruId: user.uid,
      guruNama: user.displayName,
      createdAt: new Date().toISOString()
    };

    const res = await saveOrQueueRecord('capaianPembelajaran', 'SET', payload, cpId);
    setShowAddCP(false);
    setEditingCPId(null);
    setFormCPKode('');
    setFormCPElemen('');
    setFormCPDeskripsi('');
    setFormCPTPList([]);
    setFormCPTPInput('');

    if (res.synced) {
      alert('✅ Capaian Pembelajaran (CP) & TP berhasil disimpan!');
    } else {
      alert('⚡ [OFFLINE MODE] CP disimpan secara lokal & akan otomatis disinkronkan saat online.');
    }
  };

  const handleDeleteCP = async (cpId: string) => {
    if (confirm('Apakah Anda yakin ingin menghapus Capaian Pembelajaran ini?')) {
      try {
        await deleteDoc(doc(db, 'capaianPembelajaran', cpId));
        alert('🗑️ Capaian Pembelajaran berhasil dihapus.');
      } catch (err) {
        console.error('Error deleting CP:', err);
        alert('Gagal menghapus CP.');
      }
    }
  };

  // Preset Auto-Generate Official Kurikulum Merdeka CPs
  const handleInsertPresetCP = async () => {
    const presetCPs: Array<Omit<CapaianPembelajaran, 'id'>> = [
      {
        kodeCP: `CP-${selectedMapel.substring(0, 3).toUpperCase()}-01`,
        fase: 'Fase A (Kelas 1-2)',
        mapel: selectedMapel,
        elemen: 'Membaca dan Memirsa',
        deskripsiCP: 'Peserta didik mampu memahami informasi dari bacaan dan tayangan yang dipirsa tentang diri dan lingkungan narasi sederhana.',
        tujuanPembelajaranList: [
          'Peserta didik mampu mengeja kata-kata baru dengan lancar',
          'Peserta didik mampu mengidentifikasi ide pokok cerita sederhana',
          'Peserta didik mampu menyebutkan tokoh dan latar dalam teks pendek'
        ],
        tahunAjaran: selectedTahunAjaran,
        semester: '1',
        guruId: user.uid,
        guruNama: user.displayName
      },
      {
        kodeCP: `CP-${selectedMapel.substring(0, 3).toUpperCase()}-02`,
        fase: 'Fase A (Kelas 1-2)',
        mapel: selectedMapel,
        elemen: 'Menulis dan Mengomunikasikan',
        deskripsiCP: 'Peserta didik mampu menyampaikan gagasan secara lisan dan tertulis dengan kosa kata baku dan santun.',
        tujuanPembelajaranList: [
          'Peserta didik mampu menyusun kalimat sederhana dengan ejaan yang tepat',
          'Peserta didik mampu menceritakan kembali pengalaman sehari-hari secara urut'
        ],
        tahunAjaran: selectedTahunAjaran,
        semester: '1',
        guruId: user.uid,
        guruNama: user.displayName
      },
      {
        kodeCP: `CP-${selectedMapel.substring(0, 3).toUpperCase()}-03`,
        fase: 'Fase B (Kelas 3-4)',
        mapel: selectedMapel,
        elemen: 'Penalaran dan Keterampilan Proses',
        deskripsiCP: 'Peserta didik dapat menganalisis pola, memecahkan masalah kontekstual, dan mempresentasikan hasil observasi.',
        tujuanPembelajaranList: [
          'Peserta didik mampu melakukan estimasi dan pengukuran dengan satuan baku',
          'Peserta didik mampu menyajikan data hasil pengamatan dalam bentuk tabel/grafik'
        ],
        tahunAjaran: selectedTahunAjaran,
        semester: '2',
        guruId: user.uid,
        guruNama: user.displayName
      }
    ];

    for (const cp of presetCPs) {
      const id = `CP-PRESET-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      await saveOrQueueRecord('capaianPembelajaran', 'SET', { ...cp, id }, id);
    }

    alert(`✨ 3 Preset Capaian Pembelajaran (CP) Kurikulum Merdeka untuk ${selectedMapel} berhasil dibuat!`);
  };

  // Sync CP to Prota
  const handleSyncCPToProta = async (cp: CapaianPembelajaran) => {
    const rombelObj = rombelList.find(r => r.id === selectedRombelId);
    const rombelNama = rombelObj?.nama || 'Kelas';

    for (let i = 0; i < cp.tujuanPembelajaranList.length; i++) {
      const tp = cp.tujuanPembelajaranList[i];
      const pId = `PROTA-SYNC-${cp.id}-${i}-${Date.now()}`;
      const payload: ProtaItem = {
        id: pId,
        cpId: cp.id,
        cpKode: cp.kodeCP,
        guruId: user.uid,
        guruNama: user.displayName,
        rombelId: selectedRombelId,
        rombelNama,
        mapel: cp.mapel,
        tahunAjaran: selectedTahunAjaran,
        semester: cp.semester === '2' ? '2' : '1',
        elementCP: cp.elemen,
        tujuanPembelajaran: tp,
        alokasiJP: 12,
        targetBulan: cp.semester === '2' ? 'Januari' : 'Juli'
      };
      await saveOrQueueRecord('prota', 'SET', payload, pId);
    }

    alert(`⚡ CP "${cp.kodeCP} - ${cp.elemen}" (${cp.tujuanPembelajaranList.length} TP) berhasil disinkronkan ke Prota!`);
  };

  // Sync All CPs for Selected Mapel to Prota
  const handleSyncAllCPsToProta = async () => {
    const relevantCPs = capaianList.filter(c => c.mapel === selectedMapel);
    if (relevantCPs.length === 0) {
      alert(`Belum ada CP untuk mata pelajaran ${selectedMapel}. Silakan buat CP terlebih dahulu atau klik Insert Preset CP!`);
      return;
    }

    let count = 0;
    for (const cp of relevantCPs) {
      await handleSyncCPToProta(cp);
      count++;
    }
    alert(`✅ Total ${count} Capaian Pembelajaran (CP) berhasil disinkronkan ke Prota!`);
  };

  // Sync Prota/CP to Promes
  const handleSyncProtaToPromes = async () => {
    const relevantProta = protaList.filter(
      p => p.rombelId === selectedRombelId && p.semester === selectedSemester && (p.mapel === selectedMapel || role === 'GURU_KELAS')
    );

    if (relevantProta.length === 0) {
      alert(`Belum ada Prota untuk Semester ${selectedSemester}. Tambahkan Prota terlebih dahulu!`);
      return;
    }

    const targetMonths = selectedSemester === '1' ? BULAN_SEM_1 : BULAN_SEM_2;
    let count = 0;

    for (const p of relevantProta) {
      const prId = `PROMES-SYNC-${p.id}-${Date.now()}`;
      const distrib: Record<string, number> = {};
      const jpPerWeek = 2;
      const totalWeeks = Math.ceil((p.alokasiJP || 8) / jpPerWeek);

      let allocated = 0;
      for (const month of targetMonths) {
        for (let w = 1; w <= 4; w++) {
          if (allocated < totalWeeks) {
            distrib[`${month}-W${w}`] = jpPerWeek;
            allocated++;
          }
        }
      }

      const payload: PromesItem = {
        id: prId,
        protaId: p.id,
        cpId: p.cpId,
        cpKode: p.cpKode,
        guruId: user.uid,
        rombelId: selectedRombelId,
        rombelNama: p.rombelNama,
        mapel: p.mapel,
        tahunAjaran: selectedTahunAjaran,
        semester: selectedSemester,
        materiPelajaran: `${p.elementCP}: ${p.tujuanPembelajaran}`,
        tujuanPembelajaran: p.tujuanPembelajaran,
        alokasiJP: p.alokasiJP,
        distribusiMinggu: distrib
      };

      await saveOrQueueRecord('promes', 'SET', payload, prId);
      count++;
    }

    alert(`✨ Berhasil meng-generate ${count} item Program Semester (Promes) berdasarkan Prota & CP!`);
  };

  // Auto-Generate Agenda Hari Ini from Schedule & Promes
  const handleAutoGenerateAgenda = async () => {
    const activeCalendarEvent = getCalendarEventForDate(selectedDate);
    const rombelObj = rombelList.find(r => r.id === selectedRombelId);
    const rombelNama = rombelObj?.nama || 'Kelas';

    if (activeCalendarEvent && activeCalendarEvent.kategori === 'LIBUR') {
      const agId = `AGD-${selectedDate}-${selectedRombelId}-LIBUR`;
      const agendaPayload: AgendaHarianGuru = {
        id: agId,
        guruId: user.uid,
        guruNama: user.displayName,
        rombelId: selectedRombelId,
        rombelNama,
        mapel: selectedMapel,
        tanggal: selectedDate,
        hari: dayNameSelected,
        jamKe: '1 - 4',
        materiPokok: `LIBUR: ${activeCalendarEvent.judul}`,
        tujuanPembelajaran: activeCalendarEvent.keterangan || 'Kegiatan Libur Akademik Sekolah',
        kegiatanPembelajaran: 'Tidak Ada Kegiatan Belajar Mengajar',
        status: 'LIBUR_AKADEMIK',
        catatanKendala: `Kalender Akademik: ${activeCalendarEvent.judul}`
      };
      await saveOrQueueRecord('agendaHarianGuru', 'SET', agendaPayload, agId);
      alert(`🗓️ Agenda Otomatis Dibuat: Hari Libur Akademik (${activeCalendarEvent.judul})`);
      return;
    }

    // Match Promes or Prota for material
    const relevantPromes = promesList.find(p => p.rombelId === selectedRombelId && p.mapel === selectedMapel);
    const defaultMateri = relevantPromes?.materiPelajaran || `Pembelajaran ${selectedMapel} Bab / Modul 1`;
    const defaultTujuan = relevantPromes?.tujuanPembelajaran || `Memahami konsep dasar ${selectedMapel}`;

    let createdCount = 0;
    if (todaysSchedule.length > 0) {
      for (const j of todaysSchedule) {
        const agId = `AGD-${selectedDate}-${selectedRombelId}-${j.id}`;
        const agendaPayload: AgendaHarianGuru = {
          id: agId,
          guruId: user.uid,
          guruNama: user.displayName,
          rombelId: selectedRombelId,
          rombelNama,
          mapel: j.mapel || selectedMapel,
          tanggal: selectedDate,
          hari: dayNameSelected,
          jamKe: j.jamKe || `${j.jamMulai} - ${j.jamSelesai}`,
          materiPokok: defaultMateri,
          tujuanPembelajaran: defaultTujuan,
          kegiatanPembelajaran: '1. Appersepsi & Doa\n2. Penyampaian Materi & Diskusi Kelompok\n3. Evaluasi & Refleksi Singkat',
          pencapaianSiswa: 'Tuntas 85% Siswa',
          status: 'TERLAKSANA',
          catatanKendala: '-'
        };
        await saveOrQueueRecord('agendaHarianGuru', 'SET', agendaPayload, agId);
        createdCount++;
      }
      alert(`⚡ Berhasil meng-generate ${createdCount} Agenda Harian berdasarkan Jadwal Hari ${dayNameSelected}!`);
    } else {
      // Manual draft generation if no specific schedule entry found
      const agId = `AGD-${selectedDate}-${selectedRombelId}-${Date.now()}`;
      const agendaPayload: AgendaHarianGuru = {
        id: agId,
        guruId: user.uid,
        guruNama: user.displayName,
        rombelId: selectedRombelId,
        rombelNama,
        mapel: selectedMapel,
        tanggal: selectedDate,
        hari: dayNameSelected,
        jamKe: 'Jam 1 - 2',
        materiPokok: defaultMateri,
        tujuanPembelajaran: defaultTujuan,
        kegiatanPembelajaran: '1. Appersepsi\n2. Diskusi & Latihan Soal\n3. Penutup',
        pencapaianSiswa: 'Tuntas 80% Siswa',
        status: 'TERLAKSANA'
      };
      await saveOrQueueRecord('agendaHarianGuru', 'SET', agendaPayload, agId);
      alert(`⚡ Draft Agenda Harian ${selectedMapel} untuk ${selectedDate} berhasil dibuat!`);
    }
  };

  // Add Manual Agenda Item
  const handleSaveAgendaManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAgendaMateri) {
      alert('Isi Materi Pokok terlebih dahulu!');
      return;
    }
    const rombelObj = rombelList.find(r => r.id === selectedRombelId);
    const rombelNama = rombelObj?.nama || 'Kelas';
    const agId = `AGD-${selectedDate}-${selectedRombelId}-${Date.now()}`;

    const agendaPayload: AgendaHarianGuru = {
      id: agId,
      cpId: selectedCPIdForAgenda || undefined,
      guruId: user.uid,
      guruNama: user.displayName,
      rombelId: selectedRombelId,
      rombelNama,
      mapel: selectedMapel,
      tanggal: selectedDate,
      hari: dayNameSelected,
      jamKe: formAgendaJamKe,
      materiPokok: formAgendaMateri,
      tujuanPembelajaran: formAgendaTujuan,
      kegiatanPembelajaran: formAgendaKegiatan,
      pencapaianSiswa: formAgendaPencapaian,
      status: formAgendaStatus,
      catatanKendala: formAgendaCatatan
    };

    const res = await saveOrQueueRecord('agendaHarianGuru', 'SET', agendaPayload, agId);
    setShowAddAgenda(false);
    setSelectedCPIdForAgenda('');
    setFormAgendaMateri('');
    setFormAgendaTujuan('');
    setFormAgendaCatatan('');

    if (res.synced) {
      alert('✅ Agenda Harian Guru berhasil disimpan ke Firestore!');
    } else {
      alert('⚡ [OFFLINE MODE] Agenda Harian disimpan di IndexedDB lokal & akan otomatis disinkronkan saat online.');
    }
  };

  // Sync Agenda to Jurnal KBM
  const handleSyncAgendaToJurnal = async (agenda: AgendaHarianGuru) => {
    const jId = `JUR-SYNC-${agenda.id}`;
    const jurnalPayload: JurnalKBM = {
      id: jId,
      guruId: agenda.guruId,
      guruNama: agenda.guruNama,
      rombelId: agenda.rombelNama,
      mapel: agenda.mapel,
      tanggal: agenda.tanggal,
      jamKe: agenda.jamKe,
      materi: `${agenda.materiPokok} (${agenda.tujuanPembelajaran || ''})`,
      catatanBKB: agenda.catatanKendala || 'Terlaksana sesuai agenda'
    };

    await saveOrQueueRecord('jurnalKBM', 'SET', jurnalPayload, jId);
    await saveOrQueueRecord('agendaHarianGuru', 'UPDATE', { syncedToJurnal: true }, agenda.id);

    alert(`✅ Agenda "${agenda.materiPokok}" berhasil disinkronkan ke Jurnal KBM Sekolah!`);
  };

  // Add Prota Item
  const handleAddProta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProtaCP || !formProtaTP) {
      alert('Lengkapi Elemen CP dan Tujuan Pembelajaran!');
      return;
    }
    const rombelObj = rombelList.find(r => r.id === selectedRombelId);
    const pId = `PROTA-${selectedRombelId}-${selectedMapel}-${Date.now()}`;

    const payload: ProtaItem = {
      id: pId,
      cpId: selectedCPIdForProta || undefined,
      guruId: user.uid,
      guruNama: user.displayName,
      rombelId: selectedRombelId,
      rombelNama: rombelObj?.nama || 'Kelas',
      mapel: selectedMapel,
      tahunAjaran: selectedTahunAjaran,
      semester: selectedSemester,
      elementCP: formProtaCP,
      tujuanPembelajaran: formProtaTP,
      alokasiJP: Number(formProtaJP) || 12,
      targetBulan: formProtaBulan
    };

    await saveOrQueueRecord('prota', 'SET', payload, pId);
    setShowAddProta(false);
    setSelectedCPIdForProta('');
    setFormProtaCP('');
    setFormProtaTP('');
    alert('✅ Program Tahunan (Prota) berhasil ditambahkan!');
  };

  // Insert Preset Prota Kurikulum Merdeka
  const handleInsertPresetProta = async () => {
    const rombelObj = rombelList.find(r => r.id === selectedRombelId);
    const rombelNama = rombelObj?.nama || 'Kelas';

    const presets: Array<Omit<ProtaItem, 'id'>> = [
      {
        guruId: user.uid,
        guruNama: user.displayName,
        rombelId: selectedRombelId,
        rombelNama,
        mapel: selectedMapel,
        tahunAjaran: selectedTahunAjaran,
        semester: '1',
        elementCP: 'Membaca dan Memirsa',
        tujuanPembelajaran: 'Memahami ide pokok dan gagasan pendukung dalam teks narasi sederhana',
        alokasiJP: 16,
        targetBulan: 'Juli'
      },
      {
        guruId: user.uid,
        guruNama: user.displayName,
        rombelId: selectedRombelId,
        rombelNama,
        mapel: selectedMapel,
        tahunAjaran: selectedTahunAjaran,
        semester: '1',
        elementCP: 'Menulis dan Mengedit',
        tujuanPembelajaran: 'Menulis teks deskripsi singkat tentang pengalaman sehari-hari dengan kausa kata baku',
        alokasiJP: 20,
        targetBulan: 'Agustus'
      },
      {
        guruId: user.uid,
        guruNama: user.displayName,
        rombelId: selectedRombelId,
        rombelNama,
        mapel: selectedMapel,
        tahunAjaran: selectedTahunAjaran,
        semester: '2',
        elementCP: 'Berbicara dan Mempresentasikan',
        tujuanPembelajaran: 'Mampu melakukan presentasi lisan singkat mengenai hasil pengamatan fenomena alam',
        alokasiJP: 18,
        targetBulan: 'Januari'
      }
    ];

    for (const item of presets) {
      const pId = `PROTA-PRESET-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      await saveOrQueueRecord('prota', 'SET', { ...item, id: pId }, pId);
    }

    alert('✨ Preset Prota Kurikulum Merdeka berhasil dibuat!');
  };

  // Add Promes Item
  const handleAddPromes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPromesMateri) {
      alert('Isi Materi Pelajaran terlebih dahulu!');
      return;
    }
    const rombelObj = rombelList.find(r => r.id === selectedRombelId);
    const prId = `PROMES-${selectedRombelId}-${selectedMapel}-${Date.now()}`;

    const payload: PromesItem = {
      id: prId,
      cpId: selectedCPIdForPromes || undefined,
      guruId: user.uid,
      rombelId: selectedRombelId,
      rombelNama: rombelObj?.nama || 'Kelas',
      mapel: selectedMapel,
      tahunAjaran: selectedTahunAjaran,
      semester: selectedSemester,
      materiPelajaran: formPromesMateri,
      tujuanPembelajaran: formPromesTP,
      alokasiJP: Number(formPromesJP) || 8,
      distribusiMinggu: formPromesDistribusi
    };

    await saveOrQueueRecord('promes', 'SET', payload, prId);
    setShowAddPromes(false);
    setSelectedCPIdForPromes('');
    setFormPromesMateri('');
    setFormPromesTP('');
    setFormPromesDistribusi({});
    alert('✅ Program Semester (Promes) berhasil disimpan!');
  };

  // Filtered Lists
  const filteredProta = protaList.filter(
    p => p.rombelId === selectedRombelId && (p.mapel === selectedMapel || role === 'GURU_KELAS')
  );
  const filteredPromes = promesList.filter(
    p => p.rombelId === selectedRombelId && p.semester === selectedSemester && (p.mapel === selectedMapel || role === 'GURU_KELAS')
  );
  const filteredAgenda = agendaList.filter(
    a => a.tanggal === selectedDate && (a.rombelId === selectedRombelId || a.rombelNama === rombelList.find(r => r.id === selectedRombelId)?.nama)
  );

  // Prota JP Calculations
  const totalProtaSem1 = filteredProta.filter(p => p.semester === '1' || p.semester === 'SEMUA').reduce((acc, curr) => acc + (curr.alokasiJP || 0), 0);
  const totalProtaSem2 = filteredProta.filter(p => p.semester === '2' || p.semester === 'SEMUA').reduce((acc, curr) => acc + (curr.alokasiJP || 0), 0);

  return (
    <div className="space-y-6">
      <OfflineSyncBanner moduleName="Perencanaan KBM & Agenda Harian" />

      {/* HEADER BAR WITH INTEGRATION CONTEXT */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/30 text-blue-200 border border-blue-400/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Integrasi Kurikulum Merdeka & KBM
              </span>
              <span className="px-3 py-1 bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 rounded-full text-[10px] font-bold uppercase tracking-wider">
                TH. {selectedTahunAjaran}
              </span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Calendar className="w-7 h-7 text-amber-400" />
              Prota, Promes & Agenda Harian Guru
            </h2>
            <p className="text-xs text-blue-200/90 max-w-2xl">
              Integrasi langsung <strong>Kalender Akademik Sekolah</strong> dan <strong>Jadwal Pelajaran</strong> menjadi Program Tahunan (Prota), Program Semester (Promes), hingga Agenda Harian KBM Real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => printElement('kbm-print-area')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs flex items-center gap-2 border border-white/20 backdrop-blur-md transition-all shadow-sm"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              Cetak Dokumen
            </button>
            <button
              onClick={() => downloadElementAsPDF('kbm-print-area', `Agenda_Prota_Promes_${selectedMapel}.pdf`)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* CONTROLS BAR: CLASS & SUBJECT SELECTOR */}
        <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-blue-200 uppercase mb-1">Rombel / Kelas</label>
            <select
              value={selectedRombelId}
              onChange={(e) => setSelectedRombelId(e.target.value)}
              className="w-full bg-slate-800/90 text-white text-xs font-bold rounded-xl p-2.5 border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            >
              {rombelList.map(r => (
                <option key={r.id} value={r.id}>{r.nama} ({r.tahunAjaran})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-blue-200 uppercase mb-1">Mata Pelajaran</label>
            <select
              value={selectedMapel}
              onChange={(e) => setSelectedMapel(e.target.value)}
              className="w-full bg-slate-800/90 text-white text-xs font-bold rounded-xl p-2.5 border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            >
              <option value="Bahasa Indonesia">Bahasa Indonesia</option>
              <option value="Matematika">Matematika</option>
              <option value="IPAS">IPAS (Science & Social)</option>
              <option value="Pancasila">Pendidikan Pancasila</option>
              <option value="PJOK">PJOK (Pendidikan Jasmani)</option>
              <option value="Pendidikan Agama Islam">Pendidikan Agama Islam</option>
              <option value="Seni Budaya & Prakarya">Seni Budaya & Prakarya</option>
              <option value="Bahasa Inggris">Bahasa Inggris</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-blue-200 uppercase mb-1">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value as '1' | '2')}
              className="w-full bg-slate-800/90 text-white text-xs font-bold rounded-xl p-2.5 border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            >
              <option value="1">Semester 1 (Ganjil)</option>
              <option value="2">Semester 2 (Genap)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-blue-200 uppercase mb-1">Tahun Ajaran</label>
            <select
              value={selectedTahunAjaran}
              onChange={(e) => setSelectedTahunAjaran(e.target.value)}
              className="w-full bg-slate-800/90 text-white text-xs font-bold rounded-xl p-2.5 border border-white/20 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
            >
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>
        </div>
      </div>

      {/* SUB NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSubTab('CAPAIAN_PEMBELAJARAN')}
          className={`px-5 py-3 font-bold text-xs rounded-t-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'CAPAIAN_PEMBELAJARAN'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Target className="w-4 h-4 text-amber-300" />
          1. Capaian Pembelajaran (CP)
        </button>

        <button
          onClick={() => setSubTab('PROTA')}
          className={`px-5 py-3 font-bold text-xs rounded-t-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'PROTA'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          2. Program Tahunan (Prota)
        </button>

        <button
          onClick={() => setSubTab('PROMES')}
          className={`px-5 py-3 font-bold text-xs rounded-t-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'PROMES'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          3. Program Semester (Promes)
        </button>

        <button
          onClick={() => setSubTab('AGENDA_HARIAN')}
          className={`px-5 py-3 font-bold text-xs rounded-t-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'AGENDA_HARIAN'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          4. Agenda Harian Guru
        </button>

        <button
          onClick={() => setSubTab('JADWAL_KALENDER')}
          className={`px-5 py-3 font-bold text-xs rounded-t-2xl transition-all flex items-center gap-2 whitespace-nowrap ${
            subTab === 'JADWAL_KALENDER'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          5. Integrasi Kalender & Jadwal
        </button>
      </div>

      {/* PRINT AREA CONTAINER */}
      <div id="kbm-print-area">

        {/* ==================================================================================== */}
        {/* SUBTAB 1: CAPAIAN PEMBELAJARAN (CP) MANAGER */}
        {/* ==================================================================================== */}
        {subTab === 'CAPAIAN_PEMBELAJARAN' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-500" />
                    Capaian Pembelajaran (CP) - {selectedMapel}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pusat integrasi Capaian Pembelajaran Kurikulum Merdeka yang mengalir langsung ke Prota, Promes, Agenda, dan Jurnal KBM.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleInsertPresetCP}
                    className="px-3.5 py-2 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800 hover:bg-purple-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Preset CP Merdeka
                  </button>

                  <button
                    onClick={handleSyncAllCPsToProta}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    Sync Semua CP ke Prota
                  </button>

                  <button
                    onClick={() => {
                      setEditingCPId(null);
                      setFormCPKode(`CP-${selectedMapel.substring(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 90)}`);
                      setFormCPElemen('Membaca dan Memirsa');
                      setFormCPDeskripsi('');
                      setFormCPTPList([]);
                      setShowAddCP(!showAddCP);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah CP Baru
                  </button>
                </div>
              </div>

              {/* FORM INPUT / EDIT CP */}
              {showAddCP && (
                <form onSubmit={handleSaveCP} className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-700 space-y-4 animate-fade-in shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                      <Target className="w-4 h-4" />
                      {editingCPId ? 'Edit Capaian Pembelajaran' : 'Form Tambah Capaian Pembelajaran (CP) Baru'}
                    </h4>
                    <span className="text-[10px] text-slate-400">Kurikulum Merdeka</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1 font-bold">Kode CP</label>
                      <input
                        type="text"
                        value={formCPKode}
                        onChange={(e) => setFormCPKode(e.target.value)}
                        placeholder="e.g. CP-IND-01"
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-amber-300 font-bold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1 font-bold">Fase Kurikulum</label>
                      <select
                        value={formCPFase}
                        onChange={(e) => setFormCPFase(e.target.value)}
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold"
                      >
                        <option value="Fase A (Kelas 1-2)">Fase A (Kelas 1-2)</option>
                        <option value="Fase B (Kelas 3-4)">Fase B (Kelas 3-4)</option>
                        <option value="Fase C (Kelas 5-6)">Fase C (Kelas 5-6)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1 font-bold">Elemen CP</label>
                      <input
                        type="text"
                        value={formCPElemen}
                        onChange={(e) => setFormCPElemen(e.target.value)}
                        placeholder="e.g. Membaca dan Memirsa"
                        className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1 font-bold">Deskripsi Narasi Capaian Pembelajaran (CP)</label>
                    <textarea
                      value={formCPDeskripsi}
                      onChange={(e) => setFormCPDeskripsi(e.target.value)}
                      rows={3}
                      placeholder="Tuliskan narasi lengkap capaian pembelajaran murid..."
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs"
                      required
                    />
                  </div>

                  {/* BUILDER LIST TUJUAN PEMBELAJARAN (TP) */}
                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <label className="block text-[11px] text-slate-300 font-bold">Rincian Tujuan Pembelajaran (TP) Turunan CP</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={formCPTPInput}
                        onChange={(e) => setFormCPTPInput(e.target.value)}
                        placeholder="Ketik Tujuan Pembelajaran (TP) lalu tekan Tambah..."
                        className="flex-1 p-2 bg-slate-800 border border-slate-700 rounded-xl text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTPToList();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddTPToList}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah TP
                      </button>
                    </div>

                    {formCPTPList.length > 0 && (
                      <ul className="space-y-1.5 pt-1">
                        {formCPTPList.map((tp, idx) => (
                          <li key={idx} className="flex items-center justify-between p-2 bg-slate-800/80 rounded-lg text-xs text-slate-200 border border-slate-700/60">
                            <span className="flex items-start gap-2">
                              <span className="font-mono text-amber-400 font-bold text-[10px] bg-amber-950/80 px-1.5 py-0.5 rounded">TP-{idx + 1}</span>
                              <span>{tp}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTPFromList(idx)}
                              className="text-rose-400 hover:text-rose-300 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCP(false);
                        setEditingCPId(null);
                      }}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-blue-600/30"
                    >
                      <Save className="w-4 h-4" />
                      Simpan CP & TP
                    </button>
                  </div>
                </form>
              )}

              {/* LIST CAPAIAN PEMBELAJARAN (CP) CARDS */}
              {(() => {
                const filteredCPs = capaianList.filter(c => c.mapel === selectedMapel);
                if (filteredCPs.length === 0) {
                  return (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                      <Target className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Belum ada Capaian Pembelajaran (CP) untuk mata pelajaran {selectedMapel}.</p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                        Klik tombol <strong>"Preset CP Merdeka"</strong> di atas untuk langsung meng-generate Capaian Pembelajaran resmi Kurikulum Merdeka!
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredCPs.map((cp) => (
                      <div key={cp.id} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 space-y-3.5 hover:shadow-md transition-all flex flex-col justify-between">
                        <div className="space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700/60 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-lg text-xs font-mono font-bold">
                                {cp.kodeCP}
                              </span>
                              <span className="px-2.5 py-0.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 rounded-lg text-[10px] font-bold">
                                {cp.fase}
                              </span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-800">
                              Elemen: {cp.elemen}
                            </span>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Narasi Deskripsi Capaian Pembelajaran:</p>
                            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800">
                              {cp.deskripsiCP}
                            </p>
                          </div>

                          <div>
                            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                              <ListOrdered className="w-3.5 h-3.5 text-blue-500" />
                              Tujuan Pembelajaran (TP) Turunan ({cp.tujuanPembelajaranList?.length || 0}):
                            </p>
                            <ul className="space-y-1 mt-1">
                              {cp.tujuanPembelajaranList?.map((tpItem, tIdx) => (
                                <li key={tIdx} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2 bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  <span>{tpItem}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleSyncCPToProta(cp)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-[11px] flex items-center gap-1 shadow-xs transition-all"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-300" />
                            Sync ke Prota
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingCPId(cp.id);
                                setFormCPKode(cp.kodeCP);
                                setFormCPFase(cp.fase);
                                setFormCPElemen(cp.elemen);
                                setFormCPDeskripsi(cp.deskripsiCP);
                                setFormCPTPList(cp.tujuanPembelajaranList || []);
                                setShowAddCP(true);
                              }}
                              className="px-2.5 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              Edit
                            </button>

                            <button
                              onClick={() => handleDeleteCP(cp.id)}
                              className="px-2.5 py-1.5 bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 font-bold rounded-lg text-[11px] flex items-center gap-1 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ==================================================================================== */}
        {/* SUBTAB 1: AGENDA HARIAN GURU */}
        {/* ==================================================================================== */}
        {subTab === 'AGENDA_HARIAN' && (
          <div className="space-y-6">

            {/* DATE & CALENDAR INTEGRATION CONTEXT CARD */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      Agenda KBM Tanggal: {selectedDate} ({dayNameSelected})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Kelas: <strong className="text-blue-600 dark:text-blue-400">{rombelList.find(r => r.id === selectedRombelId)?.nama}</strong> • Mapel: <strong>{selectedMapel}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold"
                  />

                  <button
                    onClick={handleAutoGenerateAgenda}
                    className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 transition-all"
                  >
                    <Zap className="w-4 h-4" />
                    Auto-Generate dari Jadwal & Promes
                  </button>

                  <button
                    onClick={() => setShowAddAgenda(!showAddAgenda)}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Input Manual Agenda
                  </button>
                </div>
              </div>

              {/* INTEGRATION ALERT: KALENDER AKADEMIK & JADWAL HARI INI */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                
                {/* Kalender Event Notification */}
                {(() => {
                  const calEv = getCalendarEventForDate(selectedDate);
                  if (calEv) {
                    return (
                      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 rounded text-[10px] font-bold uppercase">
                              Kalender Akademik: {calEv.kategori}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-amber-900 dark:text-amber-200 mt-1">
                            {calEv.judul}
                          </p>
                          <p className="text-[11px] text-amber-800 dark:text-amber-300">
                            {calEv.keterangan || 'Terdaftar dalam Kalender Akademik Sekolah.'}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                          Hari Efektif KBM Sekolah
                        </p>
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          Tidak ada agenda libur dalam Kalender Akademik. Siap laksanakan KBM.
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Jadwal Pelajaran Summary */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    Jadwal Pelajaran Hari {dayNameSelected}:
                  </p>
                  {todaysSchedule.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {todaysSchedule.map(j => (
                        <div key={j.id} className="text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between font-mono bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-200 dark:border-slate-800">
                          <span>{j.jamKe || `${j.jamMulai} - ${j.jamSelesai}`}</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{j.mapel} ({j.rombelNama || j.rombelId})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                      Tidak ada jam mengajar terdaftar di sistem untuk hari {dayNameSelected}.
                    </p>
                  )}
                </div>

              </div>
            </div>

            {/* MANUAL AGENDA INPUT FORM */}
            {showAddAgenda && (
              <form onSubmit={handleSaveAgendaManual} className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-700 shadow-xl space-y-4 animate-fade-in">
                <h4 className="font-bold text-sm text-blue-300 flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Form Input Agenda Harian Guru
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-bold">Jam Ke / Waktu</label>
                    <input
                      type="text"
                      value={formAgendaJamKe}
                      onChange={(e) => setFormAgendaJamKe(e.target.value)}
                      placeholder="e.g., Jam 1 - 2 (07:30 - 09:00)"
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-bold">Status Pelaksanaan</label>
                    <select
                      value={formAgendaStatus}
                      onChange={(e) => setFormAgendaStatus(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold"
                    >
                      <option value="TERLAKSANA">TERLAKSANA</option>
                      <option value="TERTUNDA">TERTUNDA</option>
                      <option value="LIBUR_AKADEMIK">LIBUR AKADEMIK</option>
                      <option value="DIUBAH">DIUBAH / DIGANTI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1 font-bold">Pencapaian Siswa</label>
                    <input
                      type="text"
                      value={formAgendaPencapaian}
                      onChange={(e) => setFormAgendaPencapaian(e.target.value)}
                      placeholder="e.g., Tuntas 85% Siswa"
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                {capaianList.filter(c => c.mapel === selectedMapel).length > 0 && (
                  <div className="p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl space-y-1">
                    <label className="block text-[11px] font-bold text-amber-400 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" />
                      Pilih dari Bank Capaian Pembelajaran (CP) {selectedMapel}:
                    </label>
                    <select
                      onChange={(e) => {
                        const cpId = e.target.value;
                        setSelectedCPIdForAgenda(cpId);
                        const cpObj = capaianList.find(c => c.id === cpId);
                        if (cpObj) {
                          setFormAgendaMateri(`[${cpObj.kodeCP}] ${cpObj.elemen}`);
                          setFormAgendaTujuan(cpObj.tujuanPembelajaranList?.join('; ') || cpObj.deskripsiCP);
                        }
                      }}
                      className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-300 font-semibold"
                    >
                      <option value="">-- Manual Entry / Custom Materi --</option>
                      {capaianList.filter(c => c.mapel === selectedMapel).map(cp => (
                        <option key={cp.id} value={cp.id}>
                          [{cp.kodeCP}] {cp.elemen} - {cp.fase}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-bold">Materi Pokok Pembelajaran</label>
                  <input
                    type="text"
                    value={formAgendaMateri}
                    onChange={(e) => setFormAgendaMateri(e.target.value)}
                    placeholder="Materi pokok dari Promes/Prota..."
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-bold">Tujuan Pembelajaran (TP)</label>
                  <textarea
                    value={formAgendaTujuan}
                    onChange={(e) => setFormAgendaTujuan(e.target.value)}
                    placeholder="Tujuan pembelajaran yang ingin dicapai pada pertemuan ini..."
                    rows={2}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-bold">Langkah / Kegiatan Pembelajaran</label>
                  <textarea
                    value={formAgendaKegiatan}
                    onChange={(e) => setFormAgendaKegiatan(e.target.value)}
                    rows={2}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-bold">Catatan / Kendala / Tindak Lanjut</label>
                  <input
                    type="text"
                    value={formAgendaCatatan}
                    onChange={(e) => setFormAgendaCatatan(e.target.value)}
                    placeholder="Contoh: 3 siswa perlu remedial membaca di jam istirahat"
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAgenda(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Agenda
                  </button>
                </div>
              </form>
            )}

            {/* AGENDA HARIAN TABLE / LIST */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Daftar Agenda Harian KBM ({filteredAgenda.length} Item)
                </h3>
                <span className="text-xs text-slate-500 font-mono">Tgl: {selectedDate}</span>
              </div>

              {filteredAgenda.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Belum ada Agenda Harian untuk tanggal {selectedDate}.</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                    Klik tombol <strong>"Auto-Generate dari Jadwal & Promes"</strong> di atas untuk membuat agenda harian otomatis!
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3 rounded-l-xl">Jam / Waktu</th>
                        <th className="p-3">Materi Pokok & TP</th>
                        <th className="p-3">Kegiatan & Pencapaian</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Catatan Kendala</th>
                        <th className="p-3 text-right rounded-r-xl">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAgenda.map((ag) => (
                        <tr key={ag.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="p-3 font-mono text-slate-700 dark:text-slate-300 font-bold align-top whitespace-nowrap">
                            {ag.jamKe}
                            <div className="text-[10px] text-slate-400 font-normal">{ag.mapel}</div>
                          </td>
                          <td className="p-3 align-top max-w-xs">
                            <p className="font-bold text-slate-900 dark:text-white">{ag.materiPokok}</p>
                            {ag.tujuanPembelajaran && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ag.tujuanPembelajaran}</p>
                            )}
                          </td>
                          <td className="p-3 align-top max-w-xs">
                            <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line">{ag.kegiatanPembelajaran || '-'}</p>
                            {ag.pencapaianSiswa && (
                              <span className="inline-block mt-1 text-[10px] px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 rounded font-bold">
                                {ag.pencapaianSiswa}
                              </span>
                            )}
                          </td>
                          <td className="p-3 align-top whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              ag.status === 'TERLAKSANA'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                : ag.status === 'LIBUR_AKADEMIK'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300'
                            }`}>
                              {ag.status}
                            </span>
                          </td>
                          <td className="p-3 align-top max-w-xs text-slate-500 dark:text-slate-400">
                            {ag.catatanKendala || '-'}
                          </td>
                          <td className="p-3 align-top text-right whitespace-nowrap">
                            {!ag.syncedToJurnal ? (
                              <button
                                onClick={() => handleSyncAgendaToJurnal(ag)}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] flex items-center gap-1 ml-auto shadow-xs"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                Sync Jurnal
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-end gap-1">
                                <Check className="w-3.5 h-3.5" />
                                Tersinkron Jurnal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

        {/* ==================================================================================== */}
        {/* SUBTAB 2: PROGRAM TAHUNAN (PROTA) */}
        {/* ==================================================================================== */}
        {subTab === 'PROTA' && (
          <div className="space-y-6">

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    Program Tahunan (Prota) - {selectedMapel}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pemetaan Alokasi Jam Pelajaran (JP) dan Tujuan Pembelajaran (TP) selama 1 Tahun Ajaran.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleInsertPresetProta}
                    className="px-3.5 py-2 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800 hover:bg-purple-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Insert Preset Prota Merdeka
                  </button>

                  <button
                    onClick={() => setShowAddProta(!showAddProta)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah TP Prota
                  </button>
                </div>
              </div>

              {/* PROTA SUMMARY CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-2xl">
                  <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase">Semester 1 (Ganjil)</p>
                  <p className="text-2xl font-black text-blue-900 dark:text-blue-100 font-mono mt-1">{totalProtaSem1} <span className="text-xs font-normal">JP</span></p>
                </div>

                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-2xl">
                  <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Semester 2 (Genap)</p>
                  <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 font-mono mt-1">{totalProtaSem2} <span className="text-xs font-normal">JP</span></p>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-2xl">
                  <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase">Total 1 Tahun Ajaran</p>
                  <p className="text-2xl font-black text-purple-900 dark:text-purple-100 font-mono mt-1">{totalProtaSem1 + totalProtaSem2} <span className="text-xs font-normal">JP</span></p>
                </div>
              </div>

              {/* FORM INPUT PROTA */}
              {showAddProta && (
                <form onSubmit={handleAddProta} className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-700 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-xs text-blue-300">Form Tambah Tujuan Pembelajaran Prota</h4>
                    <span className="text-[10px] text-amber-400 font-medium">Terintegrasi Capaian Pembelajaran (CP)</span>
                  </div>

                  {capaianList.filter(c => c.mapel === selectedMapel).length > 0 && (
                    <div className="p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl space-y-1">
                      <label className="block text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" />
                        Pilih dari Bank Capaian Pembelajaran (CP) {selectedMapel}:
                      </label>
                      <select
                        onChange={(e) => {
                          const cpId = e.target.value;
                          setSelectedCPIdForProta(cpId);
                          const cpObj = capaianList.find(c => c.id === cpId);
                          if (cpObj) {
                            setFormProtaCP(`${cpObj.kodeCP}: ${cpObj.elemen}`);
                            setFormProtaTP(cpObj.tujuanPembelajaranList?.join('; ') || cpObj.deskripsiCP);
                          }
                        }}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-300 font-semibold"
                      >
                        <option value="">-- Manual Entry / Custom TP --</option>
                        {capaianList.filter(c => c.mapel === selectedMapel).map(cp => (
                          <option key={cp.id} value={cp.id}>
                            [{cp.kodeCP}] {cp.elemen} - {cp.fase} ({cp.tujuanPembelajaranList?.length || 0} TP)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-bold">Elemen CP</label>
                      <input
                        type="text"
                        value={formProtaCP}
                        onChange={(e) => setFormProtaCP(e.target.value)}
                        placeholder="e.g. Membaca & Memirsa"
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Alokasi Waktu (JP)</label>
                      <input
                        type="number"
                        value={formProtaJP}
                        onChange={(e) => setFormProtaJP(Number(e.target.value))}
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Target Bulan</label>
                      <select
                        value={formProtaBulan}
                        onChange={(e) => setFormProtaBulan(e.target.value)}
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                      >
                        {[...BULAN_SEM_1, ...BULAN_SEM_2].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Deskripsi Tujuan Pembelajaran (TP)</label>
                    <textarea
                      value={formProtaTP}
                      onChange={(e) => setFormProtaTP(e.target.value)}
                      rows={2}
                      placeholder="Gambarkan TP secara terukur..."
                      className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setShowAddProta(false)} className="px-3 py-1.5 bg-slate-800 text-xs rounded-lg font-bold">Batal</button>
                    <button type="submit" className="px-4 py-1.5 bg-blue-600 text-xs font-bold text-white rounded-lg">Simpan Prota</button>
                  </div>
                </form>
              )}

              {/* TABLE PROTA */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th className="p-3 border border-slate-200 dark:border-slate-800">Sem</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-800">Elemen CP</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-800">Tujuan Pembelajaran (TP)</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-800">Target Bulan</th>
                      <th className="p-3 border border-slate-200 dark:border-slate-800 text-center">Alokasi (JP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredProta.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Belum ada item Prota. Klik <strong>"Insert Preset Prota Merdeka"</strong> untuk mengisi otomatis!
                        </td>
                      </tr>
                    ) : (
                      filteredProta.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 border border-slate-200 dark:border-slate-800 font-bold font-mono">Sem {p.semester}</td>
                          <td className="p-3 border border-slate-200 dark:border-slate-800 font-semibold">{p.elementCP}</td>
                          <td className="p-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">{p.tujuanPembelajaran}</td>
                          <td className="p-3 border border-slate-200 dark:border-slate-800">{p.targetBulan}</td>
                          <td className="p-3 border border-slate-200 dark:border-slate-800 text-center font-bold font-mono text-blue-600 dark:text-blue-400">{p.alokasiJP} JP</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* ==================================================================================== */}
        {/* SUBTAB 3: PROGRAM SEMESTER (PROMES) */}
        {/* ==================================================================================== */}
        {subTab === 'PROMES' && (
          <div className="space-y-6">

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-emerald-600" />
                    Program Semester (Promes) - Semester {selectedSemester}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Matriks Distribusi Jam Pelajaran (JP) per Minggu berdasarkan Kalender Efektif Sekolah.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSyncProtaToPromes}
                    className="px-3.5 py-2 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800 hover:bg-blue-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    Sync dari Prota & CP
                  </button>

                  <button
                    onClick={() => setShowAddPromes(!showAddPromes)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Topik Promes
                  </button>
                </div>
              </div>

              {/* PROMES FORM */}
              {showAddPromes && (
                <form onSubmit={handleAddPromes} className="p-5 bg-slate-900 text-white rounded-2xl border border-slate-700 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-xs text-emerald-300">Form Tambah Materi Promes</h4>
                    <span className="text-[10px] text-amber-400 font-medium">Terintegrasi Capaian Pembelajaran (CP)</span>
                  </div>

                  {capaianList.filter(c => c.mapel === selectedMapel).length > 0 && (
                    <div className="p-2.5 bg-slate-800/80 border border-slate-700 rounded-xl space-y-1">
                      <label className="block text-[11px] font-bold text-amber-400 flex items-center gap-1">
                        <Target className="w-3.5 h-3.5" />
                        Pilih dari Bank Capaian Pembelajaran (CP) {selectedMapel}:
                      </label>
                      <select
                        onChange={(e) => {
                          const cpId = e.target.value;
                          setSelectedCPIdForPromes(cpId);
                          const cpObj = capaianList.find(c => c.id === cpId);
                          if (cpObj) {
                            setFormPromesMateri(`${cpObj.kodeCP}: ${cpObj.elemen}`);
                            setFormPromesTP(cpObj.tujuanPembelajaranList?.join('; ') || cpObj.deskripsiCP);
                          }
                        }}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-300 font-semibold"
                      >
                        <option value="">-- Manual Entry / Custom Materi --</option>
                        {capaianList.filter(c => c.mapel === selectedMapel).map(cp => (
                          <option key={cp.id} value={cp.id}>
                            [{cp.kodeCP}] {cp.elemen} - {cp.fase}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Materi / Bab Pelajaran</label>
                      <input
                        type="text"
                        value={formPromesMateri}
                        onChange={(e) => setFormPromesMateri(e.target.value)}
                        placeholder="Materi pokok pelajaran..."
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1 font-bold">Total JP Target</label>
                      <input
                        type="number"
                        value={formPromesJP}
                        onChange={(e) => setFormPromesJP(Number(e.target.value))}
                        className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Tujuan Pembelajaran Singkat</label>
                    <input
                      type="text"
                      value={formPromesTP}
                      onChange={(e) => setFormPromesTP(e.target.value)}
                      className="w-full p-2 bg-slate-800 border border-slate-700 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setShowAddPromes(false)} className="px-3 py-1.5 bg-slate-800 text-xs font-bold">Batal</button>
                    <button type="submit" className="px-4 py-1.5 bg-emerald-600 text-xs font-bold text-white rounded-lg">Simpan Promes</button>
                  </div>
                </form>
              )}

              {/* PROMES MATRIX TABLE */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase">
                    <tr>
                      <th rowSpan={2} className="p-2.5 border border-slate-200 dark:border-slate-800 min-w-[180px]">Materi Pelajaran</th>
                      <th rowSpan={2} className="p-2.5 border border-slate-200 dark:border-slate-800 text-center w-16">Total JP</th>
                      {(selectedSemester === '1' ? BULAN_SEM_1 : BULAN_SEM_2).map(b => (
                        <th key={b} colSpan={4} className="p-2 border border-slate-200 dark:border-slate-800 text-center bg-blue-50/50 dark:bg-blue-950/40">
                          {b}
                        </th>
                      ))}
                    </tr>
                    <tr>
                      {(selectedSemester === '1' ? BULAN_SEM_1 : BULAN_SEM_2).map(b => (
                        <React.Fragment key={`${b}-weeks`}>
                          <th className="p-1 border border-slate-200 dark:border-slate-800 text-center w-7">W1</th>
                          <th className="p-1 border border-slate-200 dark:border-slate-800 text-center w-7">W2</th>
                          <th className="p-1 border border-slate-200 dark:border-slate-800 text-center w-7">W3</th>
                          <th className="p-1 border border-slate-200 dark:border-slate-800 text-center w-7">W4</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredPromes.length === 0 ? (
                      <tr>
                        <td colSpan={26} className="p-8 text-center text-slate-400">
                          Belum ada data Promes. Klik <strong>"Tambah Topik Promes"</strong> di atas.
                        </td>
                      </tr>
                    ) : (
                      filteredPromes.map(pr => (
                        <tr key={pr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 border border-slate-200 dark:border-slate-800 font-bold text-slate-900 dark:text-white">
                            {pr.materiPelajaran}
                            {pr.tujuanPembelajaran && <div className="text-[10px] text-slate-400 font-normal">{pr.tujuanPembelajaran}</div>}
                          </td>
                          <td className="p-2 border border-slate-200 dark:border-slate-800 text-center font-bold font-mono text-emerald-600">{pr.alokasiJP}</td>
                          {(selectedSemester === '1' ? BULAN_SEM_1 : BULAN_SEM_2).map(b => (
                            <React.Fragment key={`${pr.id}-${b}`}>
                              {[1, 2, 3, 4].map(w => {
                                const wKey = `${b}-W${w}`;
                                const val = pr.distribusiMinggu?.[wKey] || (w % 2 === 0 ? 2 : 2);
                                return (
                                  <td key={wKey} className="p-1 border border-slate-200 dark:border-slate-800 text-center font-mono text-slate-600 dark:text-slate-300">
                                    {val > 0 ? val : '-'}
                                  </td>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        )}

        {/* ==================================================================================== */}
        {/* SUBTAB 4: OVERVIEW INTEGRASI JADWAL & KALENDER AKADEMIK */}
        {/* ==================================================================================== */}
        {subTab === 'JADWAL_KALENDER' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* JADWAL PELAJARAN MINGGUAN */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Jadwal Pelajaran Kelas ({rombelList.find(r => r.id === selectedRombelId)?.nama})
              </h3>

              <div className="space-y-3">
                {['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'].map(h => {
                  const items = jadwalList.filter(j => j.hari === h && (j.rombelId === selectedRombelId || j.rombelNama === rombelList.find(r => r.id === selectedRombelId)?.nama));
                  return (
                    <div key={h} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{h}</p>
                      {items.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic mt-1">Tidak ada jadwal jam mengajar</p>
                      ) : (
                        <div className="mt-1.5 space-y-1">
                          {items.map(j => (
                            <div key={j.id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{j.mapel}</span>
                              <span className="font-mono text-slate-500 text-[11px]">{j.jamKe || `${j.jamMulai} - ${j.jamSelesai}`}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* KALENDER AKADEMIK SEKOLAH */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-500" />
                Agenda Kalender Akademik Sekolah
              </h3>

              <div className="space-y-2.5">
                {kalenderEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Belum ada agenda kalender terdaftar.</p>
                ) : (
                  kalenderEvents.map(ev => (
                    <div key={ev.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded font-bold text-[10px]">
                          {ev.kategori}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                          {ev.tanggalMulai} s.d {ev.tanggalSelesai}
                        </span>
                      </div>
                      <p className="font-bold text-xs text-slate-900 dark:text-white">{ev.judul}</p>
                      {ev.keterangan && <p className="text-[11px] text-slate-500">{ev.keterangan}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
