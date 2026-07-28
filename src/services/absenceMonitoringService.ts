import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { Absensi, Siswa, AppSettings } from '../types';
import { sendFonnteWA } from './fonnteService';
import { logAuditEvent } from './auditService';

export interface AbsenceAlertResult {
  siswaId: string;
  namaSiswa: string;
  namaOrtu: string;
  noWaOrtu: string;
  totalAbsen: number;
  statusTerakhir: string;
  alreadyNotified: boolean;
  notifiedAt?: string;
}

export async function checkAndTriggerAbsenceAlerts(
  siswaList: Siswa[],
  absensiList: Absensi[],
  settings?: AppSettings
): Promise<AbsenceAlertResult[]> {
  const results: AbsenceAlertResult[] = [];

  // Group absensi by siswaId
  const absBySiswa: Record<string, Absensi[]> = {};
  absensiList.forEach((abs) => {
    if (!absBySiswa[abs.siswaId]) absBySiswa[abs.siswaId] = [];
    absBySiswa[abs.siswaId].push(abs);
  });

  for (const siswa of siswaList) {
    if (siswa.status !== 'AKTIF') continue;

    const studentAbs = absBySiswa[siswa.id] || [];
    // Count absences (SAKIT, IZIN, ALPA, DI_UKS)
    const nonHadirAbs = studentAbs.filter(a => a.status !== 'HADIR');

    if (nonHadirAbs.length >= 3) {
      // Sort by date descending
      nonHadirAbs.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      
      // Check if already notified for >= 3 days alert
      const hasBeenNotified = nonHadirAbs.some(a => a.waNotified === true);

      const alertInfo: AbsenceAlertResult = {
        siswaId: siswa.id,
        namaSiswa: siswa.nama,
        namaOrtu: siswa.namaOrtu || 'Orang Tua / Wali',
        noWaOrtu: siswa.noWaOrtu || '',
        totalAbsen: nonHadirAbs.length,
        statusTerakhir: nonHadirAbs[0]?.status || 'ALPA',
        alreadyNotified: hasBeenNotified,
      };

      // If not notified yet and parent WA is available
      if (!hasBeenNotified && siswa.noWaOrtu) {
        const schoolName = settings?.schoolName || 'SD Negeri 1';
        const message = `[PERINGATAN KETIDAKHADIRAN - ${schoolName}]\n\nYth. Bapak/Ibu ${siswa.namaOrtu},\nAnanda *${siswa.nama}* tercatat tidak hadir sekolah sebanyak *${nonHadirAbs.length} hari*.\nMohon dapat segera menghubungi Wali Kelas untuk koordinasi dan konfirmasi alasan ketidakhadiran.\n\nTerima kasih,\nManajemen ${schoolName}`;

        const waRes = await sendFonnteWA({
          target: siswa.noWaOrtu,
          message,
          token: settings?.fonnteToken
        });

        alertInfo.alreadyNotified = true;
        alertInfo.notifiedAt = new Date().toISOString();

        // Mark latest absensi records as waNotified
        for (const record of nonHadirAbs) {
          if (record.id) {
            try {
              await updateDoc(doc(db, 'absensi', record.id), { waNotified: true });
            } catch (e) {
              console.warn('Failed marking absensi waNotified:', e);
            }
          }
        }

        // Create Header Notification in Firestore
        try {
          await addDoc(collection(db, 'notifications'), {
            targetRole: 'GURU_KELAS',
            title: '⚠️ Peringatan Ketidakhadiran Siswa',
            message: `Siswa ${siswa.nama} tercatat tidak hadir ${nonHadirAbs.length} hari. Pesan WA otomatis telah dikirim ke orang tua.`,
            timestamp: new Date().toISOString(),
            read: false,
            type: 'ABSENSI_3HARI',
            linkTab: 'guru-presensi'
          });
        } catch (e) {
          console.warn('Failed adding notification to firestore:', e);
        }

        // Log Audit Event
        await logAuditEvent(
          'Sistem Pemantauan Presensi',
          'ADMIN',
          'ABSENSI_ALERT',
          `Peringatan otomatis WA dikirim ke orang tua ${siswa.nama} (${siswa.noWaOrtu}) karena tidak hadir ${nonHadirAbs.length} hari`,
          { siswaId: siswa.id, totalAbsen: nonHadirAbs.length, waResponse: waRes }
        );
      }

      results.push(alertInfo);
    }
  }

  return results;
}
