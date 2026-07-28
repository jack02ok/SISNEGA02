import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { UserProfile, Role, Siswa, Rombel, AppSettings, AcademicCalendarEvent, Surat, MutasiSiswa, Absensi, Penilaian, InventarisRombel, Buku } from '../../types';
import { BarcodeGenerator } from '../BarcodeGenerator';
import { DigitalLibraryCardModal } from '../DigitalLibraryCardModal';
import { sendFonnteWA } from '../../services/fonnteService';
import { downloadElementAsPDF } from '../../services/pdfService';
import { getDriveAccessToken, uploadToGoogleDrive } from '../../services/driveExportService';
import { checkAndTriggerAbsenceAlerts } from '../../services/absenceMonitoringService';
import { logAuditEvent } from '../../services/auditService';
import { createDatabaseSnapshot, downloadSnapshotJSON } from '../../services/backupService';
import { exportComprehensiveSchoolExcel, exportAbsensiToExcel, exportNilaiToExcel, exportInventarisToExcel } from '../../services/excelExportService';
import { TableSkeleton, CardSkeleton } from '../SkeletonLoader';
import { AuditLog } from '../../types';
import {
  Users,
  UserCheck,
  Building,
  Settings as SettingsIcon,
  Calendar,
  FileText,
  UserMinus,
  Plus,
  Trash2,
  Edit2,
  Send,
  Printer,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  PhoneCall,
  Sparkles,
  Clock,
  Tag,
  Bell,
  FileSpreadsheet,
  Download,
  Database,
  RefreshCw,
  HardDriveUpload,
  BookOpen,
  GraduationCap,
  Activity,
  Search,
  Key,
  Mail,
  Lock
} from 'lucide-react';

interface AdminViewsProps {
  activeTab: string;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
}

const ALL_ROLES: { id: Role; label: string }[] = [
  { id: 'ADMIN', label: 'Admin (Operator / TU)' },
  { id: 'KEPSEK', label: 'Kepala Sekolah' },
  { id: 'GURU_KELAS', label: 'Guru Kelas (Wali Kelas)' },
  { id: 'GURU_MAPEL', label: 'Guru Mapel (PJOK/Agama)' },
  { id: 'PUSTAKAWAN', label: 'Pustakawan' },
  { id: 'UKS', label: 'Petugas UKS' },
];

