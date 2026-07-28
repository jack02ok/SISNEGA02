import { Siswa, Rombel } from '../types';

const SISWA_CACHE_KEY = 'sisfo_sd_cached_siswa';
const ROMBEL_CACHE_KEY = 'sisfo_sd_cached_rombel';

export function registerServiceWorker() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('ServiceWorker registration failed:', err);
        });
    });
  }
}

export function cacheStudentRoster(siswaList: Siswa[]) {
  try {
    if (siswaList && siswaList.length > 0) {
      localStorage.setItem(SISWA_CACHE_KEY, JSON.stringify(siswaList));
      localStorage.setItem(`${SISWA_CACHE_KEY}_updated`, new Date().toISOString());
    }
  } catch (e) {
    console.warn('Failed to cache student roster to localStorage', e);
  }
}

export function getCachedStudentRoster(): Siswa[] {
  try {
    const raw = localStorage.getItem(SISWA_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw) as Siswa[];
    }
  } catch (e) {
    console.warn('Failed to parse cached student roster', e);
  }
  return [];
}

export function cacheRombelList(rombelList: Rombel[]) {
  try {
    if (rombelList && rombelList.length > 0) {
      localStorage.setItem(ROMBEL_CACHE_KEY, JSON.stringify(rombelList));
    }
  } catch (e) {
    console.warn('Failed to cache rombel list', e);
  }
}

export function getCachedRombelList(): Rombel[] {
  try {
    const raw = localStorage.getItem(ROMBEL_CACHE_KEY);
    if (raw) {
      return JSON.parse(raw) as Rombel[];
    }
  } catch (e) {
    console.warn('Failed to parse cached rombel list', e);
  }
  return [];
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeOnlineStatus(onChange: (online: boolean) => void) {
  const handleOnline = () => onChange(true);
  const handleOffline = () => onChange(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}
