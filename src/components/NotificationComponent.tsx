import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { AppNotification, Role } from '../types';
import { Bell, CheckCheck, Mail, Wrench, Heart, BookOpen, AlertTriangle, FileText, Sparkles } from 'lucide-react';

interface NotificationComponentProps {
  activeRole: Role;
  onSelectTab?: (tab: string) => void;
}

export const NotificationComponent: React.FC<NotificationComponentProps> = ({ activeRole, onSelectTab }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'notifications'),
      (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as AppNotification);
        });

        // Sort descending by timestamp
        list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setNotifications(list);
      },
      (error) => {
        console.warn('Real-time notifications snapshot fallback:', error);
      }
    );

    return () => unsub();
  }, []);

  // Filter notifications for activeRole
  const filteredNotifications = notifications.filter(
    (n) => n.targetRole === activeRole || n.targetRole === 'ALL' || (activeRole === 'ADMIN' && true)
  );

  // Fallback initial notifications if empty to demonstrate real-time disposisi & inventaris functionality
  const displayNotifications: AppNotification[] = filteredNotifications.length > 0
    ? filteredNotifications
    : getInitialRoleNotifications(activeRole);

  const unreadCount = displayNotifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      const unreadItems = notifications.filter((n) => !n.read);
      if (unreadItems.length > 0) {
        const batch = writeBatch(db);
        unreadItems.forEach((item) => {
          const ref = doc(db, 'notifications', item.id);
          batch.update(ref, { read: true });
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn('Failed marking notifications read:', e);
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.read && notif.id && !notif.id.startsWith('mock-')) {
      try {
        await updateDoc(doc(db, 'notifications', notif.id), { read: true });
      } catch (e) {
        console.warn('Failed marking notification read:', e);
      }
    }
    if (notif.linkTab && onSelectTab) {
      onSelectTab(notif.linkTab);
      setIsOpen(false);
    }
  };

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'DISPOSISI':
        return <Mail className="w-4 h-4 text-amber-500" />;
      case 'INVENTARIS':
        return <Wrench className="w-4 h-4 text-purple-500" />;
      case 'UKS':
        return <Heart className="w-4 h-4 text-rose-500" />;
      case 'PERPUS':
        return <BookOpen className="w-4 h-4 text-teal-500" />;
      case 'ABSENSI_3HARI':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'MUTASI':
        return <FileText className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Notifikasi Real-time Role"
        className="relative p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-750 transition-all flex items-center justify-center shadow-xs"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-900 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-xs tracking-tight">
                Notifikasi Real-time ({activeRole})
              </h4>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tandai dibaca
              </button>
            )}
          </div>

          {/* List of Notifications */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {displayNotifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Belum ada notifikasi baru untuk peran {activeRole}
              </div>
            ) : (
              displayNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer flex gap-3 items-start ${
                    !notif.read ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 flex-shrink-0 mt-0.5">
                    {getIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    <p className="text-[10px] text-slate-400 font-mono pt-1">
                      {new Date(notif.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} • {new Date(notif.timestamp).toLocaleDateString('id-ID')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 text-center text-[10px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
            Sinkronisasi otomatis dengan Firestore Database
          </div>
        </div>
      )}
    </div>
  );
};

// Initial Mock Notifications based on Role
function getInitialRoleNotifications(role: Role): AppNotification[] {
  const now = new Date().toISOString();
  if (role === 'KEPSEK' || role === 'ADMIN') {
    return [
      {
        id: 'mock-disposisi-1',
        targetRole: 'KEPSEK',
        title: 'Disposisi Surat Masuk Baru',
        message: 'Surat Masuk Dinas Pendidikan No. 421/089/2026 memerlukan tanggapan disposisi Kepala Sekolah.',
        timestamp: now,
        read: false,
        type: 'DISPOSISI',
        linkTab: 'kepsek-arsip'
      },
      {
        id: 'mock-inv-1',
        targetRole: 'ADMIN',
        title: 'Pengajuan Perbaikan Inventaris',
        message: 'Wali Kelas 1A mengajukan perbaikan 3 unit Proyektor & Meja Belajar Rusak.',
        timestamp: now,
        read: false,
        type: 'INVENTARIS',
        linkTab: 'admin-inventaris'
      }
    ];
  } else if (role === 'GURU_KELAS') {
    return [
      {
        id: 'mock-absensi-1',
        targetRole: 'GURU_KELAS',
        title: 'Peringatan Presensi Siswa',
        message: 'Ananda Budi Santoso (1A) tidak hadir 3 hari berturut-turut. Peringatan WA dikirim ke orang tua.',
        timestamp: now,
        read: false,
        type: 'ABSENSI_3HARI',
        linkTab: 'guru-presensi'
      }
    ];
  } else if (role === 'UKS') {
    return [
      {
        id: 'mock-uks-1',
        targetRole: 'UKS',
        title: 'Siswa Masuk Ruang UKS',
        message: 'Siswa Rina (Kelas 2B) mengeluh pusing dan istirahat di tempat tidur UKS.',
        timestamp: now,
        read: false,
        type: 'UKS',
        linkTab: 'uks-pemeriksaan'
      }
    ];
  } else if (role === 'PUSTAKAWAN') {
    return [
      {
        id: 'mock-perpus-1',
        targetRole: 'PUSTAKAWAN',
        title: 'Buku Terlambat Dikembalikan',
        message: '5 siswa memiliki keterlambatan peminjaman buku modul Matematika melebihi 7 hari.',
        timestamp: now,
        read: false,
        type: 'PERPUS',
        linkTab: 'perpus-sirkulasi'
      }
    ];
  }
  return [];
}
