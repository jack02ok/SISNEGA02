import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, addDoc } from 'firebase/firestore';
import { Buku, TransaksiPerpus, Siswa, AppSettings } from '../../types';
import { BarcodeGenerator } from '../BarcodeGenerator';
import { BarcodeScannerModal } from '../BarcodeScannerModal';
import { DigitalLibraryCardModal } from '../DigitalLibraryCardModal';
import { sendFonnteWA } from '../../services/fonnteService';
import { downloadElementAsPDF } from '../../services/pdfService';
import { logAuditEvent } from '../../services/auditService';
import { saveOrQueueRecord } from '../../services/indexedDbSyncQueue';
import { OfflineSyncBanner } from '../OfflineSyncBanner';
import {
  BookMarked,
  Repeat,
  DollarSign,
  CheckCircle2,
  QrCode,
  Printer,
  Plus,
  Send,
  Search,
  BookOpen,
  Clock,
  RotateCcw
} from 'lucide-react';

interface PustakawanViewsProps {
  activeTab: string;
  settings: AppSettings;
}

export const PustakawanViews: React.FC<PustakawanViewsProps> = ({ activeTab, settings }) => {
  const [bukuList, setBukuList] = useState<Buku[]>([]);
  const [transaksiList, setTransaksiList] = useState<TransaksiPerpus[]>([]);
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);

  // Search OPAC
  const [searchOpac, setSearchOpac] = useState('');

  // Scanner modal state
  const [showScanner, setShowScanner] = useState(false);
  const [scanType, setScanType] = useState<'PINJAM' | 'KEMBALI' | 'BEBAS'>('PINJAM');
  const [scannedSiswa, setScannedSiswa] = useState<Siswa | null>(null);
  const [scannedBuku, setScannedBuku] = useState<Buku | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Selected Transaction for Digital Receipt PDF
  const [selectedReceipt, setSelectedReceipt] = useState<TransaksiPerpus | null>(null);

  // Digital Library Card Modal state
  const [showCardModal, setShowCardModal] = useState(false);
  const [selectedCardSiswa, setSelectedCardSiswa] = useState<Siswa | null>(null);

  useEffect(() => {
    const unsubBuku = onSnapshot(collection(db, 'buku'), snap => {
      const l: Buku[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as Buku)); setBukuList(l);
    }, e => console.warn('Buku err:', e));
    const unsubTrx = onSnapshot(collection(db, 'transaksiPerpus'), snap => {
      const l: TransaksiPerpus[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as TransaksiPerpus)); setTransaksiList(l);
    }, e => console.warn('Trx err:', e));
    const unsubSiswa = onSnapshot(collection(db, 'siswa'), snap => {
      const l: Siswa[] = []; snap.forEach(d => l.push({ ...d.data(), id: d.id } as Siswa)); setSiswaList(l);
    }, e => console.warn('Siswa err:', e));

    return () => { unsubBuku(); unsubTrx(); unsubSiswa(); };
  }, []);

  // Handle Scan Code Success in Library
  const handleLibraryScanSuccess = async (decodedText: string) => {
    // Check if code is Siswa NISN/NIS/ID
    const sFound = siswaList.find(s => s.nisn === decodedText || s.nis === decodedText || s.id === decodedText);
    if (sFound) {
      setScannedSiswa(sFound);
      setScanMessage(`✅ SISWA TERDETEKSI: ${sFound.nama} (${sFound.rombelNama})`);
      return;
    }

    // Check if code is Book KodeBuku / ID
    const bFound = bukuList.find(b => b.kodeBuku === decodedText || b.id === decodedText);
    if (bFound) {
      setScannedBuku(bFound);
      setScanMessage(`✅ BUKU TERDETEKSI: "${bFound.judul}" (${bFound.kodeBuku})`);
      return;
    }

    setScanMessage(`❓ Kode "${decodedText}" tidak cocok dengan NISN Siswa maupun Kode Buku.`);
  };

  // Process Loan Transaction with Offline IndexedDB Sync Queue support
  const handleProcessLoan = async () => {
    if (!scannedSiswa || !scannedBuku) {
      alert("Scan Barcode ID Siswa DAN Barcode Buku terlebih dahulu!");
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7 days loan period
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const trxId = `TRX-${Date.now()}`;
    const newTrx: TransaksiPerpus = {
      id: trxId,
      siswaId: scannedSiswa.id,
      namaSiswa: scannedSiswa.nama,
      bukuId: scannedBuku.id,
      judulBuku: scannedBuku.judul,
      tanggalPinjam: todayStr,
      tanggalJatuhTempo: dueDateStr,
      denda: 0,
      status: 'DIPINJAM'
    };

    // Save transaction via saveOrQueueRecord (Direct Firestore write or IndexedDB offline queue)
    const trxRes = await saveOrQueueRecord('transaksiPerpus', 'SET', newTrx, trxId);
    
    // Update book loan counter
    const currentDipinjam = scannedBuku.dipinjam || 0;
    await saveOrQueueRecord('buku', 'UPDATE', { dipinjam: Math.max(0, currentDipinjam + 1) }, scannedBuku.id);

    // AUTO-TRIGGER WA FONNTE TO PARENT!
    const waMsg = `Pemberitahuan Perpustakaan ${settings.schoolName}:\nAnanda *${scannedSiswa.nama}* telah meminjam buku:\n📖 *" ${scannedBuku.judul} "*\n📅 Tgl Jatuh Tempo: *${dueDateStr}*.\n\nMohon merawat dan mengembalikan tepat waktu. Terima kasih.`;

    if (scannedSiswa.noWaOrtu && typeof navigator !== 'undefined' && navigator.onLine) {
      await sendFonnteWA({
        target: scannedSiswa.noWaOrtu,
        message: waMsg,
        token: settings.fonnteToken
      });
    }

    // Log Audit Event
    await logAuditEvent(
      'Pustakawan',
      'PUSTAKAWAN',
      'PERPUS_PINJAM',
      `Peminjaman buku "${scannedBuku.judul}" (${scannedBuku.kodeBuku}) oleh siswa ${scannedSiswa.nama} (${scannedSiswa.rombelNama})`,
      { trxId, siswaId: scannedSiswa.id, bukuId: scannedBuku.id }
    );

    // Create Notification
    try {
      await saveOrQueueRecord('notifications', 'ADD', {
        targetRole: 'PUSTAKAWAN',
        title: '📖 Peminjaman Buku Baru',
        message: `${scannedSiswa.nama} meminjam "${scannedBuku.judul}". Jatuh tempo: ${dueDateStr}`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'PERPUS',
        linkTab: 'pustakawan-transaksi'
      });
    } catch (e) {
      console.warn('Failed adding perpus notification:', e);
    }

    setSelectedReceipt(newTrx);
    
    if (trxRes.synced) {
      alert("✅ Peminjaman Buku Berhasil & Struk Digital Terbit! Data tersinkron ke Firestore.");
    } else {
      alert("⚡ [OFFLINE MODE] Peminjaman buku tersimpan di IndexedDB perangkat! Akan otomatis disinkronkan ke Firestore saat online kembali.");
    }

    setScannedSiswa(null);
    setScannedBuku(null);
  };

  // Process Return Transaction
  const handleProcessReturn = async (trx: TransaksiPerpus) => {
    const fine = calculateFineForTransaction(trx);
    const todayStr = new Date().toISOString().split('T')[0];

    const updatedTrx: Partial<TransaksiPerpus> = {
      status: 'DIKEMBALIKAN',
      tanggalKembali: todayStr,
      denda: fine
    };

    const res = await saveOrQueueRecord('transaksiPerpus', 'UPDATE', updatedTrx, trx.id);

    // Find book and update stock
    const book = bukuList.find(b => b.id === trx.bukuId);
    if (book) {
      const currentDipinjam = book.dipinjam || 0;
      await saveOrQueueRecord('buku', 'UPDATE', { dipinjam: Math.max(0, currentDipinjam - 1) }, book.id);
    }

    if (res.synced) {
      alert(`✅ Pengembalian buku "${trx.judulBuku}" berhasil diproses! Denda: Rp ${fine.toLocaleString('id-ID')}`);
    } else {
      alert(`⚡ [OFFLINE MODE] Pengembalian buku tersimpan di IndexedDB perangkat! Akan otomatis disinkronkan ke Firestore saat online.`);
    }
  };

  // Auto-Calculate Overdue Fines
  const calculateFineForTransaction = (trx: TransaksiPerpus): number => {
    if (trx.status === 'DIKEMBALIKAN') return trx.denda;
    const today = new Date();
    const due = new Date(trx.tanggalJatuhTempo);
    const diffDays = Math.ceil((today.getTime() - due.getTime()) / (1000 * 3600 * 24));
    if (diffDays > 0) {
      return diffDays * (settings.dendaPerHari || 1000);
    }
    return 0;
  };

  // Grant Bebas Pustaka
  const handleGrantBebasPustaka = async (siswaId: string) => {
    // Check if student has active unreturned books
    const activeLoans = transaksiList.filter(t => t.siswaId === siswaId && (t.status === 'DIPINJAM' || t.status === 'TERLAMBAT'));
    if (activeLoans.length > 0) {
      alert(`⛔ GAGAL: Siswa masih memiliki ${activeLoans.length} peminjaman buku yang belum dikembalikan!`);
      return;
    }

    const res = await saveOrQueueRecord('siswa', 'UPDATE', { bebasPustaka: true }, siswaId);

    // Log Audit Event
    const sFound = siswaList.find(s => s.id === siswaId);
    await logAuditEvent(
      'Pustakawan',
      'PUSTAKAWAN',
      'PERPUS_KEMBALI',
      `Penerbitan status BEBAS_PUSTAKA untuk siswa ${sFound?.nama || siswaId}`,
      { siswaId }
    );

    if (res.synced) {
      alert("✅ Status 'BEBAS_PUSTAKA' berhasil diterbitkan untuk siswa!");
    } else {
      alert("⚡ [OFFLINE MODE] Status 'BEBAS_PUSTAKA' tersimpan di IndexedDB lokal & akan disinkronkan ke Firestore saat online.");
    }
  };

  const filteredBuku = bukuList.filter(b => b.judul.toLowerCase().includes(searchOpac.toLowerCase()) || b.kodeBuku.toLowerCase().includes(searchOpac.toLowerCase()));

  return (
    <div className="space-y-6">
      <OfflineSyncBanner moduleName="Perpustakaan" />

      {/* TAB 1: KATALOG BUKU DIGITAL (OPAC) & BARCODE GENERATOR */}
      {activeTab === 'pustakawan-katalog' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-teal-600" />
                Katalog Buku Digital (OPAC) & Barcode Buku
              </h2>
              <p className="text-xs text-slate-500 mt-1">Sistem pencarian pustaka & generator barcode label buku.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedCardSiswa(siswaList[0] || null);
                  setShowCardModal(true);
                }}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <BookOpen className="w-4 h-4 text-amber-300" />
                Kartu Perpustakaan Digital
              </button>
              <button
                onClick={() => downloadElementAsPDF('report-perpus-pdf', `Laporan_Perpustakaan_${settings.schoolName.replace(/\s+/g, '_')}.pdf`)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-xs transition-all"
              >
                <Printer className="w-4 h-4 text-amber-400" /> Cetak Laporan (PDF)
              </button>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchOpac}
                  onChange={(e) => setSearchOpac(e.target.value)}
                  placeholder="Cari Judul / Kode Buku..."
                  className="pl-9 pr-3 py-2 border rounded-xl text-xs w-64"
                />
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredBuku.map((b) => (
              <div key={b.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 text-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-md">{b.kodeBuku}</span>
                    <h4 className="font-bold text-slate-800 text-sm mt-1">{b.judul}</h4>
                    <p className="text-slate-500 mt-0.5">{b.pengarang} ({b.penerbit})</p>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-600 bg-white p-2 rounded-xl border">
                  <span>Stok: <b>{b.stok - (b.dipinjam || 0)}</b> / {b.stok}</span>
                  <span>Lokasi: <b>{b.lokasi}</b></span>
                </div>

                {/* Book Barcode */}
                <div className="bg-white p-2 rounded-xl border flex flex-col items-center">
                  <BarcodeGenerator value={b.kodeBuku} width={1.5} height={35} fontSize={10} />
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">Barcode Label Buku</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: TRANSAKSI PINJAM & KEMBALI SCAN AUTO WA */}
      {activeTab === 'pustakawan-transaksi' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Repeat className="w-5 h-5 text-teal-600" />
                Transaksi Scan Barcode Kilat & Auto-WA Ortu
              </h2>
              <p className="text-xs text-slate-500 mt-1">Scan Barcode ID Card Siswa + Barcode Buku untuk peminjaman/pengembalian otomatis.</p>
            </div>
            <button
              onClick={() => { setScanMessage(null); setShowScanner(true); }}
              className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" /> Buka Kamera Scanner Perpustakaan
            </button>
          </div>

          {scanMessage && (
            <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-xl font-medium">
              {scanMessage}
            </div>
          )}

          {/* Scanned Items Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className={`p-4 rounded-2xl border ${scannedSiswa ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="font-bold text-slate-700">1. Data Siswa Peminjam:</h4>
              {scannedSiswa ? (
                <div className="mt-2 space-y-1">
                  <p className="font-bold text-sm text-blue-900">{scannedSiswa.nama}</p>
                  <p className="font-mono text-slate-600">NISN: {scannedSiswa.nisn} | {scannedSiswa.rombelNama}</p>
                </div>
              ) : (
                <p className="text-slate-400 italic mt-2">Scan ID Card Siswa via kamera...</p>
              )}
            </div>

            <div className={`p-4 rounded-2xl border ${scannedBuku ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'}`}>
              <h4 className="font-bold text-slate-700">2. Data Buku Dipinjam:</h4>
              {scannedBuku ? (
                <div className="mt-2 space-y-1">
                  <p className="font-bold text-sm text-teal-900">{scannedBuku.judul}</p>
                  <p className="font-mono text-slate-600">Kode: {scannedBuku.kodeBuku} | Rak: {scannedBuku.lokasi}</p>
                </div>
              ) : (
                <p className="text-slate-400 italic mt-2">Scan Barcode Buku via kamera...</p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleProcessLoan}
              disabled={!scannedSiswa || !scannedBuku}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
            >
              <Send className="w-4 h-4" /> Proses Peminjaman & Kirim WA
            </button>
          </div>

          <BarcodeScannerModal
            isOpen={showScanner}
            onClose={() => setShowScanner(false)}
            onScanSuccess={handleLibraryScanSuccess}
            title="Scan ID Card Siswa atau Barcode Buku"
          />

          {/* Modal Receipt Digital PDF */}
          {selectedReceipt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
              <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <h3 className="font-bold text-slate-800">Bukti Peminjaman Buku Perpustakaan</h3>
                  <button onClick={() => setSelectedReceipt(null)} className="text-slate-400">✕</button>
                </div>

                <div id="bukti-pinjam-pdf" className="p-6 border border-slate-300 bg-white text-slate-900 font-mono text-xs leading-relaxed">
                  <div className="text-center border-b pb-2 mb-3">
                    <h4 className="font-bold uppercase text-sm">{settings.schoolName}</h4>
                    <p className="text-[10px]">STRUK PEMINJAMAN BUKU PERPUSTAKAAN</p>
                  </div>
                  <p>ID Transaksi: {selectedReceipt.id}</p>
                  <p>Nama Siswa   : {selectedReceipt.namaSiswa}</p>
                  <p>Judul Buku   : {selectedReceipt.judulBuku}</p>
                  <p>Tgl Pinjam   : {selectedReceipt.tanggalPinjam}</p>
                  <p>Jatuh Tempo  : {selectedReceipt.tanggalJatuhTempo}</p>
                  <p className="border-t pt-2 mt-2 text-center text-[10px] italic">Harap mengembalikan buku tepat waktu untuk menghindari denda Rp {settings.dendaPerHari}/hari.</p>
                </div>

                <div className="flex justify-end border-t pt-2">
                  <button
                    onClick={() => downloadElementAsPDF('bukti-pinjam-pdf', `Struk_Pinjam_${selectedReceipt.id}.pdf`)}
                    className="px-4 py-2 bg-teal-600 text-white font-bold rounded-xl text-xs flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> Download Struk PDF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PERHITUNGAN DENDA OTOMATIS (RULE-BASED) */}
      {activeTab === 'pustakawan-denda' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-amber-600" />
              Perhitungan Denda Keterlambatan Otomatis (Rule-Based)
            </h2>
            <p className="text-xs text-slate-500 mt-1">Denda dihitung otomatis berdasarkan jumlah hari keterlambatan x Tarif Denda Rp {settings.dendaPerHari || 1000}/hari.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">Judul Buku</th>
                  <th className="p-3">Tgl Pinjam</th>
                  <th className="p-3">Jatuh Tempo</th>
                  <th className="p-3">Status / Denda</th>
                  <th className="p-3 text-right">Aksi Pengembalian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {transaksiList.map((t) => {
                  const fine = calculateFineForTransaction(t);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{t.namaSiswa}</td>
                      <td className="p-3 font-medium">{t.judulBuku}</td>
                      <td className="p-3 font-mono">{t.tanggalPinjam}</td>
                      <td className="p-3 font-mono text-rose-600 font-bold">{t.tanggalJatuhTempo}</td>
                      <td className="p-3">
                        {t.status === 'DIKEMBALIKAN' ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-md">
                            Sudah Dikembalikan
                          </span>
                        ) : fine > 0 ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-black rounded-md font-mono">
                            TERLAMBAT (Denda: Rp {fine.toLocaleString('id-ID')})
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-md">
                            Tepat Waktu / Rp 0
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        {t.status !== 'DIKEMBALIKAN' && (
                          <button
                            onClick={() => handleProcessReturn(t)}
                            className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs flex items-center gap-1 ml-auto"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Proses Pengembalian
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BEBAS_PUSTAKA STATUS GRANTING */}
      {activeTab === 'pustakawan-bebas' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-6">
          <div className="border-b pb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Penerbitan Status 'BEBAS_PUSTAKA' (Syarat Mutasi Siswa)
            </h2>
            <p className="text-xs text-slate-500 mt-1">Status ini diverifikasi sebelum Admin dapat memproses Surat Keterangan Mutasi Keluar Siswa.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b">
                  <th className="p-3">Nama Siswa</th>
                  <th className="p-3">NISN</th>
                  <th className="p-3">Rombel</th>
                  <th className="p-3">Status Bebas Pustaka</th>
                  <th className="p-3 text-right">Aksi Pustakawan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {siswaList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-800">{s.nama}</td>
                    <td className="p-3 font-mono">{s.nisn}</td>
                    <td className="p-3">{s.rombelNama}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                        s.bebasPustaka ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {s.bebasPustaka ? 'BEBAS_PUSTAKA (Aktif)' : 'BELUM BEBAS'}
                      </span>
                    </td>
                    <td className="p-3 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedCardSiswa(s);
                          setShowCardModal(true);
                        }}
                        className="px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold rounded-lg text-xs flex items-center gap-1 border border-teal-200"
                        title="Lihat / Cetak Kartu Perpustakaan Digital"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Kartu Digital
                      </button>
                      {!s.bebasPustaka ? (
                        <button
                          onClick={() => handleGrantBebasPustaka(s.id)}
                          className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs"
                        >
                          Terbitkan Bebas Pustaka
                        </button>
                      ) : (
                        <span className="text-emerald-600 font-semibold text-xs">✓ Terverifikasi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HIDDEN PRINT CONTAINER FOR PERPUSTAKAAN REPORT PDF */}
      <div className="hidden">
        <div id="report-perpus-pdf" className="p-8 bg-white text-slate-900 font-serif text-xs leading-relaxed space-y-4">
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
              <h2 className="text-lg font-black uppercase text-teal-900">{settings.schoolName}</h2>
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
            <h3 className="text-sm font-bold underline uppercase">LAPORAN REKAPITULASI SIRKULASI PERPUSTAKAAN</h3>
            <p className="text-[10px] font-sans text-slate-500">Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          {/* Ringkasan Koleksi & Transaksi */}
          <div className="grid grid-cols-2 gap-3 font-sans text-[11px] bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <p><strong>Total Judul Buku:</strong> {bukuList.length} Judul</p>
              <p><strong>Total Eksemplar Tersedia:</strong> {bukuList.reduce((acc, b) => acc + (b.stokTersedia || 0), 0)} Eksemplar</p>
            </div>
            <div>
              <p><strong>Peminjaman Aktif:</strong> {transaksiList.filter(t => t.status === 'DIPINJAM').length} Transaksi</p>
              <p><strong>Total Denda Terkumpul:</strong> Rp {transaksiList.reduce((acc, t) => acc + (t.denda || 0), 0).toLocaleString('id-ID')}</p>
            </div>

          </div>

          {/* Tabel Katalog Buku & Stok */}
          <div className="space-y-1 font-sans">
            <h4 className="font-bold text-xs border-b pb-1">1. Katalog Buku Perpustakaan</h4>
            <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-1.5 border-r">No</th>
                  <th className="p-1.5 border-r">Kode</th>
                  <th className="p-1.5 border-r">Judul Buku</th>
                  <th className="p-1.5 border-r">Pengarang</th>
                  <th className="p-1.5 border-r">Kategori</th>
                  <th className="p-1.5">Stok Total</th>
                </tr>
              </thead>
              <tbody>
                {bukuList.slice(0, 15).map((b, idx) => (
                  <tr key={b.id || idx} className="border-b border-slate-200">
                    <td className="p-1.5 border-r text-center">{idx + 1}</td>
                    <td className="p-1.5 border-r font-mono">{b.kodeBuku}</td>
                    <td className="p-1.5 border-r font-semibold">{b.judul}</td>
                    <td className="p-1.5 border-r">{b.pengarang}</td>
                    <td className="p-1.5 border-r">{b.kategori}</td>
                    <td className="p-1.5 text-center font-bold">{b.stokTotal}</td>
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
              <p className="font-bold">Kepala Perpustakaan</p>
              <div className="h-16"></div>
              <p className="font-bold underline">Petugas Pustakawan</p>
              <p className="text-[10px] text-slate-500">{settings.schoolName}</p>
            </div>
          </div>
        </div>
      </div>

      <DigitalLibraryCardModal
        isOpen={showCardModal}
        onClose={() => setShowCardModal(false)}
        siswa={selectedCardSiswa}
        siswaList={siswaList}
        settings={settings}
      />

    </div>
  );
};

