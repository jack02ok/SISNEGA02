import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { Siswa, Rombel, Buku, AppSettings, UserProfile, AcademicCalendarEvent, InventarisRombel } from '../types';

export async function seedDatabaseIfEmpty() {
  try {
    const siswaSnap = await getDocs(collection(db, 'siswa'));
    if (!siswaSnap.empty) {
      console.log("Database already seeded.");
      return;
    }

    console.log("Seeding initial school database...");
    const batch = writeBatch(db);

    // 1. Settings
    const settingsRef = doc(db, 'settings', 'config');
    const defaultSettings: AppSettings = {
      fonnteToken: 'mBya#Xq@4Y!p9zK12345', // Default placeholder token
      schoolName: 'SD Negeri Neglasari 02',
      schoolAddress: 'Jl. Raya Neglasari No. 02, Kec. Neglasari',
      schoolNPSN: '20109876',
      kepsekNama: 'Drs. H. Ahmad Wijaya, M.Pd.',
      kepsekNip: '196805121992031004',
      dendaPerHari: 1000,
      schoolLogoUrl: 'https://raw.githubusercontent.com/jack02ok/osnsd/refs/heads/main/logosd.png'
    };
    batch.set(settingsRef, defaultSettings);

    // 2. Rombel
    const rombelList: Rombel[] = [
      { id: 'rombel-1a', nama: 'Kelas 1A', tingkat: 1, waliKelasNama: 'Siti Rahmawati, S.Pd.', tahunAjaran: '2025/2026' },
      { id: 'rombel-2a', nama: 'Kelas 2A', tingkat: 2, waliKelasNama: 'Budi Santoso, S.Pd.', tahunAjaran: '2025/2026' },
      { id: 'rombel-3a', nama: 'Kelas 3A', tingkat: 3, waliKelasNama: 'Dewi Lestari, S.Pd.', tahunAjaran: '2025/2026' },
      { id: 'rombel-4a', nama: 'Kelas 4A', tingkat: 4, waliKelasNama: 'Agus Setiawan, S.Pd.', tahunAjaran: '2025/2026' },
      { id: 'rombel-5a', nama: 'Kelas 5A', tingkat: 5, waliKelasNama: 'Rina Kusuma, S.Pd.', tahunAjaran: '2025/2026' },
      { id: 'rombel-6a', nama: 'Kelas 6A', tingkat: 6, waliKelasNama: 'Eko Prasetyo, S.Pd.', tahunAjaran: '2025/2026' },
    ];
    rombelList.forEach(r => {
      batch.set(doc(db, 'rombel', r.id), r);
    });

    // 3. Siswa
    const siswaList: Siswa[] = [
      { id: 'SISWA-1001', nisn: '0123456789', nis: '2023001', nama: 'Aditya Pratama', gender: 'L', tempatLahir: 'Jakarta', tanggalLahir: '2016-04-12', rombelId: 'rombel-1a', rombelNama: 'Kelas 1A', namaOrtu: 'Bambang Pratama', noWaOrtu: '081234567890', status: 'AKTIF', bebasPustaka: true },
      { id: 'SISWA-1002', nisn: '0123456790', nis: '2023002', nama: 'Anisa Putri', gender: 'P', tempatLahir: 'Bandung', tanggalLahir: '2016-08-25', rombelId: 'rombel-1a', rombelNama: 'Kelas 1A', namaOrtu: 'Suryadi', noWaOrtu: '081234567891', status: 'AKTIF', bebasPustaka: true },
      { id: 'SISWA-1003', nisn: '0123456791', nis: '2023003', nama: 'Bagas Kurniawan', gender: 'L', tempatLahir: 'Surabaya', tanggalLahir: '2015-02-14', rombelId: 'rombel-2a', rombelNama: 'Kelas 2A', namaOrtu: 'Hendra Kurniawan', noWaOrtu: '081234567892', status: 'AKTIF', bebasPustaka: true },
      { id: 'SISWA-1004', nisn: '0123456792', nis: '2023004', nama: 'Citra Kirana', gender: 'P', tempatLahir: 'Semarang', tanggalLahir: '2015-11-03', rombelId: 'rombel-2a', rombelNama: 'Kelas 2A', namaOrtu: 'Agus Widodo', noWaOrtu: '081234567893', status: 'AKTIF', bebasPustaka: true },
      { id: 'SISWA-1005', nisn: '0123456793', nis: '2023005', nama: 'Dimas Anggara', gender: 'L', tempatLahir: 'Yogyakarta', tanggalLahir: '2014-06-19', rombelId: 'rombel-3a', rombelNama: 'Kelas 3A', namaOrtu: 'Kurnia Anggara', noWaOrtu: '081234567894', status: 'AKTIF', bebasPustaka: true },
      { id: 'SISWA-1006', nisn: '0123456794', nis: '2023006', nama: 'Fiona Safira', gender: 'P', tempatLahir: 'Bogor', tanggalLahir: '2013-09-30', rombelId: 'rombel-4a', rombelNama: 'Kelas 4A', namaOrtu: 'Rahmat Hidayat', noWaOrtu: '081234567895', status: 'AKTIF', bebasPustaka: true },
      { id: 'SISWA-1007', nisn: '0123456795', nis: '2023007', nama: 'Galih Permana', gender: 'L', tempatLahir: 'Malang', tanggalLahir: '2012-01-08', rombelId: 'rombel-5a', rombelNama: 'Kelas 5A', namaOrtu: 'Dedi Permana', noWaOrtu: '081234567896', status: 'AKTIF', bebasPustaka: true },
      { id: 'SISWA-1008', nisn: '0123456796', nis: '2023008', nama: 'Hana Clarissa', gender: 'P', tempatLahir: 'Tangerang', tanggalLahir: '2011-05-17', rombelId: 'rombel-6a', rombelNama: 'Kelas 6A', namaOrtu: 'Irwan Setia', noWaOrtu: '081234567897', status: 'AKTIF', bebasPustaka: true },
    ];
    siswaList.forEach(s => {
      batch.set(doc(db, 'siswa', s.id), s);
    });

    // 4. Buku Perpustakaan
    const bukuList: Buku[] = [
      { id: 'BK-001', kodeBuku: 'BK-001', judul: 'Bahasa Indonesia SD Kelas 1', pengarang: 'Retno Widjajanti', penerbit: 'Erlangga', kategori: 'Buku Teks', stok: 35, dipinjam: 2, lokasi: 'Rak A1' },
      { id: 'BK-002', kodeBuku: 'BK-002', judul: 'Matematika Kurikulum Merdeka Kelas 4', pengarang: 'Hobri, dkk', penerbit: 'Kemendikbudristek', kategori: 'Buku Teks', stok: 40, dipinjam: 5, lokasi: 'Rak A2' },
      { id: 'BK-003', kodeBuku: 'BK-003', judul: 'IPAS (Ilmu Pengetahuan Alam & Sosial) Kelas 5', pengarang: 'Amalia Fitri', penerbit: 'Kemendikbudristek', kategori: 'Buku Teks', stok: 38, dipinjam: 1, lokasi: 'Rak A3' },
      { id: 'BK-004', kodeBuku: 'BK-004', judul: 'Kumpulan Cerita Rakyat Nusantara', pengarang: 'Tira Ikranegara', penerbit: 'Dua Media', kategori: 'Fiksi / Cerita', stok: 15, dipinjam: 3, lokasi: 'Rak B1' },
      { id: 'BK-005', kodeBuku: 'BK-005', judul: 'Ensiklopedi Anak Cerdas Science', pengarang: 'Tim Gramedia', penerbit: 'Gramedia', kategori: 'Referensi', stok: 10, dipinjam: 0, lokasi: 'Rak B2' },
      { id: 'BK-006', kodeBuku: 'BK-006', judul: 'Pendidikan Agama Islam SD Kelas 2', pengarang: 'M. Kholid', penerbit: 'Yudhistira', kategori: 'Buku Teks', stok: 30, dipinjam: 0, lokasi: 'Rak A1' },
    ];
    bukuList.forEach(b => {
      batch.set(doc(db, 'buku', b.id), b);
    });

    // 5. Inventaris Kelas
    const invList: InventarisRombel[] = [
      { id: 'INV-1A-01', rombelId: 'rombel-1a', namaBarang: 'Meja Siswa', jumlah: 20, kondisiBaik: 18, kondisiRusak: 2, pengajuanPerbaikan: true, catatan: '2 meja goyang perlu perbaikan baut' },
      { id: 'INV-1A-02', rombelId: 'rombel-1a', namaBarang: 'Kursi Siswa', jumlah: 20, kondisiBaik: 20, kondisiRusak: 0, pengajuanPerbaikan: false },
      { id: 'INV-1A-03', rombelId: 'rombel-1a', namaBarang: 'Papan Tulis Whiteboard', jumlah: 1, kondisiBaik: 1, kondisiRusak: 0, pengajuanPerbaikan: false },
      { id: 'INV-1A-04', rombelId: 'rombel-1a', namaBarang: 'Kipas Angin Dinding', jumlah: 2, kondisiBaik: 1, kondisiRusak: 1, pengajuanPerbaikan: true, catatan: '1 kipas mati total' },
    ];
    invList.forEach(i => {
      batch.set(doc(db, 'inventarisRombel', i.id), i);
    });

    // 6. Academic Calendar
    const calList: AcademicCalendarEvent[] = [
      { id: 'CAL-001', judul: 'Penilaian Tengah Semester (PTS) Ganjil', tanggalMulai: '2026-09-15', tanggalSelesai: '2026-09-20', kategori: 'PTS', keterangan: 'PTS seluruh tingkat 1 - 6' },
      { id: 'CAL-002', judul: 'Penerimaan Rapor PTS Ganjil', tanggalMulai: '2026-10-02', tanggalSelesai: '2026-10-02', kategori: 'RAPOR', keterangan: 'Pembagian Rapor PTS oleh Wali Kelas' },
      { id: 'CAL-003', judul: 'Hari Kemerdekaan RI (Libur Nasional)', tanggalMulai: '2026-08-17', tanggalSelesai: '2026-08-17', kategori: 'LIBUR', keterangan: 'Upacara Bendera Kemerdekaan' },
    ];
    calList.forEach(c => {
      batch.set(doc(db, 'kalender', c.id), c);
    });

    await batch.commit();
    console.log("Database successfully seeded!");
  } catch (err) {
    console.warn("Notice during database seeding:", err);
  }
}
