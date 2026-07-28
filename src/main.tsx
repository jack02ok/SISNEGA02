import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerServiceWorker } from './services/offlineStorage.ts';
import { processSyncQueue } from './services/indexedDbSyncQueue.ts';

// Register service worker for offline access & process offline queue
registerServiceWorker();
processSyncQueue().catch(e => console.warn('Boot offline queue process:', e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
