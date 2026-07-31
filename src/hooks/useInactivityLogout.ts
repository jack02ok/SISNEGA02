import { useEffect, useRef, useState, useCallback } from 'react';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes warning threshold
const THROTTLE_MS = 2000; // Throttle activity listener calls

interface UseInactivityLogoutOptions {
  timeoutMs?: number;
  enabled?: boolean;
  onLogout: () => void | Promise<void>;
}

export function useInactivityLogout({
  timeoutMs = INACTIVITY_TIMEOUT_MS,
  enabled = true,
  onLogout
}: UseInactivityLogoutOptions) {
  const lastActivityRef = useRef<number>(Date.now());
  const lastThrottledRef = useRef<number>(0);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(Math.floor(timeoutMs / 1000));
  const isLoggingOutRef = useRef<boolean>(false);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarningModal) {
      setShowWarningModal(false);
    }
  }, [showWarningModal]);

  // Activity Event Handler with throttling
  useEffect(() => {
    if (!enabled) return;

    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastThrottledRef.current > THROTTLE_MS) {
        lastThrottledRef.current = now;
        lastActivityRef.current = now;
        setShowWarningModal(prev => (prev ? false : prev));
      }
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel'
    ];

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [enabled]);

  // Periodic Timer Check (every 1 second for accurate countdown and smooth alert)
  useEffect(() => {
    if (!enabled) {
      setShowWarningModal(false);
      return;
    }

    isLoggingOutRef.current = false;
    lastActivityRef.current = Date.now();

    const intervalId = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      const remainingMs = Math.max(0, timeoutMs - elapsed);
      const remainingSec = Math.ceil(remainingMs / 1000);

      setRemainingSeconds(remainingSec);

      // Show warning modal when 2 minutes or less remain
      if (remainingMs <= WARNING_THRESHOLD_MS && remainingMs > 0) {
        setShowWarningModal(true);
      } else if (remainingMs > WARNING_THRESHOLD_MS && showWarningModal) {
        setShowWarningModal(false);
      }

      // Trigger Auto-Logout if time elapsed
      if (remainingMs <= 0 && !isLoggingOutRef.current) {
        isLoggingOutRef.current = true;
        clearInterval(intervalId);
        setShowWarningModal(false);
        
        console.warn('[Auto-Logout] User logged out due to 30 minutes of inactivity.');
        alert('🔒 Sesi Anda telah berakhir secara otomatis karena tidak ada aktivitas selama 30 menit demi keamanan data sekolah.');
        onLogout();
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [enabled, timeoutMs, onLogout]);

  return {
    remainingSeconds,
    showWarningModal,
    resetTimer,
    extendSession: resetTimer
  };
}
