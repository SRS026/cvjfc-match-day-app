import { BLOCK, FULL, fmt, gameSecs, isRunning, playerSecs } from './clock';
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

// ---------- Change points ----------

/** Play stops at these (clock auto-stops; Approve button). */
export const STOPPAGES = [10 * 60, 20 * 60, 30 * 60];
/** Rolling changes: the clock keeps running; OFF NEXT is a prompt for the coaches. */
export const ROLLING = [25 * 60, 35 * 60];
const POINTS = [...STOPPAGES, ...ROLLING].sort((a, b) => a - b);
const ROLLING_WINDOW = 5 * 60; // 25:00–30:00 and 35:00–40:00

/** A swap must gain at least this much fairness, so a few seconds' difference never triggers one. */
export const MIN_GAIN = 60;

/**
 * Whistle blows due as the clock moves from `prev` to `cur` (game seconds):
 * 3 at the stops (10, 20, 30, 40 min), 2 at the rolling changes (25, 35 min), 0 otherwise.
 */
export function whistleBlows(prev: number, cur: number): number {
  let blows = 0;
  for (const mark of [...STOPPAGES, FULL]) if (prev < mark - 1e-6 && cur >= mark - 1e-6) blows = 3;
  for (const mark of ROLLING) if (prev < mark - 1e-6 && cur >= mark - 1e-6) blows = Math.max(blows, 2);
  return blows;
}

export function atStop(live: Live, now: number): boolean {
  const c = gameSecs(live, now);
  return !isRunning(live) && c > 0 && Math.abs(c / BLOCK - Math.round(c / BLOCK)) < 1e-6;
}

export function isFullTime(live: Live, now: number): boolean {
  return gameSecs(live, now) >= FULL - 1e-6;
}

/** At a 10/20/30 stop that hasn't been approved yet. */
function pendingStop(live: Live, now: number): boolean {
  if (!atStop(live, now) || isFullTime(live, now)) return false;
  return !live.approvedAt.includes(Math.round(gameSecs(live, now)));
}

/** The rolling point (25:00 or 35:00) whose window we're in, if any. */
function rollingNow(c: number): number | null {
  return ROLLING.find(r => c >= r - 1e-6 && c < r + ROLLING_WINDOW - 1e-6) ?? null;
}

function nextPoint(c: number): number {
  return POINTS.find(p => p > c + 1e-6) ?? FULL;
}

/**
 * Which change the suggestions are for, and when it happens:
 * now (at a stop awaiting approval, or inside a rolling window), or the next point.
 */
function planTarget(live: Live, now: number): number {
  return changeMoment(live, now) !== null ? gameSecs(live, now) : nextPoint(gameSecs(live, now));
}

/** Inside a 25:00 / 35:00 rolling window that hasn't been approved or rejected yet. */
function pendingRolling(live: Live, now: number): number | null {
  const r = rollingNow(gameSecs(live, now));
  return r !== null && !live.approvedAt.includes(r) ? r : null;
}

/**
 * The change moment awaiting a decision (its game-second key), or null:
 * an unanswered 10/20/30 stop, or an unanswered 25:00 / 35:00 rolling window.
 * Approve or Reject records this key in approvedAt, so each moment is decided once.
 */
export function changeMoment(live: Live, now: number): number | null {
  if (pendingStop(live, now)) return Math.round(gameSecs(live, now));
  return pendingRolling(live, now);
}

/**
 * Most-minutes off, fewest-minutes on, paired in order, but only where the swap
 * makes things fairer: by the time of the change, the child coming off must have
 * played at least MIN_GAIN more than the child coming on. Pointless swaps are left out.
 */
export function suggestions(live: Live, now: number): Change[] {
  const all = ranked(live, now);
  const pitch = all.filter(p => p.pos).sort(offOrder);
  const bench = all.filter(p => !p.pos).sort(onOrder);
  // Everyone on the pitch gains the same time before the change, so ranking is unaffected;
  // only the "does it help?" check needs the projected minutes.
  const ahead = Math.max(0, planTarget(live, now) - gameSecs(live, now));
  const out: Change[] = [];
  for (let i = 0; i < Math.min(pitch.length, bench.length); i++) {
    const off = pitch[i], on = bench[i];
    if (off.secs + ahead - on.secs < MIN_GAIN) break; // later pairs are even closer
    out.push({ onId: on.id, onName: on.name, offId: off.id, offName: off.name, pos: off.pos as Pos });
  }
  return out;
}

// ---------- Gating ----------

/**
 * Approve / Reject are live at a 10/20/30 stop or in a 25:00 / 35:00 rolling window,
 * once per moment, and only when there's a change worth making.
 */
export function canApprove(live: Live, now: number): boolean {
  return changeMoment(live, now) !== null && suggestions(live, now).length > 0;
}

/** OFF NEXT shows exactly while a change is waiting for Approve or Reject. */
export function showOffNext(live: Live, now: number): boolean {
  return canApprove(live, now);
}

export function suggestionHeader(live: Live, now: number): { label: string; countdown: string } {
  const c = gameSecs(live, now);
  if (isFullTime(live, now)) return { label: 'Full Time', countdown: '0:00' };
  const pending = suggestions(live, now).length > 0;
  const next = nextPoint(c);
  if (pending && pendingStop(live, now)) return { label: `Stoppage Changes Now (${Math.round(c / 60)}:00)`, countdown: '0:00' };
  const r = pendingRolling(live, now);
  if (pending && r !== null) return { label: `Rolling Changes Now (${r / 60}:00)`, countdown: fmt(Math.max(0, next - c)) };
  const kind = next >= FULL ? 'Full Time' : ROLLING.includes(next) ? 'Rolling Changes' : 'Stoppage Changes';
  return { label: `${kind} @ ${next / 60}:00`, countdown: fmt(Math.max(0, next - c)) };
}

export function otherGame(g: GameNo): GameNo {
  return g === 1 ? 2 : 1;
}
