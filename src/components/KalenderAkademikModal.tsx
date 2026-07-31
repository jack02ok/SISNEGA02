import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, setDoc, doc, deleteDoc } from 'firebase/firestore';
import { AcademicCalendarEvent, Role } from '../types';
import { logAuditEvent } from '../services/auditService';
import { Calendar, Plus, Trash2, Edit3, Tag, Search, Filter, Sparkles, X, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Info, Clock, Download } from 'lucide-react';

interface KalenderAkademikModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserRole?: Role | string;
  currentUserName?: string;
}

const CATEGORY_STYLES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  LIBUR: { label: 'Libur Sekolah', bg: 'bg-rose-100 dark:bg-rose-950/80', text: 'text-rose-800 dark:text-rose-200', border: 'border-rose-300 dark:border-rose-800' },
  PTS: { label: 'PTS (Tengah Semester)', bg: 'bg-amber-100 dark:bg-amber-950/80', text: 'text-amber-800 dark:text-amber-200', border: 'border-amber-300 dark:border-amber-800' },
  PAS: { label: 'PAS (Akhir Semester)', bg: 'bg-orange-100 dark:bg-orange-950/80', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-800' },
  KEGIATAN: { label: 'Kegiatan Sekolah', bg: 'bg-blue-100 dark:bg-blue-950/80', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-800' },
  RAPOR: { label: 'Pembagian Rapor', bg: 'bg-emerald-100 dark:bg-emerald-950/80', text: 'text-emerald-800 dark:text-emerald-200', border: 'border-emerald-300 dark:border-emerald-800' },
  RAPAT: { label: 'Rapat / Dinas', bg: 'bg-purple-100 dark:bg-purple-950/80', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-800' },
};

export const KalenderAkademikModal: React.FC<KalenderAkademikModalProps> = ({
  isOpen,
  onClose,
  currentUserRole,
  currentUserName
}) => {
  const [events, setEvents] = useState<AcademicCalendarEvent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  // Form State for Admin
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    judul: '',
    kategori: 'KEGIATAN' as 'LIBUR' | 'PTS' | 'PAS' | 'KEGIATAN' | 'RAPOR' | 'RAPAT',
    tanggalMulai: new Date().toISOString().split('T')[0],
    tanggalSelesai: new Date().toISOString().split('T')[0],
    keterangan: ''
  });

  const canManageEvents = Boolean(currentUserRole && ['ADMIN', 'KEPSEK', 'GURU_KELAS', 'GURU_MAPEL'].includes(currentUserRole));

  // Real-time listener for Kalender Akademik
  useEffect(() => {
    if (!isOpen) return;
    const unsub = onSnapshot(
      collection(db, 'kalenderAkademik'),
      (snap) => {
        const list: AcademicCalendarEvent[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as AcademicCalendarEvent);
        });
        // Sort by start date ascending
        list.sort((a, b) => new Date(a.tanggalMulai).getTime() - new Date(b.tanggalMulai).getTime());
        setEvents(list);
      },
      (err) => console.warn('Kalender listener error:', err)
    );
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter events
  const filteredEvents = events.filter((ev) => {
    const matchCategory = selectedCategory === 'ALL' || ev.kategori === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchQuery =
      ev.judul.toLowerCase().includes(q) ||
      (ev.keterangan && ev.keterangan.toLowerCase().includes(q)) ||
      ev.tanggalMulai.includes(q);
    return matchCategory && matchQuery;
  });

  // Save or Update Event (Admin only)
  const handleSubmitEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.judul || !formData.tanggalMulai) {
      alert('Harap isi Judul Agenda dan Tanggal Mulai!');
      return;
    }

    try {
      const id = editingId || `cal_${Date.now()}`;
      const payload: AcademicCalendarEvent = {
        id,
        judul: formData.judul,
        kategori: formData.kategori,
        tanggalMulai: formData.tanggalMulai,
        tanggalSelesai: formData.tanggalSelesai || formData.tanggalMulai,
        keterangan: formData.keterangan || ''
      };

      await setDoc(doc(db, 'kalenderAkademik', id), payload, { merge: true });

      await logAuditEvent(
        currentUserName || 'Admin/Kepsek',
        currentUserRole,
        'SYSTEM',
        `${editingId ? 'Memperbarui' : 'Menambahkan'} Agenda Kalender Akademik: ${formData.judul}`
      );

      setShowAddForm(false);
      setEditingId(null);
      setFormData({
        judul: '',
        kategori: 'KEGIATAN',
        tanggalMulai: new Date().toISOString().split('T')[0],
        tanggalSelesai: new Date().toISOString().split('T')[0],
        keterangan: ''
      });
      alert('✅ Agenda Kalender Akademik berhasil disimpan dan diperbarui secara real-time!');
    } catch (err: any) {
      alert('Gagal menyimpan agenda: ' + err.message);
    }
  };

  const handleEditClick = (ev: AcademicCalendarEvent) => {
    setEditingId(ev.id);
    setFormData({
      judul: ev.judul,
      kategori: ev.kategori,
      tanggalMulai: ev.tanggalMulai,
      tanggalSelesai: ev.tanggalSelesai || ev.tanggalMulai,
      keterangan: ev.keterangan || ''
    });
    setShowAddForm(true);
  };

  const handleDeleteEvent = async (id: string, judul: string) => {
    if (!confirm(`Hapus agenda "${judul}" dari Kalender Akademik?`)) return;
    try {
      await deleteDoc(doc(db, 'kalenderAkademik', id));
      await logAuditEvent(
        currentUserName || 'Admin',
        currentUserRole,
        'SYSTEM',
        `Menghapus Agenda Kalender Akademik: ${judul}`
      );
    } catch (err: any) {
      alert('Gagal menghapus: ' + err.message);
    }
  };

  // Seed default events if empty
  const handleSeedDefaults = async () => {
    const defaultList: AcademicCalendarEvent[] = [
      { id: 'cal_pts1', judul: 'Penilaian Tengah Semester (PTS) Ganjil', kategori: 'PTS', tanggalMulai: '2025-09-22', tanggalSelesai: '2025-09-27', keterangan: 'Evaluasi Pembelajaran Tengah Semester Ganjil Seluruh Kelas' },
      { id: 'cal_rapor1', judul: 'Pembagian Rapor PTS Ganjil', kategori: 'RAPOR', tanggalMulai: '2025-10-03', tanggalSelesai: '2025-10-03', keterangan: 'Penyerahan Laporan Hasil Belajar PTS 1 Lembar kepada Orang Tua' },
      { id: 'cal_pas1', judul: 'Penilaian Akhir Semester (PAS) Ganjil', kategori: 'PAS', tanggalMulai: '2025-12-01', tanggalSelesai: '2025-12-06', keterangan: 'Evaluasi Akhir Semester Ganjil Seluruh Mata Pelajaran' },
      { id: 'cal_libur1', judul: 'Libur Semester Ganjil & Tahun Baru', kategori: 'LIBUR', tanggalMulai: '2025-12-22', tanggalSelesai: '2026-01-03', keterangan: 'Libur Sekolah Akhir Semester Ganjil' },
      { id: 'cal_pts2', judul: 'Penilaian Tengah Semester (PTS) Genap', kategori: 'PTS', tanggalMulai: '2026-03-09', tanggalSelesai: '2026-03-14', keterangan: 'Evaluasi Pembelajaran Tengah Semester Genap' }
    ];

    try {
      for (const item of defaultList) {
        await setDoc(doc(db, 'kalenderAkademik', item.id), item);
      }
      alert('✅ Agenda Kalender Akademik Standar berhasil dibuat!');
    } catch (err: any) {
      alert('Gagal membuat agenda: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-3 sm:p-6 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/30">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                Kalender Akademik Terpusat Sekolah
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] rounded-full font-bold">
                  Live Real-time
                </span>
              </h3>
              <p className="text-xs text-blue-200">
                Jadwal resmi hari libur, ujian PTS/PAS, kegiatan sekolah & pembagian rapor terintegrasi seluruh peran.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari agenda, libur, ujian..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="ALL">-- Semua Kategori Agenda --</option>
              {Object.entries(CATEGORY_STYLES).map(([key, style]) => (
                <option key={key} value={key}>
                  {style.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {canManageEvents && (
              <>
                {events.length === 0 && (
                  <button
                    onClick={handleSeedDefaults}
                    className="px-3 py-1.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 font-bold rounded-xl text-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Load Default Agenda
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingId(null);
                    setFormData({
                      judul: '',
                      kategori: 'KEGIATAN',
                      tanggalMulai: new Date().toISOString().split('T')[0],
                      tanggalSelesai: new Date().toISOString().split('T')[0],
                      keterangan: ''
                    });
                    setShowAddForm(!showAddForm);
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Agenda Baru
                </button>
              </>
            )}
          </div>
        </div>

        {/* Add / Edit Form Modal/Drawer for Admin / Kepsek / Guru */}
        {showAddForm && canManageEvents && (
          <form
            onSubmit={handleSubmitEvent}
            className="p-4 bg-slate-900 text-white border-b border-slate-700 space-y-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-xs text-blue-300 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-400" />
                {editingId ? 'Edit Agenda Kalender' : 'Form Tambah Agenda Kalender Akademik'}
              </h4>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold"
              >
                ✕ Batal
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                  Nama Agenda / Acara *
                </label>
                <input
                  required
                  type="text"
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  placeholder="e.g. Ujian Tengah Semester (PTS) Ganjil"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 font-semibold mb-1">Kategori Agenda</label>
                <select
                  value={formData.kategori}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold"
                >
                  {Object.entries(CATEGORY_STYLES).map(([k, style]) => (
                    <option key={k} value={k}>
                      {style.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 font-semibold mb-1">Tanggal Mulai *</label>
                <input
                  required
                  type="date"
                  value={formData.tanggalMulai}
                  onChange={(e) => setFormData({ ...formData, tanggalMulai: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                  Tanggal Selesai (Opsional)
                </label>
                <input
                  type="date"
                  value={formData.tanggalSelesai}
                  onChange={(e) => setFormData({ ...formData, tanggalSelesai: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] text-slate-300 font-semibold mb-1">
                  Keterangan / Catatan Tambahan
                </label>
                <input
                  type="text"
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  placeholder="Catatan pelaksanaan, sasaran kelas, atau instruksi..."
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-colors"
                >
                  {editingId ? 'Simpan Perubahan' : 'Simpan Ke Kalender'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Content Body: Calendar Agenda Event List */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Calendar className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                Belum ada agenda akademik terdaftar
              </p>
              <p className="text-xs text-slate-500">
                {canManageEvents
                  ? "Klik 'Tambah Agenda Baru' atau 'Load Default Agenda' untuk mengisi jadwal kalender."
                  : 'Agenda akademik sekolah akan ditampilkan di sini setelah dikonfirmasi oleh Administrator, Kepala Sekolah, atau Guru.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredEvents.map((ev) => {
                const catStyle = CATEGORY_STYLES[ev.kategori] || CATEGORY_STYLES.KEGIATAN;
                const isSingleDay = !ev.tanggalSelesai || ev.tanggalSelesai === ev.tanggalMulai;

                return (
                  <div
                    key={ev.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="p-3 bg-blue-50 dark:bg-slate-700 rounded-2xl border border-blue-100 dark:border-slate-600 text-center min-w-[70px] shrink-0">
                        <span className="block text-[10px] font-extrabold uppercase text-blue-600 dark:text-blue-300">
                          {new Date(ev.tanggalMulai).toLocaleDateString('id-ID', { month: 'short' })}
                        </span>
                        <span className="block text-xl font-black text-slate-900 dark:text-white leading-tight">
                          {new Date(ev.tanggalMulai).getDate()}
                        </span>
                        <span className="block text-[9px] font-semibold text-slate-400">
                          {new Date(ev.tanggalMulai).getFullYear()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                          >
                            {catStyle.label}
                          </span>

                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-blue-500" />
                            {ev.tanggalMulai}
                            {!isSingleDay && ` s/d ${ev.tanggalSelesai}`}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-100">
                          {ev.judul}
                        </h4>

                        {ev.keterangan && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            {ev.keterangan}
                          </p>
                        )}
                      </div>
                    </div>

                    {canManageEvents && (
                      <div className="flex items-center gap-1.5 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 dark:border-slate-700">
                        <button
                          onClick={() => handleEditClick(ev)}
                          className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                        >
                          <Edit3 className="w-4 h-4" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteEvent(ev.id, ev.judul)}
                          className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-xl transition-colors text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" /> Hapus
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
