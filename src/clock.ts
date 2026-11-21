import type { Live } from './types';

export const BLOCK = 600; // 10 minutes
export const FULL = 2400; // 40 minutes

/** The next 10-minute mark after `c` (capped at full time). */
export function nextStop(c: number): number {
  return Math.min(FULL, (Math.floor(c / BLOCK + 1e-6) + 1) * BLOCK);
}

/**
 * Seconds run since the clock was last settled, worked out from timestamps.
 * Capped at the auto-stop target, so time after a 10-minute mark is never
 * counted, even if the phone slept through it. Never negative (clock changes).
 */
export function runSecs(live: Live, now: number): number {
  const { clock } = live;
  if (clock.runningSince === null) return 0;
  const raw = (now - clock.runningSince) / 1000;
  return Math.max(0, Math.min(clock.target - clock.base, raw));
}

export function gameSecs(live: Live, now: number): number {
  return live.clock.base + runSecs(live, now);
}

export function playerSecs(live: Live, id: number, now: number): number {
  const p = live.players.find(x => x.id === id)!;
  return p.secs + (p.pos ? runSecs(live, now) : 0);
}

export function isRunning(live: Live): boolean {
  return live.clock.runningSince !== null;
}

/**
 * Fold the time run so far into the clock and every on-pitch player's minutes.
 * Mutates `live`. If the target has been reached, the clock stops there.
 * Called before every action, on each tick, and when the app reopens.
 */
export function settle(live: Live, now: number): void {
  const { clock } = live;
  if (clock.runningSince === null) return;
  const d = runSecs(live, now);
  for (const p of live.players) if (p.pos) p.secs += d;
  clock.base += d;
  if (clock.base >= clock.target - 1e-6) {
    clock.base = clock.target;
    clock.runningSince = null;
  } else {
    clock.runningSince = now;
  }
}

export function fmt(secs: number): string {
  const t = Math.floor(secs + 1e-6);
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
}
