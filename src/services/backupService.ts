import { db } from '../lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore';

export interface DatabaseSnapshot {
  version: string;
  exportedAt: string;
  schoolName: string;
  collectionsCount: number;
  totalRecords: number;
  data: {
    siswa: any[];
    absensi: any[];
    jurnalKBM: any[];
    penilaian: any[];
    inventaris: any[];
    bukuPerpus: any[];
    transaksiPerpus: any[];
    uksScreening: any[];
    kalenderAkademik: any[];
    users: any[];
    auditLogs: any[];
    settings: any[];
  };
}

export interface BackupHistoryItem {
  id: string;
  timestamp: string;
  totalRecords: number;
  collectionsCount: number;
  fileName: string;
  triggeredBy: string;
  type: 'MANUAL' | 'SCHEDULED_DAILY';
  status: 'SUCCESS' | 'FAILED';
}

/**
 * Perform full database export to a downloadable JSON file
 */
export async function createDatabaseSnapshot(
  schoolName: string = 'SD Negeri Nusantara 01',
  triggeredBy: string = 'Admin Operator',
  isScheduled: boolean = false
): Promise<DatabaseSnapshot> {
  const collectionsToExport = [
    'siswa',
    'absensi',
    'jurnalKBM',
    'penilaian',
    'inventaris',
    'bukuPerpus',
    'transaksiPerpus',
    'uksScreening',
    'kalenderAkademik',
    'users',
    'auditLogs',
    'settings'
  ];

  const exportData: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const colName of collectionsToExport) {
    try {
      const snap = await getDocs(collection(db, colName));
      const records: any[] = [];
      snap.forEach(d => {
        records.push({ id: d.id, ...d.data() });
      });
      exportData[colName] = records;
      totalRecords += records.length;
    } catch (err) {
      console.warn(`Failed to export collection ${colName}:`, err);
      exportData[colName] = [];
    }
  }

  const timestamp = new Date().toISOString();
  const dateFormatted = timestamp.split('T')[0];
  const fileName = `backup_database_sd_nusantara_${dateFormatted}_${Date.now().toString().slice(-4)}.json`;

  const snapshot: DatabaseSnapshot = {
    version: '2.0.0',
    exportedAt: timestamp,
    schoolName,
    collectionsCount: collectionsToExport.length,
    totalRecords,
    data: exportData as any
  };

  // Record history to Firestore backupSnapshots collection
  try {
    const backupId = `bkp_${Date.now()}`;
    await setDoc(doc(db, 'backupSnapshots', backupId), {
      id: backupId,
      timestamp,
      totalRecords,
      collectionsCount: collectionsToExport.length,
      fileName,
      triggeredBy,
      type: isScheduled ? 'SCHEDULED_DAILY' : 'MANUAL',
      status: 'SUCCESS',
      summary: {
        siswa: exportData.siswa?.length || 0,
        absensi: exportData.absensi?.length || 0,
        penilaian: exportData.penilaian?.length || 0,
        inventaris: exportData.inventaris?.length || 0,
        bukuPerpus: exportData.bukuPerpus?.length || 0
      }
    });
  } catch (err) {
    console.warn("Could not save backup metadata record:", err);
  }

  return snapshot;
}

/**
 * Trigger browser file download of JSON snapshot
 */
export function downloadSnapshotJSON(snapshot: DatabaseSnapshot, customFileName?: string) {
  const dateFormatted = new Date(snapshot.exportedAt).toISOString().split('T')[0];
  const fileName = customFileName || `backup_database_sd_nusantara_${dateFormatted}.json`;

  const jsonString = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
