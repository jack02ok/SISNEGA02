import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditLog, Role } from '../types';

export async function logAuditEvent(
  actorName: string,
  actorRole: Role,
  actionType: AuditLog['actionType'],
  description: string,
  metadata?: Record<string, any>
) {
  try {
    const logData = {
      timestamp: new Date().toISOString(),
      serverTime: serverTimestamp(),
      actorName: actorName || 'Sistem',
      actorRole: actorRole || 'ADMIN',
      actionType,
      description,
      metadata: metadata || {}
    };
    await addDoc(collection(db, 'auditLogs'), logData);
  } catch (e) {
    console.error('Error logging audit event to Firestore:', e);
  }
}
