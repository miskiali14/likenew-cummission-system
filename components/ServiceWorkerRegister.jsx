'use client';

import { useEffect } from 'react';

// Registers the PWA service worker so the app becomes installable
// ("Add to Home Screen") on phones. Fails silently — this is enhancement,
// not something the app depends on to function.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return null;
}
