export type Role = 'ADMIN' | 'KEPSEK' | 'GURU_KELAS' | 'GURU_MAPEL' | 'PUSTAKAWAN' | 'UKS';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  roles: Role[];
  activeRole: Role;
  rombelBinaan?: string; // e.g., "1A"
  mapelBinaan?: string[]; // e.g., ["PJOK", "Agama Islam"]
  nip?: string;
  themePreference?: 'light' | 'dark';
}

export interface Siswa {
  id: string;
  nisn: string;
  nis: string;
  nama: string;
  gender: 'L' | 'P';
  tempatLahir: string;
  tanggalLahir: string;
  rombelId: string; // e.g. "rombel-1a"
  rombelNama?: string;
  namaOrtu: string;
  noWaOrtu: string;
  status: 'AKTIF' | 'MUTASI_KELUAR' | 'ALUMNI';
  bebasPustaka: boolean;
  createdAt?: string;
}

export interface Rombel {
  id: string;
  nama: string; // e.g., "Kelas 1A"
  tingkat: number; // 1 - 6
  waliKelasId?: string;
  waliKelasNama?: string;
  tahunAjaran: string; // e.g. "2025/2026"
}

export type StatusAbsensi = 'HADIR' | 'SAKIT' | 'IZIN' | 'ALPA' | 'DI_UKS';

export interface Absensi {
  id: string;
  siswaId: string;
  namaSiswa: string;
  rombelId: string;
  tanggal: string; // YYYY-MM-DD
  waktuMasuk: string; // HH:mm
  status: StatusAbsensi;
  keterangan?: string;
  waNotified?: boolean;
}

export interface JurnalKBM {
  id: string;
  guruId: string;
  guruNama: string;
  rombelId: string;
  mapel: string;
  tanggal: string; // YYYY-MM-DD
  jamKe: string; // e.g., "1 - 3"
  materi: string;
  cpId?: string;
  cpKode?: string;
  catatanBKB?: string; // Bimbingan Konseling & Perilaku
  createdAt?: string;
}

export interface Penilaian {
  id: string;
  siswaId: string;
  namaSiswa?: string;
  rombelId: string;
  mapel: string;
  semester: '1' | '2';
  nilaiFormatif: number[];
  nilaiSumatif: number;
  nilaiPTS: number;
  deskripsiCP?: string;
  catatanWali?: string;
  ekskul?: string;
  nilaiEkskul?: string;
}

export interface PoinPelanggaran {
  id: string;
  siswaId: string;
  namaSiswa: string;
  rombelNama?: string;
  tanggal: string;
  jenis: 'PELANGGARAN' | 'PRESTASI';
  poin: number;
  keterangan: string;
}

export interface UKSScreening {
  id: string;
  siswaId: string;
  namaSiswa: string;
  rombelId: string;
  tanggal: string; // YYYY-MM-DD
  tinggiBadan: number; // in cm
  beratBadan: number; // in kg
  imtSkor: number;
  imtKategori: 'Sangat Kurus' | 'Kurus' | 'Normal' | 'Gemuk' | 'Obesitas';
  kondisiGigi: string; // e.g., "Sehat" / "Karies"
  kondisiMata: string; // e.g., "Normal" / "Minus"
  kondisiPendengaran: string; // e.g., "Baik" / "Perlu Evaluasi"
  catatanPetugas?: string;
}

export interface UKSPasien {
  id: string;
  siswaId: string;
  namaSiswa: string;
  rombelId: string;
  tanggal: string;
  waktu: string;
  keluhan: string;
  tindakan: string;
  statusPasien: 'DI_UKS' | 'KEMBALI_KE_KELAS' | 'DIJEMPUT_ORTU' | 'DIRUJUK';
  waNotified?: boolean;
}

export interface InventarisRombel {
  id: string;
  rombelId: string;
  namaBarang: string;
  jumlah: number;
  kondisiBaik: number;
  kondisiRusak: number;
  pengajuanPerbaikan?: boolean;
  catatan?: string;
}

export interface Buku {
  id: string;
  kodeBuku: string; // e.g., "BK-001" or ISBN
  judul: string;
  pengarang: string;
  penerbit: string;
  kategori: string;
  stok: number;
  dipinjam: number;
  lokasi: string;
}

export interface TransaksiPerpus {
  id: string;
  siswaId: string;
  namaSiswa: string;
  bukuId: string;
  judulBuku: string;
  tanggalPinjam: string;
  tanggalJatuhTempo: string;
  tanggalKembali?: string;
  denda: number;
  status: 'DIPINJAM' | 'DIKEMBALIKAN' | 'TERLAMBAT';
}

export interface Surat {
  id: string;
  jenis: 'MASUK' | 'KELUAR';
  nomorSurat: string;
  perihal: string;
  pengirim: string;
  penerima: string;
  tanggal: string;
  disposisiKepsek?: string;
  statusDisposisi?: 'DIPROSES' | 'SELESAI';
}

export interface MutasiSiswa {
  id: string;
  siswaId: string;
  namaSiswa: string;
  nisn: string;
  rombelNama: string;
  tanggal: string;
  alasan: string;
  sekolahTujuan: string;
  statusBebasPustaka: boolean;
  nomorSuratMutasi: string;
}

