import React, { useState, useEffect } from 'react';
import { subscribeSyncQueue, processSyncQueue, SyncQueueItem } from '../services/indexedDbSyncQueue';
import { isOnline, subscribeOnlineStatus } from '../services/offlineStorage';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, HardDriveUpload } from 'lucide-react';

interface OfflineSyncBannerProps {
  moduleName?: string; // e.g., 'Perpustakaan' or 'UKS'
}

export const OfflineSyncBanner: React.FC<OfflineSyncBannerProps> = ({ moduleName }) => {
  const [online, setOnline] = useState<boolean>(isOnline());
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingItems, setPendingItems] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubOnline = subscribeOnlineStatus(status => setOnline(status));
    const unsubQueue = subscribeSyncQueue((count, items) => {
      setPendingCount(count);
      setPendingItems(items);
    });

    return () => {
      unsubOnline();
      unsubQueue();
    };
  }, []);

  const handleManualSync = async () => {
    if (!online) {
      alert('Perangkat Anda masih offline. Hubungkan kembali ke internet untuk melakukan sinkronisasi ke Firestore.');
      return;
    }

    setIsSyncing(true);
    setSyncStatusMsg('Memproses sinkronisasi data IndexedDB ke Firestore...');

    try {
      const res = await processSyncQueue();
      if (res.successCount > 0) {
        setSyncStatusMsg(`✅ Berhasil menyinkronkan ${res.successCount} data offline ke Firestore!`);
      } else if (res.failCount > 0) {
        setSyncStatusMsg(`⚠️ Sinkronisasi selesai: ${res.failCount} data belum berhasil dikirim.`);
      } else {
        setSyncStatusMsg('Semua data offline sudah tersinkronisasi.');
      }
    } catch (e: any) {
      setSyncStatusMsg(`❌ Terjadi kesalahan: ${e?.message || 'Gagal sinkronisasi'}`);
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncStatusMsg(null), 5000);
    }
  };

  if (online && pendingCount === 0 && !syncStatusMsg) {
    return null; // Clean & quiet when online with 0 pending items
  }

  return (
    <div className="mb-4 p-4 rounded-2xl border transition-all shadow-xs bg-gradient-to-r from-slate-900 to-slate-800 text-white border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl flex items-center justify-center ${online ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
            {online ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5 animate-pulse" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${online ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                {online ? 'ONLINE' : 'MODE OFFLINE'}
              </span>
              {moduleName && (
                <span className="text-xs text-slate-400 font-medium">Modul {moduleName}</span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-200 mt-1">
              {!online ? (
                <span>Koneksi terputus. Data {moduleName ? moduleName : 'yang diinput'} disimpan aman di <strong>IndexedDB lokal</strong>.</span>
              ) : pendingCount > 0 ? (
                <span>Terdapat <strong>{pendingCount} data offline</strong> di IndexedDB yang belum tersinkron ke Firestore.</span>
              ) : (
                <span>Koneksi internet aktif & data tersinkronisasi real-time.</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <span className="px-3 py-1 bg-amber-500/20 text-amber-200 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 font-mono">
              <HardDriveUpload className="w-3.5 h-3.5" />
              {pendingCount} Antrean
            </span>
          )}

          {online && pendingCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
            </button>
          )}
        </div>
      </div>

      {syncStatusMsg && (
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs font-semibold text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncStatusMsg}</span>
        </div>
      )}

      {/* Item detail preview if offline items exist */}
      {pendingItems.length > 0 && (
        <div className="mt-3 pt-2 border-t border-slate-700/60 text-[11px] text-slate-300 space-y-1">
          <p className="text-slate-400 font-medium">Data tersimpan di IndexedDB:</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {pendingItems.slice(0, 4).map((item) => (
              <span key={item.id} className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 font-mono">
                {item.collectionName} ({item.operation}) - {item.id.slice(-6)}
              </span>
            ))}
            {pendingItems.length > 4 && (
              <span className="text-slate-400 self-center">+{pendingItems.length - 4} lainnya</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
