import { BLOCK, FULL, fmt, gameSecs, isRunning, nextStop, playerSecs } from './clock';
import { POSITIONS, SLOTS, type GameNo, type Live, type Player, type Pos } from './types';

// ---------- Colour status ----------

export type Status = 'green' | 'orange' | 'red';

/** Green under 25:00, orange 25:00–30:00, red over 30:00 (whole seconds, as displayed). */
export function status(secs: number): Status {
  const s = Math.floor(secs + 1e-6);
  if (s > 30 * 60) return 'red';
  if (s >= 25 * 60) return 'orange';
  return 'green';
}

export const STATUS_COLOURS: Record<Status, { bg: string; border: string; text: string; ring: string }> = {
  green: { bg: '#157A42', border: '#157A42', text: '#157A42', ring: '#34C46F' },
  orange: { bg: '#F28C28', border: '#D96F0E', text: '#B35400', ring: '#F28C28' },
  red: { bg: '#C62034', border: '#C62034', text: '#C62034', ring: '#FF5A6E' }
};

// ---------- Squad → players ----------

/** Blank sub = not here today (left out). Blank starter = "Player N". */
export function playersFromSquad(names: string[]): Player[] {
  const out: Player[] = [];
  names.forEach((raw, i) => {
    const name = raw.trim();
    const isSub = i >= POSITIONS.length;
    if (isSub && !name) return;
    out.push({ id: i, name: name || 'Player ' + (i + 1), pos: isSub ? null : (SLOTS[i] as Pos), secs: 0, since: 0 });
  });
  return out;
}

// ---------- Suggested changes ----------

export interface Ranked {
  id: number;
  name: string;
  pos: Pos | null;
  secs: number; // whole seconds played
  stint: number; // seconds in current spell on (or off) the pitch
}

export function ranked(live: Live, now: number): Ranked[] {
  const clock = gameSecs(live, now);
  return live.players.map(p => ({
    id: p.id,
    name: p.name,
    pos: p.pos,
    secs: Math.floor(playerSecs(live, p.id, now) + 1e-6),
    stint: clock - p.since
  }));
}

/**
 * Who should come OFF first: most minutes, then longest current stint on the
 * pitch, then list order. Returns <0 if `a` should go off before `b`.
 */
export function offOrder(a: Ranked, b: Ranked): number {
  return b.secs - a.secs || b.stint - a.stint || a.id - b.id;
}

/**
 * Who should come ON first: fewest minutes, then longest current stint on the
 * bench, then list order. Returns <0 if `a` should come on before `b`.
 */
export function onOrder(a: Ranked, b: Ranked): number {
  return a.secs - b.secs || b.stint - a.stint || a.id - b.id;
}

export interface Change {
  onId: number;
  onName: string;
  offId: number;
  offName: string;
  pos: Pos;
}

/** One swap per bench player: most-minutes off, fewest-minutes on, paired in order. */
export function suggestions(live: Live, now: number): Change[] {
  const all = ranked(live, now);
  const pitch = all.filter(p => p.pos).sort(offOrder);
  const bench = all.filter(p => !p.pos).sort(onOrder);
  const k = Math.min(pitch.length, bench.length);
  return pitch.slice(0, k).map((off, i) => ({
    onId: bench[i].id,
    onName: bench[i].name,
    offId: off.id,
    offName: off.name,
    pos: off.pos as Pos
  }));
}

// ---------- Stops and gating ----------

export function atStop(live: Live, now: number): boolean {
  const c = gameSecs(live, now);
  return !isRunning(live) && c > 0 && Math.abs(c / BLOCK - Math.round(c / BLOCK)) < 1e-6;
}

export function isFullTime(live: Live, now: number): boolean {
  return gameSecs(live, now) >= FULL - 1e-6;
}

/** Approve is only live at a 10/20/30 stop, once per stop. */
export function canApprove(live: Live, now: number): boolean {
  if (!atStop(live, now) || isFullTime(live, now)) return false;
  return !live.approvedAt.includes(Math.round(gameSecs(live, now)));
}

/** OFF NEXT: at a 10/20/30 stop until approved, and from 35:00 to 40:00 for rolling subs. */
export function showOffNext(live: Live, now: number): boolean {
  const c = gameSecs(live, now);
  return canApprove(live, now) || (c >= 35 * 60 && c < FULL - 1e-6);
}

export function suggestionHeader(live: Live, now: number): { label: string; countdown: string } {
  const c = gameSecs(live, now);
  if (isFullTime(live, now)) return { label: 'Full time', countdown: '0:00' };
  if (canApprove(live, now)) return { label: `Changes Now (${Math.round(c / 60)}:00)`, countdown: '0:00' };
  const stop = nextStop(c);
  return { label: `Suggested Changes @ ${stop / 60}:00`, countdown: fmt(Math.max(0, stop - c)) };
}

export function otherGame(g: GameNo): GameNo {
  return g === 1 ? 2 : 1;
}
