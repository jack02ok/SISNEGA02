import * as XLSX from 'xlsx';
import { Absensi, Penilaian, InventarisRombel, Siswa, Buku } from '../types';

/**
 * Helper to export any array of objects to an .xlsx file using SheetJS
 */
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Data'): void {
  if (!data || data.length === 0) {
    alert("Tidak ada data untuk diekspor ke Excel.");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-fit column widths
  const maxCols = Object.keys(data[0] || {}).length;
  const colWidths = Array(maxCols).fill({ wch: 20 });
  worksheet['!cols'] = colWidths;

  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Export Absensi Siswa to Excel
 */
export function exportAbsensiToExcel(absensiList: Absensi[], siswaList: Siswa[], filename: string = 'Laporan_Absensi_Siswa.xlsx') {
  const formattedData = absensiList.map((a, idx) => {
    const student = siswaList.find(s => s.id === a.siswaId);
    return {
      'No': idx + 1,
      'Tanggal': a.tanggal,
      'Waktu Scan': a.waktuMasuk || '-',
      'Nama Siswa': a.namaSiswa || student?.nama || '-',
      'NISN': student?.nisn || '-',
      'Rombel / Kelas': a.rombelId || student?.rombelNama || '-',
      'Status Absensi': a.status,
      'Keterangan': a.keterangan || '-',
      'Notifikasi WA (Fonnte)': a.waNotified ? 'Terkirim' : 'Belum/Manual'
    };
  });

  exportToExcel(formattedData, filename, 'Rekap Absensi');
}

/**
 * Export Penilaian Hasil Belajar Siswa to Excel
 */
export function exportNilaiToExcel(penilaianList: Penilaian[], siswaList: Siswa[], filename: string = 'Laporan_Nilai_Hasil_Belajar.xlsx') {
  const formattedData = penilaianList.map((p, idx) => {
    const student = siswaList.find(s => s.id === p.siswaId);
    return {
      'No': idx + 1,
      'Nama Siswa': p.namaSiswa || student?.nama || '-',
      'NISN': student?.nisn || '-',
      'Rombel / Kelas': p.rombelId || student?.rombelNama || '-',
      'Mapel': p.mapel || 'Umum',
      'Nilai Formatif Avg': p.nilaiFormatif ? (p.nilaiFormatif.reduce((a, b) => a + b, 0) / (p.nilaiFormatif.length || 1)).toFixed(1) : '-',
      'Nilai Sumatif Lingkup': p.nilaiSumatif || 0,
      'Nilai PTS': p.nilaiPTS || 0,
      'Deskripsi Capaian Pembelajaran (CP)': p.deskripsiCP || '-'
    };
  });

  exportToExcel(formattedData, filename, 'Rekap Nilai Siswa');
}

/**
 * Export Inventaris Kelas & Sarpras Sekolah to Excel
 */
export function exportInventarisToExcel(inventarisList: InventarisRombel[], filename: string = 'Laporan_Inventaris_Sarpras.xlsx') {
  const formattedData = inventarisList.map((i, idx) => ({
    'No': idx + 1,
    'Kode ID': i.id || `INV-${idx + 100}`,
    'Nama Barang Sarpras': i.namaBarang,
    'Lokasi / Rombel': i.rombelId,
    'Total Jumlah': i.jumlah,
    'Kondisi Baik': i.kondisiBaik,
    'Kondisi Rusak': i.kondisiRusak,
    'Status Usulan Perbaikan': i.pengajuanPerbaikan ? 'Perlu Perbaikan' : 'Baik',
    'Catatan': i.catatan || '-'
  }));

  exportToExcel(formattedData, filename, 'Inventaris Sarpras');
}

/**
 * Export Comprehensive Multi-Sheet Excel Workbook for Admin/Kepsek Offline Analysis
 */
export function exportComprehensiveSchoolExcel(
  absensiList: Absensi[],
  penilaianList: Penilaian[],
  inventarisList: InventarisRombel[],
  siswaList: Siswa[],
  bukuList: Buku[] = [],
  filename: string = 'Sertifikasi_Master_Sekolah_Excel.xlsx'
) {
  const workbook = XLSX.utils.book_new();

  // Sheet 1: Siswa
  const siswaSheet = XLSX.utils.json_to_sheet(
    siswaList.map((s, idx) => ({
      'No': idx + 1,
      'Nama Lengkap': s.nama,
      'NISN': s.nisn,
      'NIS': s.nis,
      'Jenis Kelamin': s.gender === 'L' ? 'Laki-Laki' : 'Perempuan',
      'Rombel / Kelas': s.rombelNama || s.rombelId,
      'Tempat, Tgl Lahir': `${s.tempatLahir}, ${s.tanggalLahir}`,
      'Nama Orang Tua': s.namaOrtu,
      'No WA Orang Tua': s.noWaOrtu,
      'Status Keaktifan': s.status
    }))
  );
  XLSX.utils.book_append_sheet(workbook, siswaSheet, 'Master Siswa');

  // Sheet 2: Absensi
  const absensiSheet = XLSX.utils.json_to_sheet(
    absensiList.map((a, idx) => ({
      'No': idx + 1,
      'Tanggal': a.tanggal,
      'Waktu Scan': a.waktuMasuk || '-',
      'Nama Siswa': a.namaSiswa,
      'Rombel': a.rombelId,
      'Status Absensi': a.status,
      'Keterangan': a.keterangan || '-'
    }))
  );
  XLSX.utils.book_append_sheet(workbook, absensiSheet, 'Rekap Absensi');

  // Sheet 3: Nilai
  const nilaiSheet = XLSX.utils.json_to_sheet(
    penilaianList.map((p, idx) => ({
      'No': idx + 1,
      'Nama Siswa': p.namaSiswa || '-',
      'Rombel': p.rombelId,
      'Mapel': p.mapel || 'Umum',
      'Nilai PTS': p.nilaiPTS || 0,
      'Capaian Pembelajaran': p.deskripsiCP || '-'
    }))
  );
  XLSX.utils.book_append_sheet(workbook, nilaiSheet, 'Rekap Penilaian');

  // Sheet 4: Inventaris
  const invSheet = XLSX.utils.json_to_sheet(
    inventarisList.map((i, idx) => ({
      'No': idx + 1,
      'Kode ID': i.id,
      'Nama Barang': i.namaBarang,
      'Lokasi Rombel': i.rombelId,
      'Jumlah Total': i.jumlah,
      'Baik': i.kondisiBaik,
      'Rusak': i.kondisiRusak,
      'Perlu Perbaikan': i.pengajuanPerbaikan ? 'Ya' : 'Tidak'
    }))
  );
  XLSX.utils.book_append_sheet(workbook, invSheet, 'Inventaris Sarpras');

  // Sheet 5: Perpustakaan
  if (bukuList.length > 0) {
    const bukuSheet = XLSX.utils.json_to_sheet(
      bukuList.map((b, idx) => ({
        'No': idx + 1,
        'Kode Buku': b.kodeBuku || b.id,
        'Judul Buku': b.judul,
        'Pengarang': b.pengarang,
        'Penerbit': b.penerbit,
        'Kategori': b.kategori,
        'Stok Total': b.stok,
        'Sedang Dipinjam': b.dipinjam,
        'Lokasi Rak': b.lokasi
      }))
    );
    XLSX.utils.book_append_sheet(workbook, bukuSheet, 'Katalog Perpustakaan');
  }

  XLSX.writeFile(workbook, filename);
}