export interface KPIPegawai {
  id: string;
  guruId: string;
  namaGuru: string;
  nip?: string;
  roleLabel: string;
  bulan: string; // YYYY-MM
  totalJurnal: number;
  tepatWaktuCount: number;
  hadirCount: number;
  skorKPI: number; // 0 - 100
  predikat: 'Sangat Baik' | 'Baik' | 'Cukup' | 'Perlu Pembinaan';
}

export interface SupervisiAkademik {
  id: string;
  kepsekId: string;
  guruId: string;
  namaGuru: string;
  tanggal: string;
  rombelId: string;
  mapel: string;
  skorPedagogik: number;
  skorProfesional: number;
  skorSosial: number;
  catatan: string;
  rekomendasi: string;
}

export interface AcademicCalendarEvent {
  id: string;
  judul: string;
  tanggalMulai: string;
  tanggalSelesai: string;
  kategori: 'LIBUR' | 'PTS' | 'PAS' | 'KEGIATAN' | 'RAPOR';
  keterangan?: string;
}

export interface JadwalPelajaran {
  id: string;
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  jamMulai: string; // e.g. "07:30"
  jamSelesai: string; // e.g. "09:00"
  jamKe?: string; // e.g. "Jam 1 - 2"
  rombelId: string;
  rombelNama?: string;
  mapel: string;
  guruId?: string;
  guruNama?: string;
  ruangan?: string;
  keterangan?: string;
  createdAt?: string;
}

export interface AppSettings {
  fonnteToken: string;
  schoolName: string;
  schoolAddress: string;
  schoolNPSN: string;
  kepsekNama: string;
  kepsekNip: string;
  dendaPerHari: number;
  schoolLogoUrl?: string;
  schoolBgUrl?: string;
}



export interface AuditLog {
  id?: string;
  timestamp: string;
  actorName?: string;
  actorRole?: Role | string;
  actionType?: 'PERPUS_PINJAM' | 'PERPUS_KEMBALI' | 'UKS_PASIEN' | 'DISPOSISI_SURAT' | 'MUTASI' | 'INVENTARIS_PERBAIKAN' | 'ABSENSI_ALERT' | 'SYSTEM' | 'ROLE_CHANGE' | 'CONFIG_UPDATE' | string;
  description?: string;
  metadata?: Record<string, any>;
  userName?: string;
  role?: string;
  action?: string;
  details?: string;
}

export interface AppNotification {
  id: string;
  targetRole: Role | 'ALL';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'DISPOSISI' | 'INVENTARIS' | 'UKS' | 'PERPUS' | 'ABSENSI_3HARI' | 'MUTASI';
  linkTab?: string;
}

export interface JadwalPiket {
  id?: string;
  rombelId: string;
  hari: 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';
  siswaIds: string[];
  siswaNames: string[];
}

export interface CapaianPembelajaran {
  id: string;
  kodeCP: string; // e.g. "CP-IND-01"
  fase: string; // "Fase A (Kelas 1-2)", "Fase B (Kelas 3-4)", "Fase C (Kelas 5-6)"
  mapel: string;
  elemen: string; // "Membaca & Memirsa", "Menulis", "Keterampilan Proses", etc.
  deskripsiCP: string;
  tujuanPembelajaranList: string[]; // List of TP derived from CP
  tahunAjaran?: string;
  semester?: '1' | '2' | 'SEMUA';
  guruId?: string;
  guruNama?: string;
  createdAt?: string;
}

export interface ProtaItem {
  id: string;
  cpId?: string;
  cpKode?: string;
  guruId: string;
  guruNama?: string;
  rombelId: string;
  rombelNama?: string;
  mapel: string;
  tahunAjaran: string; // e.g. "2025/2026"
  semester: '1' | '2' | 'SEMUA';
  elementCP: string; // Elemen Capaian Pembelajaran
  tujuanPembelajaran: string; // TP
  alokasiJP: number; // Total Jam Pelajaran (JP)
  targetBulan: string; // e.g., "Juli", "Agustus"
  keterangan?: string;
  createdAt?: string;
}

export interface PromesItem {
  id: string;
  protaId?: string;
  cpId?: string;
  cpKode?: string;
  guruId: string;
  rombelId: string;
  rombelNama?: string;
  mapel: string;
  tahunAjaran: string;
  semester: '1' | '2';
  materiPelajaran: string;
  tujuanPembelajaran: string;
  alokasiJP: number;
  distribusiMinggu: Record<string, number>; // e.g. { "Juli-W3": 2, "Juli-W4": 2 }
  keterangan?: string;
  createdAt?: string;
}

export interface AgendaHarianGuru {
  id: string;
  cpId?: string;
  cpKode?: string;
  cpElemen?: string;
  guruId: string;
  guruNama: string;
  rombelId: string;
  rombelNama: string;
  mapel: string;
  tanggal: string; // YYYY-MM-DD
  hari: string; // e.g., "Senin"
  jamKe: string; // e.g., "1 - 2"
  materiPokok: string;
  tujuanPembelajaran?: string;
  kegiatanPembelajaran?: string;
  pencapaianSiswa?: string;
  status: 'TERLAKSANA' | 'TERTUNDA' | 'LIBUR_AKADEMIK' | 'DIUBAH';
  catatanKendala?: string;
  syncedToJurnal?: boolean;
  createdAt?: string;
}