export const AdminViews: React.FC<AdminViewsProps> = ({ activeTab, settings, onUpdateSettings }) => {
  // Collections state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [rombelList, setRombelList] = useState<Rombel[]>([]);
  const [bukuList, setBukuList] = useState<Buku[]>([]);
  const [kalenderEvents, setKalenderEvents] = useState<AcademicCalendarEvent[]>([]);
  const [suratList, setSuratList] = useState<Surat[]>([]);
  const [mutasiList, setMutasiList] = useState<MutasiSiswa[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isExportingDrive, setIsExportingDrive] = useState(false);
  const [isCheckingAbsence, setIsCheckingAbsence] = useState(false);
  const [absenceCheckResult, setAbsenceCheckResult] = useState<string | null>(null);

  // Modals / Selection State
  const [selectedSiswaForCard, setSelectedSiswaForCard] = useState<Siswa | null>(null);
  const [testWaTarget, setTestWaTarget] = useState('');
  const [testWaMessage, setTestWaMessage] = useState('Halo, ini pesan pengujian Fonnte WA Gateway dari Sistem Informasi SD.');
  const [waSending, setWaSending] = useState(false);
  const [waStatusMsg, setWaStatusMsg] = useState('');

  // Password Management States (Firebase Auth)
  const [resetPasswordEmail, setResetPasswordEmail] = useState('');
  const [resetStaffSearch, setResetStaffSearch] = useState('');
  const [resetSendingEmail, setResetSendingEmail] = useState<string | null>(null);
  const [resetStatusMsg, setResetStatusMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Search Filter States
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchSiswaQuery, setSearchSiswaQuery] = useState('');

  // Real-time Filtered User (Teacher/Staff) Collection
  const filteredUsers = users.filter((u) => {
    if (!searchUserQuery.trim()) return true;
    const q = searchUserQuery.toLowerCase().trim();
    return (
      (u.displayName?.toLowerCase() || '').includes(q) ||
      (u.email?.toLowerCase() || '').includes(q) ||
      (u.nip?.toLowerCase() || '').includes(q) ||
      (u.roles?.join(' ').toLowerCase() || u.role?.toLowerCase() || '').includes(q) ||
      (u.rombelBinaan?.toLowerCase() || '').includes(q) ||
      (u.mapelBinaan?.join(' ').toLowerCase() || '').includes(q)
    );
  });

  // Real-time Filtered Student Collection
  const filteredSiswa = siswaList.filter((s) => {
    if (!searchSiswaQuery.trim()) return true;
    const q = searchSiswaQuery.toLowerCase().trim();
    return (
      (s.nama?.toLowerCase() || '').includes(q) ||
      (s.nisn?.toLowerCase() || '').includes(q) ||
      (s.nis?.toLowerCase() || '').includes(q) ||
      (s.rombelNama || s.rombelId || '').toLowerCase().includes(q) ||
      (s.namaOrtu?.toLowerCase() || '').includes(q) ||
      (s.noWaOrtu || s.noHpOrangtua || '').toLowerCase().includes(q)
    );
  });

  // Form states
  const [editUserModal, setEditUserModal] = useState<UserProfile | null>(null);
  const [newSiswaForm, setNewSiswaForm] = useState<Partial<Siswa>>({
    nisn: '', nis: '', nama: '', gender: 'L', tempatLahir: 'Jakarta', tanggalLahir: '2016-01-01',
    rombelId: 'rombel-1a', namaOrtu: '', noWaOrtu: '', status: 'AKTIF', bebasPustaka: true
  });
  const [showAddSiswaModal, setShowAddSiswaModal] = useState(false);
  const [showLibraryCardModal, setShowLibraryCardModal] = useState(false);
  const [selectedLibraryCardSiswa, setSelectedLibraryCardSiswa] = useState<Siswa | null>(null);

  // Mutasi Form
  const [selectedMutasiSiswaId, setSelectedMutasiSiswaId] = useState('');
  const [alasanMutasi, setAlasanMutasi] = useState('');
  const [sekolahTujuan, setSekolahTujuan] = useState('');
  const [mutasiError, setMutasiError] = useState('');
  const [selectedMutasiForPdf, setSelectedMutasiForPdf] = useState<MutasiSiswa | null>(null);

  // Kalender Akademik Form
  const [showAddKalenderModal, setShowAddKalenderModal] = useState(false);
  const [newKalenderForm, setNewKalenderForm] = useState<Partial<AcademicCalendarEvent>>({
    judul: '',
    kategori: 'LIBUR',
    tanggalMulai: new Date().toISOString().split('T')[0],
    tanggalSelesai: new Date().toISOString().split('T')[0],
    keterangan: ''
  });

  // Subscribe real-time
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach(d => list.push({ ...d.data() } as UserProfile));
      setUsers(list);
    }, err => console.warn('Users listener error:', err));

    const unsubSiswa = onSnapshot(collection(db, 'siswa'), (snap) => {
      const list: Siswa[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Siswa));
      setSiswaList(list);
    }, err => console.warn('Siswa listener error:', err));

    const unsubRombel = onSnapshot(collection(db, 'rombel'), (snap) => {
      const list: Rombel[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Rombel));
      setRombelList(list);
    }, err => console.warn('Rombel listener error:', err));

    const unsubKalender = onSnapshot(collection(db, 'kalender'), (snap) => {
      const list: AcademicCalendarEvent[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as AcademicCalendarEvent));
      setKalenderEvents(list);
    }, err => console.warn('Kalender listener error:', err));

    const unsubSurat = onSnapshot(collection(db, 'surat'), (snap) => {
      const list: Surat[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Surat));
      setSuratList(list);
    }, err => console.warn('Surat listener error:', err));

    const unsubMutasi = onSnapshot(collection(db, 'mutasi'), (snap) => {
      const list: MutasiSiswa[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as MutasiSiswa));
      setMutasiList(list);
    }, err => console.warn('Mutasi listener error:', err));

    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      const list: AuditLog[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as AuditLog));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setAuditLogs(list);
    }, err => console.warn('AuditLogs listener error:', err));

    const unsubBuku = onSnapshot(collection(db, 'buku'), (snap) => {
      const list: Buku[] = [];
      snap.forEach(d => list.push({ ...d.data(), id: d.id } as Buku));
      setBukuList(list);
    }, err => console.warn('Buku listener error:', err));

    return () => {
      unsubUsers(); unsubSiswa(); unsubRombel(); unsubBuku();
      unsubKalender(); unsubSurat(); unsubMutasi(); unsubAudit();
    };
  }, []);

  // Absence monitoring trigger
  const handleRunAbsenceMonitoring = async () => {
    setIsCheckingAbsence(true);
    setAbsenceCheckResult('Sedang memindai data ketidakhadiran siswa...');
    try {
      const absSnap = await getDocs(collection(db, 'absensi'));
      const absList: Absensi[] = [];
      absSnap.forEach(d => absList.push({ ...d.data(), id: d.id } as Absensi));

      const alerts = await checkAndTriggerAbsenceAlerts(siswaList, absList, settings);
      if (alerts.length > 0) {
        const names = alerts.map(a => `${a.namaSiswa} (${a.totalAbsen} hari)`).join(', ');
        setAbsenceCheckResult(`⚠️ Terdeteksi ${alerts.length} siswa tidak hadir ≥ 3 hari: ${names}. Pesan peringatan WA telah dikirimkan ke Orang Tua!`);
      } else {
        setAbsenceCheckResult('✅ Pemantauan Selesai: Tidak ada siswa yang terdeteksi tidak hadir ≥ 3 hari berturut-turut.');
      }
    } catch (err: any) {
      setAbsenceCheckResult(`❌ Gagal memroses pemantauan: ${err.message}`);
    } finally {
      setIsCheckingAbsence(false);
    }
  };

  // Google Drive Export for Surat Mutasi
  const handleExportMutasiToDrive = async (mutasi: MutasiSiswa) => {
    setIsExportingDrive(true);
    try {
      const token = await getDriveAccessToken();
      const content = `
SURAT KETERANGAN MUTASI SISWA
----------------------------------------
Nomor: ${mutasi.nomorSuratMutasi}
Sekolah: ${settings.schoolName}
Alamat: ${settings.schoolAddress}

Nama Siswa: ${mutasi.namaSiswa}
NISN: ${mutasi.nisn}
Rombel: ${mutasi.rombelNama}
Status Bebas Pustaka: VERIFIED (Bebas Pustaka)

Pindah Ke: ${mutasi.sekolahTujuan}
Alasan: ${mutasi.alasan}
Tanggal: ${mutasi.tanggal}

Kepala Sekolah: ${settings.kepsekNama} (NIP. ${settings.kepsekNip})
      `.trim();

      const fileName = `Surat_Mutasi_${mutasi.nisn}_${mutasi.namaSiswa.replace(/\s+/g, '_')}.txt`;
      const res = await uploadToGoogleDrive(token, fileName, 'text/plain', content, 'Surat Mutasi SD');
      if (res.success) {
        alert(`✅ Surat Mutasi berhasil diekspor ke Google Drive!\nLink: ${res.webViewLink}`);
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

  // Trigger Firebase Auth Password Reset Email
  const handleTriggerPasswordReset = async (targetEmail: string, staffName?: string) => {
    if (!targetEmail || !targetEmail.trim()) {
      setResetStatusMsg({ type: 'error', msg: 'Alamat email pegawai tidak boleh kosong.' });
      return;
    }

    const cleanEmail = targetEmail.trim();
    setResetSendingEmail(cleanEmail);
    setResetStatusMsg(null);

    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      const targetLabel = staffName ? `${staffName} (${cleanEmail})` : cleanEmail;

      setResetStatusMsg({
        type: 'success',
        msg: `✅ Email reset password berhasil dikirim via Firebase Auth ke ${targetLabel}! Tautan instruksi pemulihan kata sandi telah dikirim ke kotak masuk email pengguna.`
      });

      // Log audit event to Firestore
      await logAuditEvent(
        'Administrator / Operator TU',
        'ADMIN',
        'SYSTEM',
        `Mengirim email reset password Firebase Auth ke staf: ${targetLabel}`
      );
    } catch (err: any) {
      console.error("Firebase Password Reset Error:", err);
      let errMsg = err.message || 'Terjadi kesalahan saat memicu reset password.';
      if (err.code === 'auth/user-not-found') {
        errMsg = 'Pengguna dengan email ini tidak terdaftar di Firebase Authentication.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Format alamat email tidak valid.';
      } else if (err.code === 'auth/too-many-requests') {
        errMsg = 'Terlalu banyak permintaan. Silakan tunggu beberapa saat sebelum mencoba lagi.';
      }
      setResetStatusMsg({
        type: 'error',
        msg: `❌ Gagal mengirim email reset password: ${errMsg}`
      });
    } finally {
      setResetSendingEmail(null);
    }
  };


  // Save Kalender Akademik Event
  const handleSaveKalenderEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKalenderForm.judul || !newKalenderForm.tanggalMulai) {
      alert("Harap isi Judul Agenda dan Tanggal Mulai!");
      return;
    }
    try {
      const id = `cal_${Date.now()}`;
      await setDoc(doc(db, 'kalenderAkademik', id), {
        judul: newKalenderForm.judul,
        kategori: newKalenderForm.kategori || 'KEGIATAN',
        tanggalMulai: newKalenderForm.tanggalMulai,
        tanggalSelesai: newKalenderForm.tanggalSelesai || newKalenderForm.tanggalMulai,
        keterangan: newKalenderForm.keterangan || ''
      });

      await logAuditEvent(
        'Admin Operator',
        'ADMIN',
        'SYSTEM',
        `Menambahkan Agenda Kalender Akademik: ${newKalenderForm.judul} (${newKalenderForm.tanggalMulai})`
      );

      setShowAddKalenderModal(false);
      setNewKalenderForm({
        judul: '',
        kategori: 'LIBUR',
        tanggalMulai: new Date().toISOString().split('T')[0],
        tanggalSelesai: new Date().toISOString().split('T')[0],
        keterangan: ''
      });
      alert("✅ Agenda Kalender Akademik berhasil disimpan dan disinkronisasikan ke Dashboard Guru!");
    } catch (err: any) {
      alert("Gagal menyimpan agenda: " + err.message);
    }
  };

  const handleDeleteKalenderEvent = async (id: string, judul: string) => {
    if (!confirm(`Hapus agenda "${judul}" dari Kalender Akademik?`)) return;
    try {
      await deleteDoc(doc(db, 'kalenderAkademik', id));
      await logAuditEvent(
        'Admin Operator',
        'ADMIN',
        'SYSTEM',
        `Menghapus Agenda Kalender Akademik: ${judul}`
      );
    } catch (err: any) {
      alert("Gagal menghapus: " + err.message);
    }
  };

  const handleSeedKalenderEvents = async () => {
    const defaultEvents: AcademicCalendarEvent[] = [
      { id: 'cal_pts1', judul: 'Penilaian Tengah Semester (PTS) Ganjil', kategori: 'PTS', tanggalMulai: '2025-09-22', tanggalSelesai: '2025-09-27', keterangan: 'Evaluasi Pembelajaran Tengah Semester Ganjil Seluruh Kelas' },
      { id: 'cal_rapor1', judul: 'Pembagian Rapor PTS Ganjil', kategori: 'RAPOR', tanggalMulai: '2025-10-03', tanggalSelesai: '2025-10-03', keterangan: 'Penyerahan Laporan Hasil Belajar PTS 1 Lembar kepada Orang Tua' },
      { id: 'cal_pas1', judul: 'Penilaian Akhir Semester (PAS) Ganjil', kategori: 'PAS', tanggalMulai: '2025-12-01', tanggalSelesai: '2025-12-06', keterangan: 'Evaluasi Akhir Semester Ganjil Seluruh Mata Pelajaran' },
      { id: 'cal_libur1', judul: 'Libur Semester Ganjil & Tahun Baru', kategori: 'LIBUR', tanggalMulai: '2025-12-22', tanggalSelesai: '2026-01-03', keterangan: 'Libur Sekolah Akhir Semester Ganjil' },
      { id: 'cal_pts2', judul: 'Penilaian Tengah Semester (PTS) Genap', kategori: 'PTS', tanggalMulai: '2026-03-09', tanggalSelesai: '2026-03-14', keterangan: 'Evaluasi Pembelajaran Tengah Semester Genap' }
    ];

    try {
      for (const ev of defaultEvents) {
        await setDoc(doc(db, 'kalenderAkademik', ev.id), ev);
      }
      await logAuditEvent('Admin Operator', 'ADMIN', 'SYSTEM', 'Seed Default Agenda Kalender Akademik');
      alert("✅ 5 Agenda Kalender Akademik Default berhasil ditambahkan!");
    } catch (err: any) {
      alert("Gagal menambahkan agenda default: " + err.message);
    }
  };

  // Trigger Full Database Snapshot Backup JSON
  const [isBackingUpJSON, setIsBackingUpJSON] = useState(false);
  const handleBackupDatabaseJSON = async () => {
    setIsBackingUpJSON(true);
    try {
      const snapshot = await createDatabaseSnapshot(settings.schoolName, 'Admin Operator', false);
      downloadSnapshotJSON(snapshot);
      await logAuditEvent('Admin Operator', 'ADMIN', 'SYSTEM', `Backup Snapshot JSON berhasil (${snapshot.totalRecords} records)`);
      alert(`✅ Backup Snapshot Database JSON berhasil dibuat! Total ${snapshot.totalRecords} record dari ${snapshot.collectionsCount} koleksi telah diunduh.`);
    } catch (err: any) {
      alert("Gagal melakukan backup JSON: " + err.message);
    } finally {
      setIsBackingUpJSON(false);
    }
  };

  // Trigger Comprehensive Excel Workbook Export
  const handleExportComprehensiveExcel = async () => {
    try {
      const absSnap = await getDocs(collection(db, 'absensi'));
      const absList: Absensi[] = [];
      absSnap.forEach(d => absList.push(d.data() as Absensi));

      const penSnap = await getDocs(collection(db, 'penilaian'));
      const penList: Penilaian[] = [];
      penSnap.forEach(d => penList.push(d.data() as Penilaian));

      const invSnap = await getDocs(collection(db, 'inventaris'));
      const invList: InventarisRombel[] = [];
      invSnap.forEach(d => invList.push(d.data() as InventarisRombel));

      const bukuSnap = await getDocs(collection(db, 'buku'));
      const bukuList: Buku[] = [];
      bukuSnap.forEach(d => bukuList.push(d.data() as Buku));

      exportComprehensiveSchoolExcel(absList, penList, invList, siswaList, bukuList, `Master_Sertifikasi_Sekolah_${settings.schoolName.replace(/\s+/g, '_')}.xlsx`);
      await logAuditEvent('Admin Operator', 'ADMIN', 'SYSTEM', 'Export Comprehensive Excel Workbook SheetJS');
    } catch (err: any) {
      alert("Gagal export Excel: " + err.message);
    }
  };

  // CSV Export Utility for Collection Data Backup and Reporting
  const downloadCSV = (data: Record<string, any>[], filename: string) => {
    if (!data || data.length === 0) {
      alert("Tidak ada data untuk diekspor ke file CSV.");
      return;
    }
    const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object' && typeof data[0][k] !== 'function');
    
    const csvLines: string[] = [];
    csvLines.push(headers.join(','));

    data.forEach(item => {
      const row = headers.map(header => {
        let val = item[header];
        if (val === undefined || val === null) val = '';
        if (Array.isArray(val)) val = val.join('; ');
        const stringVal = String(val).replace(/"/g, '""');
        return `"${stringVal}"`;
      });
      csvLines.push(row.join(','));
    });

    const csvContent = "\uFEFF" + csvLines.join('\n'); // UTF-8 BOM for Excel compatibility
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Export Handler
  const handleExportCollectionCSV = async (collectionType: 'siswa' | 'users' | 'buku' | 'absensi' | 'jadwal' | 'rombel') => {
    try {
      let dataToExport: any[] = [];
      let filename = `Export_${collectionType.toUpperCase()}_${new Date().toISOString().split('T')[0]}.csv`;

      if (collectionType === 'siswa') {
        dataToExport = siswaList.map(s => ({
          ID: s.id,
          NISN: s.nisn || '',
          NIS: s.nis || '',
          Nama: s.nama,
          Gender: s.gender || '',
          Rombel: s.rombelNama || s.rombelId,
          Status: s.status || 'Aktif',
          No_HP_Orangtua: s.noHpOrangtua || s.noWaOrtu || '',
          Email: s.email || ''
        }));
      } else if (collectionType === 'users') {
        dataToExport = users.map(u => ({
          UID: u.uid,
          Nama: u.displayName,
          Email: u.email,
          NIP: u.nip || '',
          Roles: Array.isArray(u.roles) ? u.roles.join(', ') : u.role || '',
          Gender: u.gender || '',
          No_HP: u.phone || ''
        }));
      } else if (collectionType === 'buku') {
        const snap = await getDocs(collection(db, 'buku'));
        snap.forEach(d => dataToExport.push(d.data()));
        filename = `Export_Koleksi_Buku_Perpus_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (collectionType === 'absensi') {
        const snap = await getDocs(collection(db, 'absensi'));
        snap.forEach(d => dataToExport.push(d.data()));
        filename = `Export_Absensi_Siswa_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (collectionType === 'jadwal') {
        const snap = await getDocs(collection(db, 'jadwal'));
        snap.forEach(d => dataToExport.push(d.data()));
        filename = `Export_Jadwal_Pelajaran_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (collectionType === 'rombel') {
        dataToExport = rombelList.map(r => ({
          ID: r.id,
          Nama_Rombel: r.nama,
          Tingkat: r.tingkat,
          Wali_Kelas: r.waliKelasNama || '',
          Jumlah_Siswa: r.jumlahSiswa || 0
        }));
      }

      if (dataToExport.length === 0) {
        alert(`Koleksi '${collectionType}' belum memiliki data untuk diekspor.`);
        return;
      }

      downloadCSV(dataToExport, filename);
      await logAuditEvent('Admin Operator', 'ADMIN', 'SYSTEM', `Export CSV Koleksi '${collectionType}' (${dataToExport.length} baris)`);
      alert(`✅ Ekspor CSV ${collectionType.toUpperCase()} berhasil! (${dataToExport.length} baris telah diunduh)`);
    } catch (err: any) {
      console.error('CSV Export Error:', err);
      alert('Gagal mengekspor data ke CSV: ' + err.message);
    }
  };

  // Save User Multi-Role Assignment
  const handleSaveUserRoles = async () => {
    if (!editUserModal) return;
    try {
      await setDoc(doc(db, 'users', editUserModal.uid), editUserModal, { merge: true });
      setEditUserModal(null);
      alert("Multi-Role pengguna berhasil disimpan!");
    } catch (err: any) {
      alert("Gagal menyimpan role: " + err.message);
    }
  };

  // Add Siswa
  const handleAddSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiswaForm.nama || !newSiswaForm.nisn) {
      alert("Nama dan NISN wajib diisi!");
      return;
    }
    const id = `SISWA-${Date.now().toString().slice(-6)}`;
    const rNama = rombelList.find(r => r.id === newSiswaForm.rombelId)?.nama || 'Kelas 1A';
    const payload: Siswa = {
      id,
      nisn: newSiswaForm.nisn || '',
      nis: newSiswaForm.nis || '',
      nama: newSiswaForm.nama || '',
      gender: (newSiswaForm.gender as 'L' | 'P') || 'L',
      tempatLahir: newSiswaForm.tempatLahir || 'Jakarta',
      tanggalLahir: newSiswaForm.tanggalLahir || '2016-01-01',
      rombelId: newSiswaForm.rombelId || 'rombel-1a',
      rombelNama: rNama,
      namaOrtu: newSiswaForm.namaOrtu || '',
      noWaOrtu: newSiswaForm.noWaOrtu || '',
      status: 'AKTIF',
      bebasPustaka: true
    };

    await setDoc(doc(db, 'siswa', id), payload);
    setShowAddSiswaModal(false);
    alert("Siswa baru berhasil ditambahkan!");
  };

  // Test Fonnte WA
  const handleTestFonnte = async () => {
    if (!testWaTarget) {
      alert("Masukkan nomor WhatsApp penerima!");
      return;
    }
    setWaSending(true);
    setWaStatusMsg("Mengirim pesan pengujian...");
    const res = await sendFonnteWA({
      target: testWaTarget,
      message: testWaMessage,
      token: settings.fonnteToken
    });
    setWaSending(false);
    if (res.status) {
      setWaStatusMsg("✅ Pesan WhatsApp berhasil terkirim via Fonnte!");
    } else {
      setWaStatusMsg(`❌ Gagal: ${res.message || 'Periksa API Token Fonnte'}`);
    }
  };

  // Process Mutasi
  const handleProcessMutasi = async () => {
    setMutasiError('');
    if (!selectedMutasiSiswaId || !sekolahTujuan || !alasanMutasi) {
      setMutasiError("Lengkapi seluruh data form mutasi!");
      return;
    }

    const s = siswaList.find(x => x.id === selectedMutasiSiswaId);
    if (!s) return;

    // RULE VALIDATION: Must have bebasPustaka === true from Librarian!
    if (!s.bebasPustaka) {
      setMutasiError(`⛔ PROSES DIBLOKIR: Siswa "${s.nama}" BELUM diterbitkan status 'BEBAS_PUSTAKA' oleh Pustakawan. Minta Pustakawan untuk memverifikasi peminjaman buku terlebih dahulu.`);
      return;
    }

    const nomorSurat = `421.2/SD-01/MUT/${Date.now().toString().slice(-4)}/${new Date().getFullYear()}`;
    const mutasiData: MutasiSiswa = {
      id: `MUT-${Date.now()}`,
      siswaId: s.id,
      namaSiswa: s.nama,
      nisn: s.nisn,
      rombelNama: s.rombelNama || 'Rombel',
      tanggal: new Date().toISOString().split('T')[0],
      alasan: alasanMutasi,
      sekolahTujuan: sekolahTujuan,
      statusBebasPustaka: true,
      nomorSuratMutasi: nomorSurat
    };

    // Save mutasi log and update student status to MUTASI_KELUAR
    await setDoc(doc(db, 'mutasi', mutasiData.id), mutasiData);
    await updateDoc(doc(db, 'siswa', s.id), { status: 'MUTASI_KELUAR' });

    setSelectedMutasiForPdf(mutasiData);
    alert("Proses Mutasi Siswa Berhasil & Surat Mutasi Siap Dicetak!");
    setSelectedMutasiSiswaId('');
    setAlasanMutasi('');
    setSekolahTujuan('');
  };

  // Real-time calculated stats from onSnapshot subscriptions
  const totalGuruKelas = users.filter(u => u.roles?.includes('GURU_KELAS') || u.activeRole === 'GURU_KELAS').length;
  const totalGuruMapel = users.filter(u => u.roles?.includes('GURU_MAPEL') || u.activeRole === 'GURU_MAPEL').length;
  const totalGuru = users.filter(u => u.roles?.some(r => r === 'GURU_KELAS' || r === 'GURU_MAPEL') || u.activeRole === 'GURU_KELAS' || u.activeRole === 'GURU_MAPEL').length;

  const totalSiswaAktif = siswaList.filter(s => s.status === 'AKTIF').length;
  const totalSiswaLaki = siswaList.filter(s => s.status === 'AKTIF' && s.gender === 'L').length;
  const totalSiswaPerempuan = siswaList.filter(s => s.status === 'AKTIF' && s.gender === 'P').length;

  const totalJudulBuku = bukuList.length;
  const totalStokBuku = bukuList.reduce((acc, b) => acc + (Number(b.stok) || 0), 0);
  const totalBukuDipinjam = bukuList.reduce((acc, b) => acc + (Number(b.dipinjam) || 0), 0);
  const totalEksemplarBuku = totalStokBuku + totalBukuDipinjam;

  return (
    <div className="space-y-6">

      {/* RINGKASAN STATISTIK REAL-TIME (GURU, SISWA, BUKU AKTIF) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-xl text-blue-600 dark:text-blue-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                Ringkasan Statistik Sekolah
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Data ter-update secara otomatis secara real-time dari Firestore (`onSnapshot`)
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live Sync (onSnapshot)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Jumlah Guru */}
          <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 dark:from-slate-800 dark:to-slate-800/80 rounded-xl p-4 border border-blue-100 dark:border-slate-700/80 shadow-2xs relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                  Total Guru Aktif
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {totalGuru}
                  </h3>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Pengajar
                  </span>
                </div>
              </div>
              <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-blue-100/80 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1 font-medium">
                <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {totalGuruKelas} Guru Kelas
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-medium">
                {totalGuruMapel} Guru Mapel
              </span>
            </div>
          </div>

          {/* Card 2: Jumlah Siswa Aktif */}
          <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 dark:from-slate-800 dark:to-slate-800/80 rounded-xl p-4 border border-emerald-100 dark:border-slate-700/80 shadow-2xs relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  Total Siswa Aktif
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {totalSiswaAktif}
                  </h3>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Siswa (SD)
                  </span>
                </div>
              </div>
              <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-emerald-100/80 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span className="font-medium">
                👦 {totalSiswaLaki} Laki-laki
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-medium">
                👧 {totalSiswaPerempuan} Perempuan
              </span>
            </div>
          </div>

          {/* Card 3: Jumlah Buku Aktif */}
          <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-slate-800 dark:to-slate-800/80 rounded-xl p-4 border border-amber-100 dark:border-slate-700/80 shadow-2xs relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wider">
                  Total Buku Aktif (Perpus)
                </p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {totalJudulBuku}
                  </h3>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Judul ({totalEksemplarBuku} Eks)
                  </span>
                </div>
              </div>
              <div className="p-3 bg-amber-600 text-white rounded-xl shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-amber-100/80 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span className="font-medium text-emerald-700 dark:text-emerald-400">
                📦 {totalStokBuku} Stok Tersedia
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-medium text-amber-700 dark:text-amber-400">
                📖 {totalBukuDipinjam} Dipinjam
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* GLOBAL DATA BACKUP & EXCEL EXPORT TOOLBAR */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-indigo-800/60 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-400/30 text-indigo-300">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              Pusat Cadangan Data & Ekspor Excel (SheetJS)
              <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] rounded-full uppercase tracking-wider font-extrabold">
                Auto-Sync Ready
              </span>
            </h3>
            <p className="text-xs text-indigo-200 mt-0.5">
              Unduh snapshot lengkap database (JSON) & rekap seluruh modul ke Excel (.xlsx) untuk analisis offline.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleBackupDatabaseJSON}
            disabled={isBackingUpJSON}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            {isBackingUpJSON ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            {isBackingUpJSON ? 'Membuat Snapshot...' : 'Backup Snapshot JSON'}
          </button>

          <button
            onClick={handleExportComprehensiveExcel}
            className="flex-1 md:flex-initial px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Ekspor Master Excel (SheetJS)
          </button>

          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-indigo-700/50">
            <span className="text-[10px] font-bold text-indigo-300 px-2 flex items-center gap-1">
              <Download className="w-3 h-3 text-cyan-400" /> Ekspor CSV:
            </span>
            <button
              onClick={() => handleExportCollectionCSV('siswa')}
              className="px-2.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold rounded-lg transition-all"
              title="Ekspor Data Siswa ke CSV"
            >
              Siswa
            </button>
            <button
              onClick={() => handleExportCollectionCSV('users')}
              className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold rounded-lg transition-all"
              title="Ekspor Data Guru & Staf ke CSV"
            >
              Guru/Staf
            </button>
            <button
              onClick={() => handleExportCollectionCSV('buku')}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold rounded-lg transition-all"
              title="Ekspor Koleksi Buku ke CSV"
            >
              Buku
            </button>
            <button
              onClick={() => handleExportCollectionCSV('absensi')}
              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold rounded-lg transition-all"
              title="Ekspor Record Absensi ke CSV"
            >
              Absensi
            </button>
            <button
              onClick={() => handleExportCollectionCSV('jadwal')}
              className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold rounded-lg transition-all"
              title="Ekspor Jadwal Pelajaran ke CSV"
            >
              Jadwal
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: USER MANAGEMENT MULTI-ROLE */}
      {activeTab === 'admin-users' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                User Management & Multi-Role Permissions (RBAC)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Satu email Google dapat diberikan MULTI-ROLE sekaligus. Pengguna dapat berpindah mode peran via Role Switcher di header.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Real-time Search Bar for Teachers / Users */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder="Cari nama, email, NIP, atau role..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all"
                />
                {searchUserQuery && (
                  <button
                    onClick={() => setSearchUserQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={() => handleExportCollectionCSV('users')}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-all whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Ekspor CSV ({filteredUsers.length})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">Nama & Email Google</th>
                  <th className="p-3">Daftar Role Aktif (Multi-Check)</th>
                  <th className="p-3">Rombel / Mapel Binaan</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-400 dark:text-slate-500">
                      {searchUserQuery
                        ? `Tidak ditemukan data guru/staf dengan kata kunci "${searchUserQuery}"`
                        : 'Belum ada akun terdaftar. Mintalah guru/staf untuk Login dengan Google pertama kali.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.displayName}`}
                            alt={u.displayName}
                            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700"
                          />
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{u.displayName}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {u.roles?.map((r) => (
                            <span key={r} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-semibold rounded-md border border-purple-200 dark:border-purple-800">
                              {r}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">
                        {u.rombelBinaan ? `Wali: ${u.rombelBinaan}` : ''}{' '}
                        {u.mapelBinaan?.length ? `[Mapel: ${u.mapelBinaan.join(', ')}]` : ''}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setEditUserModal(u)}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-800/40 text-purple-700 dark:text-purple-300 font-medium rounded-lg text-xs flex items-center gap-1.5 ml-auto transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Atur Multi-Role
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Edit Multi-Role Modal */}
          {editUserModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <h3 className="font-bold text-slate-800 text-base border-b pb-2">
                  Atur Multi-Role Pengguna: {editUserModal.displayName}
                </h3>
                <p className="text-xs text-slate-500">Centang satu atau beberapa role untuk akun email ini:</p>

                <div className="space-y-2 max-h-60 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ALL_ROLES.map((r) => {
                    const isChecked = editUserModal.roles?.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 cursor-pointer hover:bg-slate-100/60">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...(editUserModal.roles || []), r.id]
                              : (editUserModal.roles || []).filter(x => x !== r.id);
                            setEditUserModal({ ...editUserModal, roles: updated });
                          }}
                          className="w-4 h-4 text-purple-600 rounded-sm focus:ring-purple-500"
                        />
                        <span className="text-xs font-semibold text-slate-700">{r.label}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-700">Rombel Binaan (Jika Wali Kelas):</label>
                  <select
                    value={editUserModal.rombelBinaan || ''}
                    onChange={(e) => setEditUserModal({ ...editUserModal, rombelBinaan: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs"
                  >
                    <option value="">-- Pilih Rombel --</option>
                    {rombelList.map(r => (
                      <option key={r.id} value={r.nama}>{r.nama}</option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button
                    onClick={() => setEditUserModal(null)}
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveUserRoles}
                    className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold"
                  >
                    Simpan Hak Akses
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MASTER SISWA & ID CARD BARCODE GENERATOR */}
      {activeTab === 'admin-siswa' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 transition-colors">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Master Data Siswa & Generator Barcode ID Card
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                ID Card barcode digunakan otomatis sebagai Kartu Perpustakaan & Kartu Absensi Scanner Camera.
              </p>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
              {/* Real-time Search Input Bar for Students */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchSiswaQuery}
                  onChange={(e) => setSearchSiswaQuery(e.target.value)}
                  placeholder="Cari NISN, NIS, nama siswa, kelas..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                />
                {searchSiswaQuery && (
                  <button
                    onClick={() => setSearchSiswaQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                onClick={() => handleExportCollectionCSV('siswa')}
                className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold flex items-center gap-2 shadow-2xs transition-all whitespace-nowrap"
              >
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Ekspor CSV ({filteredSiswa.length})
              </button>

              <button
                onClick={() => setShowAddSiswaModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Tambah Siswa
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="p-3">NISN / NIS</th>
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">L/P</th>
                  <th className="p-3">Rombel</th>
                  <th className="p-3">Nama Ortu & No WA</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Cetak Barcode ID Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSiswa.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400 dark:text-slate-500">
                      {searchSiswaQuery
                        ? `Tidak ditemukan data siswa dengan kata kunci "${searchSiswaQuery}"`
                        : 'Belum ada data siswa.'}
                    </td>
                  </tr>
                ) : (
                  filteredSiswa.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-mono text-slate-700 dark:text-slate-300 font-semibold">{s.nisn} / {s.nis}</td>
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{s.nama}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{s.gender}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{s.rombelNama}</td>
                      <td className="p-3">
                        <p className="font-medium text-slate-700 dark:text-slate-300">{s.namaOrtu}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{s.noWaOrtu}</p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md ${
                          s.status === 'AKTIF'
                            ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedLibraryCardSiswa(s);
                            setShowLibraryCardModal(true);
                          }}
                          className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-800/40 text-teal-700 dark:text-teal-300 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-teal-200 dark:border-teal-800"
                          title="Cetak Kartu Perpustakaan Digital"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          Kartu Perpus
                        </button>
                        <button
                          onClick={() => setSelectedSiswaForCard(s)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          ID Card
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal ID Card Preview & Printable */}
          {selectedSiswaForCard && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-slate-800">Kartu Pelajar & Perpustakaan</h3>
                  <button onClick={() => setSelectedSiswaForCard(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                </div>

                {/* Printable Card Area */}
                <div id="printable-id-card" className="border-2 border-slate-800 rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white relative overflow-hidden shadow-xl">
                  <div className="flex items-center gap-3 border-b border-slate-700 pb-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                      SD
                    </div>
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider">{settings.schoolName}</h4>
                      <p className="text-[10px] text-slate-300">KARTU PERPUSTAKAAN & ID ABSENSI</p>
                    </div>
                  </div>

                  <div className="space-y-1 mb-4 text-xs">
                    <p className="text-slate-400">Nama Siswa: <span className="font-bold text-white uppercase">{selectedSiswaForCard.nama}</span></p>
                    <p className="text-slate-400">NISN / NIS: <span className="font-bold text-blue-300 font-mono">{selectedSiswaForCard.nisn} / {selectedSiswaForCard.nis}</span></p>
                    <p className="text-slate-400">Rombel: <span className="font-bold text-white">{selectedSiswaForCard.rombelNama}</span></p>
                  </div>

                  {/* Barcode SVG */}
                  <div className="bg-white p-2 rounded-xl flex flex-col items-center justify-center">
                    <BarcodeGenerator value={selectedSiswaForCard.nisn} width={1.8} height={40} fontSize={11} />
                    <p className="text-[10px] text-slate-600 font-mono mt-1">NISN Barcode ID</p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => downloadElementAsPDF('printable-id-card', `ID_Card_${selectedSiswaForCard.nisn}.pdf`)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Download PDF Kartu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Add Siswa */}
          {showAddSiswaModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
              <form onSubmit={handleAddSiswa} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">Tambah Siswa Baru</h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-slate-600">NISN *</label>
                    <input
                      required
                      type="text"
                      value={newSiswaForm.nisn}
                      onChange={(e) => setNewSiswaForm({ ...newSiswaForm, nisn: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl mt-1"
                      placeholder="10 digit NISN"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">NIS</label>
                    <input
                      type="text"
                      value={newSiswaForm.nis}
                      onChange={(e) => setNewSiswaForm({ ...newSiswaForm, nis: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl mt-1"
                      placeholder="NIS Sekolah"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="font-semibold text-slate-600">Nama Lengkap *</label>
                    <input
                      required
                      type="text"
                      value={newSiswaForm.nama}
                      onChange={(e) => setNewSiswaForm({ ...newSiswaForm, nama: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">Jenis Kelamin</label>
                    <select
                      value={newSiswaForm.gender}
                      onChange={(e) => setNewSiswaForm({ ...newSiswaForm, gender: e.target.value as 'L' | 'P' })}
                      className="w-full px-3 py-2 border rounded-xl mt-1"
                    >
                      <option value="L">Laki-laki (L)</option>
                      <option value="P">Perempuan (P)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">Rombel / Kelas</label>
                    <select
                      value={newSiswaForm.rombelId}
                      onChange={(e) => setNewSiswaForm({ ...newSiswaForm, rombelId: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl mt-1"
                    >
                      {rombelList.map((r) => (
                        <option key={r.id} value={r.id}>{r.nama}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">Nama Orang Tua / Wali</label>
                    <input
                      type="text"
                      value={newSiswaForm.namaOrtu}
                      onChange={(e) => setNewSiswaForm({ ...newSiswaForm, namaOrtu: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl mt-1"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-600">No. WhatsApp Ortu *</label>
                    <input
                      required
                      type="text"
                      value={newSiswaForm.noWaOrtu}
                      onChange={(e) => setNewSiswaForm({ ...newSiswaForm, noWaOrtu: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl mt-1"
                      placeholder="Contoh: 081234567890"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button type="button" onClick={() => setShowAddSiswaModal(false)} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs">
                    Batal
                  </button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">
                    Simpan Siswa
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENGATURAN WA FONNTE & CONFIG SEKOLAH */}
      {activeTab === 'admin-settings' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
              <SettingsIcon className="w-5 h-5 text-emerald-600" />
              Integrasi API Fonnte WA Gateway & Profile Sekolah
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <label className="font-semibold text-slate-700 block">Fonnte API Token *</label>
                <input
                  type="password"
                  value={settings.fonnteToken || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, fonnteToken: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-200"
                  placeholder="Token Fonnte dari https://fonnte.com"
                />
                <p className="text-[11px] text-slate-500">
                  Digunakan otomatis untuk notifikasi WA Absensi Masuk, Penanganan UKS, Transaksi Perpustakaan & Flag Peringatan Alpa.
                </p>

                <label className="font-semibold text-slate-700 block pt-2">Nama Sekolah</label>
                <input
                  type="text"
                  value={settings.schoolName || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, schoolName: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl"
                  placeholder="e.g. SD Negeri Neglasari 02"
                />

                <label className="font-semibold text-slate-700 block pt-2">URL Logo Sekolah (PNG / SVG)</label>
                <input
                  type="url"
                  value={settings.schoolLogoUrl || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, schoolLogoUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl font-mono text-xs"
                  placeholder="https://..."
                />
                <p className="text-[11px] text-slate-500">
                  Logo resmi sekolah yang akan ditampilkan di Header, Login, Kartu Digital, dan Kop Laporan.
                </p>

                <label className="font-semibold text-slate-700 block pt-2">Alamat Sekolah</label>
                <textarea
                  value={settings.schoolAddress || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, schoolAddress: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl h-20"
                />
              </div>

              <div className="space-y-3">
                <label className="font-semibold text-slate-700 block">Nama Kepala Sekolah</label>
                <input
                  type="text"
                  value={settings.kepsekNama || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, kepsekNama: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl"
                />

                <label className="font-semibold text-slate-700 block">NIP Kepala Sekolah</label>
                <input
                  type="text"
                  value={settings.kepsekNip || ''}
                  onChange={(e) => onUpdateSettings({ ...settings, kepsekNip: e.target.value })}
                  className="w-full px-3.5 py-2.5 border rounded-xl font-mono"
                />

                <label className="font-semibold text-slate-700 block">Denda Keterlambatan Perpus (Rp/Hari)</label>
                <input
                  type="number"
                  value={settings.dendaPerHari || 1000}
                  onChange={(e) => onUpdateSettings({ ...settings, dendaPerHari: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 border rounded-xl"
                />
              </div>
            </div>
          </div>

          {/* Fonnte Direct Tester Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-sm flex items-center gap-2 text-emerald-400">
              <PhoneCall className="w-4 h-4" /> Uji Coba Pengiriman WA Gateway (Fonnte)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">Nomor WA Tujuan</label>
                <input
                  type="text"
                  value={testWaTarget}
                  onChange={(e) => setTestWaTarget(e.target.value)}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl"
                />
              </div>
              <div>
                <label className="text-slate-300 font-medium block mb-1">Isi Pesan Uji Coba</label>
                <input
                  type="text"
                  value={testWaMessage}
                  onChange={(e) => setTestWaMessage(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-xl"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-amber-300">{waStatusMsg}</span>
              <button
                onClick={handleTestFonnte}
                disabled={waSending}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all"
              >
                <Send className="w-4 h-4" /> {waSending ? 'Mengirim...' : 'Kirim WA Sekarang'}
              </button>
            </div>
          </div>

          {/* PASSWORD MANAGEMENT CARD (FIREBASE AUTH) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xs border border-slate-200 dark:border-slate-800 space-y-6 transition-colors">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Manajemen Password & Reset Akses Staf / Pegawai (Firebase Auth)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Administrator dapat memicu pengiriman email tautan reset password resmi melalui Firebase Authentication ke akun staf/pegawai terdaftar untuk pemulihan kata sandi.
              </p>
            </div>

            {/* Status Notification */}
            {resetStatusMsg && (
              <div className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                resetStatusMsg.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-800'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800'
              }`}>
                <div className="flex items-center gap-2">
                  {resetStatusMsg.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  )}
                  <span>{resetStatusMsg.msg}</span>
                </div>
                <button onClick={() => setResetStatusMsg(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>
              </div>
            )}

            {/* Direct Email Password Reset Input */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Mail className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Kirim Link Reset Password Manual ke Alamat Email
              </h3>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input
                    type="email"
                    value={resetPasswordEmail}
                    onChange={(e) => setResetPasswordEmail(e.target.value)}
                    placeholder="Masukkan email pegawai (contoh: guru@sd.sch.id)..."
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-medium"
                  />
                </div>
                <button
                  onClick={() => {
                    handleTriggerPasswordReset(resetPasswordEmail);
                    setResetPasswordEmail('');
                  }}
                  disabled={!resetPasswordEmail.trim() || resetSendingEmail !== null}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 flex-shrink-0"
                >
                  <Send className="w-4 h-4 text-amber-300" />
                  {resetSendingEmail === resetPasswordEmail.trim() ? 'Mengirim Email...' : 'Kirim Email Reset Password'}
                </button>
              </div>
            </div>

            {/* Registered Staff List & Password Reset Action Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Pilih dari Staf Terdaftar ({users.length} Orang)
                </h3>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={resetStaffSearch}
                    onChange={(e) => setResetStaffSearch(e.target.value)}
                    placeholder="Cari nama atau email staf..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  {resetStaffSearch && (
                    <button
                      onClick={() => setResetStaffSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-3">Nama Pegawai / Staf</th>
                      <th className="p-3">Email Terdaftar</th>
                      <th className="p-3">Role / Peran Akses</th>
                      <th className="p-3 text-right">Aksi Trigger Reset Password</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-slate-400">
                          Belum ada data staf/pengguna terdaftar di Firestore.
                        </td>
                      </tr>
                    ) : (
                      users
                        .filter((u) => {
                          if (!resetStaffSearch.trim()) return true;
                          const q = resetStaffSearch.toLowerCase().trim();
                          return (
                            (u.displayName?.toLowerCase() || '').includes(q) ||
                            (u.email?.toLowerCase() || '').includes(q) ||
                            (u.role?.toLowerCase() || '').includes(q)
                          );
                        })
                        .map((u) => {
                          const isSendingThis = resetSendingEmail === u.email;

                          return (
                            <tr key={u.uid || u.email || Math.random()} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-100">
                                {u.displayName || 'Tanpa Nama'}
                                {u.nip && <span className="block text-[10px] text-slate-400 font-mono font-normal">NIP: {u.nip}</span>}
                              </td>
                              <td className="p-3 font-mono text-slate-600 dark:text-slate-300">
                                {u.email || '-'}
                              </td>
                              <td className="p-3">
                                <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] rounded-lg border border-indigo-200 dark:border-indigo-800">
                                  {u.role || u.roles?.join(', ') || 'STAFF'}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleTriggerPasswordReset(u.email, u.displayName)}
                                  disabled={!u.email || isSendingThis}
                                  className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold rounded-xl text-xs flex items-center gap-1.5 ml-auto transition-all shadow-2xs disabled:opacity-40"
                                  title={`Kirim tautan reset password ke ${u.email}`}
                                >
                                  <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  {isSendingThis ? 'Mengirim...' : 'Kirim Reset Password'}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MODUL MUTASI SISWA WITH BEBAS_PUSTAKA VALIDATION */}
      {activeTab === 'admin-mutasi' && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-rose-600" />
              Modul Mutasi Siswa Keluar & Validasi Bebas Pustaka
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Aturan Sistem: Proses Mutasi Keluar DIBLOKIR otomatis jika Pustakawan belum menerbitkan status <span className="font-bold text-rose-600 font-mono">BEBAS_PUSTAKA</span>.
            </p>
          </div>

          {mutasiError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Gagal / Ditolak Sistem:</p>
                <p className="mt-0.5 leading-relaxed">{mutasiError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Pilih Siswa Mutasi</label>
              <select
                value={selectedMutasiSiswaId}
                onChange={(e) => setSelectedMutasiSiswaId(e.target.value)}
                className="w-full px-3 py-2.5 border rounded-xl text-xs"
              >
                <option value="">-- Pilih Siswa --</option>
                {siswaList.filter(s => s.status === 'AKTIF').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama} ({s.rombelNama}) - Bebas Pustaka: {s.bebasPustaka ? 'YA (Siap)' : 'TIDAK (Belum)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Sekolah Tujuan</label>
              <input
                type="text"
                value={sekolahTujuan}
                onChange={(e) => setSekolahTujuan(e.target.value)}
                placeholder="misal: SDN Negeri 02 Surabaya"
                className="w-full px-3 py-2.5 border rounded-xl"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Alasan Mutasi</label>
              <input
                type="text"
                value={alasanMutasi}
                onChange={(e) => setAlasanMutasi(e.target.value)}
                placeholder="misal: Pindah domisili orang tua"
                className="w-full px-3 py-2.5 border rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProcessMutasi}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Proses Mutasi & Auto-Generate Surat
            </button>
          </div>

          {/* Mutasi History Table */}
          <div className="pt-4 border-t">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Riwayat Surat Mutasi Siswa</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <th className="p-3">No Surat Mutasi</th>
                    <th className="p-3">Nama Siswa</th>
                    <th className="p-3">NISN</th>
                    <th className="p-3">Sekolah Tujuan</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3 text-right">Cetak Surat PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mutasiList.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-blue-700 font-bold">{m.nomorSuratMutasi}</td>
                      <td className="p-3 font-semibold text-slate-800">{m.namaSiswa}</td>
                      <td className="p-3 font-mono">{m.nisn}</td>
                      <td className="p-3">{m.sekolahTujuan}</td>
                      <td className="p-3">{m.tanggal}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => setSelectedMutasiForPdf(m)}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded-lg text-xs"
                        >
                          Lihat Surat PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Surat Mutasi PDF */}
          {selectedMutasiForPdf && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-slate-800">Pratinjau Surat Keterangan Mutasi</h3>
                  <button onClick={() => setSelectedMutasiForPdf(null)} className="text-slate-400">✕</button>
                </div>

                <div id="surat-mutasi-pdf" className="p-8 border border-slate-300 bg-white text-slate-900 font-serif leading-relaxed text-xs">
                  <div className="flex items-center justify-between border-b-2 border-slate-800 pb-3 mb-6">
                    {settings.schoolLogoUrl && (
                      <img
                        src={settings.schoolLogoUrl}
                        alt={settings.schoolName}
                        className="w-12 h-12 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="text-center flex-1 px-3">
                      <h2 className="font-bold text-sm uppercase tracking-wider">{settings.schoolName}</h2>
                      <p className="text-[10px] text-slate-600">{settings.schoolAddress}</p>
                    </div>
                    {settings.schoolLogoUrl && (
                      <img
                        src={settings.schoolLogoUrl}
                        alt={settings.schoolName}
                        className="w-12 h-12 object-contain opacity-0"
                      />
                    )}
                  </div>

                  <div className="text-center mb-6">
                    <h3 className="font-bold text-sm underline uppercase">SURAT KETERANGAN MUTASI SISWA</h3>
                    <p className="font-mono text-[11px] mt-0.5">Nomor: {selectedMutasiForPdf.nomorSuratMutasi}</p>
                  </div>

                  <p className="mb-4">Yang bertanda tangan di bawah ini Kepala Sekolah {settings.schoolName}, menerangkan bahwa:</p>

                  <table className="w-full mb-6 text-xs">
                    <tbody>
                      <tr><td className="w-36 py-1 font-semibold">Nama Siswa</td><td>: {selectedMutasiForPdf.namaSiswa}</td></tr>
                      <tr><td className="py-1 font-semibold">NISN</td><td className="font-mono">: {selectedMutasiForPdf.nisn}</td></tr>
                      <tr><td className="py-1 font-semibold">Kelas Terakhir</td><td>: {selectedMutasiForPdf.rombelNama}</td></tr>
                      <tr><td className="py-1 font-semibold">Status Perpustakaan</td><td className="text-emerald-700 font-bold">: BEBAS PUSTAKA (Terverifikasi)</td></tr>
                    </tbody>
                  </table>

                  <p className="mb-4">
                    Telah resmi pindah (mutasi) dari {settings.schoolName} ke <span className="font-bold underline">{selectedMutasiForPdf.sekolahTujuan}</span> dengan alasan {selectedMutasiForPdf.alasan}.
                  </p>

                  <div className="flex justify-end pt-8">
                    <div className="text-center w-56">
                      <p>Jakarta, {selectedMutasiForPdf.tanggal}</p>
                      <p className="mb-12">Kepala Sekolah,</p>
                      <p className="font-bold underline">{settings.kepsekNama}</p>
                      <p className="text-[10px] font-mono">NIP. {settings.kepsekNip}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <button
                    onClick={() => handleExportMutasiToDrive(selectedMutasiForPdf)}
                    disabled={isExportingDrive}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> {isExportingDrive ? 'Mengunggah...' : 'Ekspor ke Google Drive'}
                  </button>
                  <button
                    onClick={() => downloadElementAsPDF('surat-mutasi-pdf', `Surat_Mutasi_${selectedMutasiForPdf.nisn}.pdf`)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Download Surat Mutasi PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RIWAYAT AUDIT LOG & PEMANTAUAN KETIDAKHADIRAN OTOMATIS */}
      {activeTab === 'admin-audit' && (
        <div className="space-y-6">
          {/* Absence Monitoring Trigger Box */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4 border border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-amber-400 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Pemantauan Otomatis Siswa Alpha / Sakit ≥ 3 Hari
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Aturan: Memindai seluruh absensi siswa. Siswa yang tidak hadir 3 hari berturut-turut otomatis memicu peringatan WA via Fonnte ke Orang Tua.
                </p>
              </div>
              <button
                onClick={handleRunAbsenceMonitoring}
                disabled={isCheckingAbsence}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all"
              >
                <AlertCircle className="w-4 h-4" />
                {isCheckingAbsence ? 'Memindai...' : 'Jalankan Pemantauan WA'}
              </button>
            </div>

            {absenceCheckResult && (
              <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-200">
                {absenceCheckResult}
              </div>
            )}
          </div>

          {/* Firestore Audit Trail Table */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-4">
            <div className="border-b pb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-600" />
                Sistem Log Audit Transaksi Perpustakaan & UKS
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Seluruh aktivitas peminjaman buku, bebas pustaka, dan penanganan pasien UKS tercatat secara permanen di Firestore untuk akuntabilitas.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Aksi</th>
                    <th className="p-3">Detail Deskripsi Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        Belum ada riwayat audit log. Lakukan transaksi perpustakaan atau penanganan UKS untuk menghasilkan log.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-500">{new Date(log.timestamp).toLocaleString('id-ID')}</td>
                        <td className="p-3 font-bold text-slate-800">{log.userName}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 font-bold rounded-md border border-purple-200">
                            {log.role}
                          </span>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 font-mono">{log.action}</td>
                        <td className="p-3 text-slate-600">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB KALENDER AKADEMIK & AGENDAS */}
      {activeTab === 'admin-kalender' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Sistem Kalender Akademik & Pengingat KBM Sync
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Atur tanggal penting (Libur, UTS/PTS, PAS, Rapor). Agenda yang diinput akan otomatis muncul sebagai pengingat di Dashboard Guru.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSeedKalenderEvents}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Seed Agenda Default (1-Click)
                </button>
                <button
                  onClick={() => setShowAddKalenderModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
                >
                  <Plus className="w-4 h-4" /> Tambah Agenda Baru
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <p className="text-xs text-slate-500 font-medium">Total Agenda</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{kalenderEvents.length}</p>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <p className="text-xs text-amber-700 font-medium">Agenda UTS / PTS</p>
                <p className="text-2xl font-black text-amber-900 mt-1">
                  {kalenderEvents.filter(e => e.kategori === 'PTS').length}
                </p>
              </div>
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl">
                <p className="text-xs text-rose-700 font-medium">Libur Sekolah</p>
                <p className="text-2xl font-black text-rose-900 mt-1">
                  {kalenderEvents.filter(e => e.kategori === 'LIBUR').length}
                </p>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
                <p className="text-xs text-purple-700 font-medium">Rapor & Evaluasi</p>
                <p className="text-2xl font-black text-purple-900 mt-1">
                  {kalenderEvents.filter(e => e.kategori === 'RAPOR' || e.kategori === 'PAS').length}
                </p>
              </div>
            </div>

            {/* Table of Events */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                    <th className="p-3">Agenda / Nama Kegiatan</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Tanggal Mulai</th>
                    <th className="p-3">Tanggal Selesai</th>
                    <th className="p-3">Keterangan / Detail</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kalenderEvents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Belum ada agenda di Kalender Akademik. Klik tombol "+ Tambah Agenda Baru" atau "Seed Agenda Default".
                      </td>
                    </tr>
                  ) : (
                    kalenderEvents
                      .sort((a, b) => new Date(a.tanggalMulai).getTime() - new Date(b.tanggalMulai).getTime())
                      .map((ev) => {
                        const getCategoryBadge = (kat: string) => {
                          switch (kat) {
                            case 'LIBUR': return 'bg-rose-100 text-rose-800 border-rose-200';
                            case 'PTS': return 'bg-amber-100 text-amber-800 border-amber-200';
                            case 'PAS': return 'bg-orange-100 text-orange-800 border-orange-200';
                            case 'RAPOR': return 'bg-purple-100 text-purple-800 border-purple-200';
                            default: return 'bg-blue-100 text-blue-800 border-blue-200';
                          }
                        };

                        return (
                          <tr key={ev.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                              <Bell className="w-4 h-4 text-indigo-500" />
                              {ev.judul}
                            </td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 font-extrabold text-[10px] rounded-lg border uppercase tracking-wider ${getCategoryBadge(ev.kategori)}`}>
                                {ev.kategori}
                              </span>
                            </td>
                            <td className="p-3 font-mono font-medium text-slate-700">{ev.tanggalMulai}</td>
                            <td className="p-3 font-mono font-medium text-slate-700">{ev.tanggalSelesai}</td>
                            <td className="p-3 text-slate-600">{ev.keterangan || '-'}</td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteKalenderEvent(ev.id, ev.judul)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-all"
                                title="Hapus Agenda"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Tambah Agenda Kalender */}
          {showAddKalenderModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    Tambah Agenda Kalender Akademik
                  </h3>
                  <button
                    onClick={() => setShowAddKalenderModal(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveKalenderEvent} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Judul Agenda / Kegiatan *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Penilaian Tengah Semester (PTS) Ganjil"
                      value={newKalenderForm.judul || ''}
                      onChange={e => setNewKalenderForm({ ...newKalenderForm, judul: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Kategori Agenda *</label>
                      <select
                        value={newKalenderForm.kategori || 'LIBUR'}
                        onChange={e => setNewKalenderForm({ ...newKalenderForm, kategori: e.target.value as any })}
                        className="w-full px-3 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                      >
                        <option value="LIBUR">LIBUR SEKOLAH</option>
                        <option value="PTS">PTS (Ujian Tengah Semester)</option>
                        <option value="PAS">PAS (Ujian Akhir Semester)</option>
                        <option value="RAPOR">PEMBAGIAN RAPOR</option>
                        <option value="KEGIATAN">KEGIATAN / ACARA SEKOLAH</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai *</label>
                      <input
                        type="date"
                        required
                        value={newKalenderForm.tanggalMulai || ''}
                        onChange={e => setNewKalenderForm({ ...newKalenderForm, tanggalMulai: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Tanggal Selesai *</label>
                    <input
                      type="date"
                      required
                      value={newKalenderForm.tanggalSelesai || ''}
                      onChange={e => setNewKalenderForm({ ...newKalenderForm, tanggalSelesai: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-slate-50 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Keterangan / Catatan Tambahan</label>
                    <textarea
                      rows={3}
                      placeholder="Deskripsi detail agenda untuk panduan guru..."
                      value={newKalenderForm.keterangan || ''}
                      onChange={e => setNewKalenderForm({ ...newKalenderForm, keterangan: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-slate-50 focus:bg-white resize-none"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowAddKalenderModal(false)}
                      className="px-4 py-2 border rounded-xl text-slate-600 hover:bg-slate-50 font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs"
                    >
                      Simpan Agenda
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fallback info for remaining sub-tabs */}
      {!['admin-users', 'admin-siswa', 'admin-settings', 'admin-mutasi', 'admin-audit', 'admin-kalender'].includes(activeTab) && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
          <h2 className="text-base font-bold text-slate-800">Modul Master / Operational Admin</h2>
          <p className="text-xs text-slate-500 mt-2">Gunakan menu navigasi di sebelah kiri untuk mengelola master data sekolah.</p>
        </div>
      )}

      <DigitalLibraryCardModal
        isOpen={showLibraryCardModal}
        onClose={() => setShowLibraryCardModal(false)}
        siswa={selectedLibraryCardSiswa}
        siswaList={siswaList}
        settings={settings}
      />

    </div>
  );
};
