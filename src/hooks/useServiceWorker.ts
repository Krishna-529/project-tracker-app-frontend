// useServiceWorker.ts
import { useEffect } from 'react';

export function useServiceWorker(onUpdateAvailable?: () => void) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // If plugin injected the register, navigator.serviceWorker.ready still works.
    navigator.serviceWorker.ready
      .then(reg => {
        // listen for waiting SW (new version installed but waiting to activate)
        if (reg.waiting) {
          onUpdateAvailable?.();
        }

        reg.addEventListener('updatefound', () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener('statechange', () => {
            if (newSW.state === 'installed') {
              // installed -> a new SW exists (either first install or update)
              onUpdateAvailable?.();
            }
          });
        });
      })
      .catch(() => {});
  }, [onUpdateAvailable]);
}
