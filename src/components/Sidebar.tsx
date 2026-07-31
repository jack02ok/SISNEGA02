import React from 'react';
import { Role } from '../types';
import {
  Users,
  UserCheck,
  Building,
  Settings,
  Calendar,
  FileText,
  UserMinus,
  LayoutDashboard,
  ClipboardCheck,
  TrendingUp,
  QrCode,
  BookOpen,
  GraduationCap,
  Package,
  HeartPulse,
  Award,
  BookMarked,
  Repeat,
  DollarSign,
  CheckCircle2,
  Stethoscope,
  Activity,
  Clock,
  Layers
} from 'lucide-react';

interface SidebarProps {
  activeRole: Role;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeRole, activeTab, onTabChange }) => {
  const getMenuItems = (): MenuItem[] => {
    switch (activeRole) {
      case 'ADMIN':
        return [
          { id: 'admin-users', label: 'User Management & Multi-Role', icon: Users },
          { id: 'admin-siswa', label: 'Master Siswa & ID Card Barcode', icon: UserCheck },
          { id: 'admin-rombel', label: 'Master Rombel / Kelas', icon: Building },
          { id: 'admin-settings', label: 'WA Fonnte & Config Sekolah', icon: Settings },
          { id: 'admin-kalender', label: 'Kalender Akademik', icon: Calendar },
          { id: 'admin-surat', label: 'Modul Persuratan & Disposisi', icon: FileText },
          { id: 'admin-mutasi', label: 'Modul Mutasi Siswa', icon: UserMinus },
          { id: 'admin-audit', label: 'Riwayat Audit Log & Aktivitas', icon: Activity },
        ];

      case 'KEPSEK':
        return [
          { id: 'kepsek-dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
          { id: 'kepsek-supervisi', label: 'Form Supervisi Akademik', icon: ClipboardCheck },
          { id: 'kepsek-kpi', label: 'Skor KPI Pegawai', icon: TrendingUp },
        ];

      case 'GURU_KELAS':
        return [
          { id: 'guru-cp', label: 'Capaian Pembelajaran (CP)', icon: BookOpen },
          { id: 'guru-agenda-harian', label: 'Agenda Harian Guru', icon: Clock },
          { id: 'guru-prota', label: 'Program Tahunan (Prota)', icon: FileText },
          { id: 'guru-promes', label: 'Program Semester (Promes)', icon: Layers },
          { id: 'guru-jurnal', label: 'Jurnal KBM & Catatan BKB', icon: BookOpen },
          { id: 'guru-penilaian', label: 'Modul Penilaian & PTS', icon: GraduationCap },
          { id: 'guru-piket', label: 'Jadwal Piket Kelas & WA', icon: Calendar },
          { id: 'guru-inventaris', label: 'Inventaris Rombel', icon: Package },
          { id: 'guru-kesehatan', label: 'Kesehatan Siswa (UKS Sync)', icon: HeartPulse },
          { id: 'guru-rapor', label: 'Cetak Rapor PTS 1 Lembar', icon: Award },
        ];


      case 'GURU_MAPEL':
        return [
          { id: 'mapel-cp', label: 'Capaian Pembelajaran (CP)', icon: BookOpen },
          { id: 'mapel-agenda-harian', label: 'Agenda Harian Mapel', icon: Clock },
          { id: 'mapel-prota', label: 'Program Tahunan (Prota)', icon: FileText },
          { id: 'mapel-promes', label: 'Program Semester (Promes)', icon: Layers },
          { id: 'mapel-jurnal', label: 'Jurnal & Presensi Mapel Khusus', icon: BookOpen },
          { id: 'mapel-nilai', label: 'Input Nilai Mapel Khusus', icon: GraduationCap },
          { id: 'mapel-jadwal', label: 'Jadwal Pelajaran Mingguan', icon: Calendar },
        ];

      case 'PUSTAKAWAN':
        return [
          { id: 'pustakawan-katalog', label: 'Katalog Buku & Barcode', icon: BookMarked },
          { id: 'pustakawan-transaksi', label: 'Transaksi Scan & Auto WA', icon: Repeat },
          { id: 'pustakawan-denda', label: 'Perhitungan Denda & Struk', icon: DollarSign },
          { id: 'pustakawan-bebas', label: 'Status Bebas Pustaka', icon: CheckCircle2 },
        ];

      case 'UKS':
        return [
          { id: 'uks-screening', label: 'Screening Tumbuh Kembang', icon: Stethoscope },
          { id: 'uks-pasien', label: 'Log Pasien & Auto Sync UKS', icon: Activity },
        ];

      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <aside className="w-full md:w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex-shrink-0 min-h-[calc(100vh-4rem)] p-3 transition-colors duration-200">
      <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-3">
        NAVIGASI {activeRole.replace('_', ' ')}
      </div>
      <nav className="space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all text-left ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
