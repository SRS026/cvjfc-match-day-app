// Keep the screen on during a live game. Silently does nothing where unsupported.
let lock: WakeLockSentinel | null = null;
let wanted = false;

async function acquire() {
  if (!wanted || lock || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
  try {
    lock = await navigator.wakeLock.request('screen');
    lock.addEventListener('release', () => (lock = null));
  } catch {
    /* denied (e.g. low battery mode): carry on without it */
  }
}

// The browser drops the lock whenever the page is hidden; take it back on return.
document.addEventListener('visibilitychange', acquire);

export function keepAwake(on: boolean) {
  wanted = on;
  if (on) acquire();
  else if (lock) {
    lock.release().catch(() => {});
    lock = null;
  }
}
