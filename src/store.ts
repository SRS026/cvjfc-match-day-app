import { useEffect, useState } from 'preact/hooks';
import { FULL, gameSecs, isRunning, nextStop, settle } from './clock';
import { canApprove, otherGame, playersFromSquad, suggestions } from './logic';
import type { AppState, GameNo, Live, Pos, View } from './types';

const KEY = 'cvjfc-matchday-v1';

const blankSquad = () => Array<string>(8).fill('');

function fresh(): AppState {
  return { v: 1, tab: 1, screen: 'home', squads: { 1: blankSquad(), 2: blankSquad() }, live: null };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as AppState;
      if (s && s.v === 1 && s.squads) return s;
    }
  } catch {
    /* corrupt or blocked storage: start clean */
  }
  return fresh();
}

let state: AppState = load();
const listeners = new Set<() => void>();

/**
 * Every change goes through here: copy, change, save, redraw.
 * localStorage.setItem is synchronous, so the save has finished before the
 * phone can lock or the tab can close. That's why it's used instead of IndexedDB.
 */
function update(fn: (draft: AppState, now: number) => void): void {
  const draft = structuredClone(state);
  const now = Date.now();
  if (draft.live) settle(draft.live, now);
  fn(draft, now);
  state = draft;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode: keep running in memory */
  }
  listeners.forEach(l => l());
}

// If the app is open in two tabs (or a stale tab wakes up), adopt the newest save
// instead of overwriting it with old in-memory state.
window.addEventListener('storage', e => {
  if (e.key !== KEY) return;
  state = load();
  listeners.forEach(l => l());
});

export function getState(): AppState {
  return state;
}

export function useAppState(): AppState {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force(n => n + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return state;
}

/** Was a game live when the app was opened? (for the "Resume Game N?" prompt) */
export const resumedGame: GameNo | null = state.live ? state.live.game : null;

// ---------- Home ----------

export const actions = {
  setTab(tab: GameNo) {
    update(s => void (s.tab = tab));
  },

  setName(i: number, name: string) {
    update(s => void (s.squads[s.tab][i] = name));
  },

  /** Picking another slot in row i's dropdown swaps the two names; rows stay put. */
  setSlot(i: number, j: number) {
    if (i === j) return;
    update(s => {
      const sq = s.squads[s.tab];
      [sq[i], sq[j]] = [sq[j], sq[i]];
    });
  },

  kickOff(g: GameNo) {
    update(s => {
      if (s.live && s.live.game !== g) return; // other game is running
      if (!s.live) {
        s.live = {
          game: g,
          players: playersFromSquad(s.squads[g]),
          clock: { base: 0, runningSince: null, target: nextStop(0) },
          approvedAt: [],
          view: 'normal',
          ending: false
        };
      }
      s.screen = 'live';
    });
  },

  goHome() {
    update(s => {
      s.screen = 'home';
      if (s.live) s.tab = s.live.game;
    });
  },

  // ---------- Live ----------

  setView(view: View) {
    liveUpdate(l => void (l.view = view));
  },

  startClock() {
    liveUpdate((l, now) => {
      if (isRunning(l) || l.clock.base >= FULL) return;
      l.clock.target = nextStop(l.clock.base);
      l.clock.runningSince = now;
    });
  },

  stopClock() {
    liveUpdate(l => void (l.clock.runningSince = null));
  },

  /** Sub comes on in the pitch player's position; pitch player goes to the bench. */
  swap(benchId: number, pitchId: number) {
    liveUpdate((l, now) => swapIn(l, benchId, pitchId, now));
  },

  /** Pitch View: move a player to another position, swapping with whoever is there. */
  movePos(id: number, pos: Pos) {
    liveUpdate(l => {
      const mover = l.players.find(p => p.id === id);
      if (!mover || !mover.pos || mover.pos === pos) return;
      const other = l.players.find(p => p.pos === pos);
      if (other) other.pos = mover.pos;
      mover.pos = pos;
    });
  },

  approve() {
    liveUpdate((l, now) => {
      if (!canApprove(l, now)) return;
      for (const c of suggestions(l, now)) swapIn(l, c.onId, c.offId, now);
      l.approvedAt.push(Math.round(gameSecs(l, now)));
    });
  },

  /** End Game: pause the clock and show Full Time Summary + Take Screenshot. */
  askEnd() {
    liveUpdate(l => {
      l.clock.runningSince = null;
      l.ending = true;
    });
  },

  cancelEnd() {
    liveUpdate(l => void (l.ending = false));
  },

  /** Clear the game, re-enable both Kick Offs, open the other game's tab. */
  endGame() {
    update(s => {
      if (!s.live) return;
      const g = s.live.game;
      s.squads[g] = blankSquad();
      s.live = null;
      s.screen = 'home';
      s.tab = otherGame(g);
    });
  },

  /** Called by the ticker: banks time and auto-stops at a 10-minute mark. */
  tick() {
    const l = state.live;
    if (!l || !isRunning(l)) return;
    if (gameSecs(l, Date.now()) >= l.clock.target - 1e-6) update(() => {});
  }
};

function liveUpdate(fn: (l: Live, now: number) => void) {
  update((s, now) => {
    if (s.live) fn(s.live, now);
  });
}

function swapIn(l: Live, benchId: number, pitchId: number, now: number) {
  const b = l.players.find(p => p.id === benchId);
  const p = l.players.find(x => x.id === pitchId);
  if (!b || !p || b.pos || !p.pos) return;
  const at = gameSecs(l, now);
  b.pos = p.pos;
  p.pos = null;
  b.since = at;
  p.since = at;
}
