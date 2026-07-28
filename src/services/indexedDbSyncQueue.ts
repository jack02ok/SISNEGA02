import { db } from '../lib/firebase';
import { doc, setDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

export interface SyncQueueItem {
  id: string;
  collectionName: string;
  docId?: string;
  operation: 'SET' | 'UPDATE' | 'ADD';
  payload: any;
  merge?: boolean;
  createdAt: string;
  retryCount: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  lastError?: string;
}

const DB_NAME = 'sisfo_sd_offline_sync_db';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';

type SyncListener = (count: number, items: SyncQueueItem[]) => void;
const syncListeners: Set<SyncListener> = new Set();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('collectionName', 'collectionName', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add an item to IndexedDB offline sync queue
 */
export async function enqueueOfflineRecord(
  collectionName: string,
  operation: 'SET' | 'UPDATE' | 'ADD',
  payload: any,
  docId?: string,
  merge: boolean = true
): Promise<string> {
  const dbInst = await openDB();
  const queueId = `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const item: SyncQueueItem = {
    id: queueId,
    collectionName,
    docId,
    operation,
    payload,
    merge,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'PENDING'
  };

  return new Promise((resolve, reject) => {
    const tx = dbInst.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(item);

    req.onsuccess = () => {
      notifyListeners();
      resolve(queueId);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all pending sync items from IndexedDB
 */
export async function getPendingSyncQueueItems(): Promise<SyncQueueItem[]> {
  try {
    const dbInst = await openDB();
    return new Promise((resolve, reject) => {
      const tx = dbInst.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result as SyncQueueItem[]) || [];
        const pending = items.filter(i => i.status === 'PENDING');
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to read IndexedDB sync queue:', e);
    return [];
  }
}

/**
 * Get count of pending items
 */
export async function getPendingSyncQueueCount(): Promise<number> {
  const pending = await getPendingSyncQueueItems();
  return pending.length;
}

/**
 * Delete a sync item from IndexedDB after successful synchronization
 */
export async function removeQueueItem(id: string): Promise<void> {
  try {
    const dbInst = await openDB();
    return new Promise((resolve, reject) => {
      const tx = dbInst.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => {
        notifyListeners();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Failed to delete item from IndexedDB queue:', e);
  }
}

/**
 * Process the offline sync queue and push pending items to Firestore
 */
export async function processSyncQueue(): Promise<{ successCount: number; failCount: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('[Offline Sync Queue] Device is currently offline. Skipping sync process.');
    return { successCount: 0, failCount: 0 };
  }

  const pendingItems = await getPendingSyncQueueItems();
  if (pendingItems.length === 0) {
    return { successCount: 0, failCount: 0 };
  }

  console.log(`[Offline Sync Queue] Processing ${pendingItems.length} queued offline records...`);

  let successCount = 0;
  let failCount = 0;

  for (const item of pendingItems) {
    try {
      if (item.operation === 'SET') {
        if (!item.docId) throw new Error('docId is required for SET operation');
        await setDoc(doc(db, item.collectionName, item.docId), item.payload, { merge: item.merge ?? true });
      } else if (item.operation === 'UPDATE') {
        if (!item.docId) throw new Error('docId is required for UPDATE operation');
        await updateDoc(doc(db, item.collectionName, item.docId), item.payload);
      } else if (item.operation === 'ADD') {
        if (item.docId) {
          await setDoc(doc(db, item.collectionName, item.docId), item.payload, { merge: true });
        } else {
          await addDoc(collection(db, item.collectionName), item.payload);
        }
      }

      await removeQueueItem(item.id);
      successCount++;
      console.log(`[Offline Sync Queue] Synced item ${item.id} (${item.collectionName}/${item.docId || ''}) to Firestore.`);
    } catch (err: any) {
      failCount++;
      console.warn(`[Offline Sync Queue] Failed to sync item ${item.id}:`, err);
      // Increment retry count
      try {
        const dbInst = await openDB();
        const tx = dbInst.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        item.retryCount = (item.retryCount || 0) + 1;
        item.lastError = err?.message || String(err);
        store.put(item);
      } catch (e) {
        console.warn('Error updating retry count:', e);
      }
    }
  }

  notifyListeners();
  return { successCount, failCount };
}

/**
 * Universal wrapper for Library/UKS records:
 * Tries direct Firestore write if online. If device is offline or write fails due to network error,
 * automatically saves record into IndexedDB sync queue.
 */
export async function saveOrQueueRecord(
  collectionName: string,
  operation: 'SET' | 'UPDATE' | 'ADD',
  payload: any,
  docId?: string,
  merge: boolean = true
): Promise<{ synced: boolean; queueId?: string; error?: string }> {
  const isDeviceOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isDeviceOnline) {
    try {
      if (operation === 'SET') {
        if (!docId) throw new Error('docId required for SET operation');
        await setDoc(doc(db, collectionName, docId), payload, { merge });
      } else if (operation === 'UPDATE') {
        if (!docId) throw new Error('docId required for UPDATE operation');
        await updateDoc(doc(db, collectionName, docId), payload);
      } else if (operation === 'ADD') {
        if (docId) {
          await setDoc(doc(db, collectionName, docId), payload, { merge: true });
        } else {
          await addDoc(collection(db, collectionName), payload);
        }
      }
      return { synced: true };
    } catch (err: any) {
      console.warn(`[saveOrQueueRecord] Network write failed or offline detected. Queueing to IndexedDB:`, err);
      // Fallback to queueing in IndexedDB if write failed due to connection
      const qId = await enqueueOfflineRecord(collectionName, operation, payload, docId, merge);
      return { synced: false, queueId: qId, error: err?.message };
    }
  } else {
    // Device is offline - queue directly to IndexedDB
    const qId = await enqueueOfflineRecord(collectionName, operation, payload, docId, merge);
    return { synced: false, queueId: qId };
  }
}

/**
 * Subscribe to pending sync queue updates
 */
export function subscribeSyncQueue(listener: SyncListener): () => void {
  syncListeners.add(listener);
  // Initial callback
  getPendingSyncQueueItems().then(items => listener(items.length, items));

  return () => {
    syncListeners.delete(listener);
  };
}

async function notifyListeners() {
  const items = await getPendingSyncQueueItems();
  syncListeners.forEach(listener => listener(items.length, items));
}

// Attach automatic listener for window online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Offline Sync Queue] Network connection restored! Auto-triggering processSyncQueue()...');
    processSyncQueue();
  });
}
