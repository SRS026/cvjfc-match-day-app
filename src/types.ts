export type Pos = 'GK' | 'CB' | 'LW' | 'RW' | 'FWD';
export type Slot = Pos | 'Sub 1' | 'Sub 2' | 'Sub 3';
export type GameNo = 1 | 2;
export type View = 'normal' | 'pitch';

/** Fixed slot order on the home screen. Rows never reorder; only names swap. */
export const SLOTS: Slot[] = ['GK', 'CB', 'LW', 'RW', 'FWD', 'Sub 1', 'Sub 2', 'Sub 3'];
export const POSITIONS: Pos[] = ['GK', 'CB', 'LW', 'RW', 'FWD'];

export interface Player {
  /** Home-screen slot index (0–7). Stable, and used as the final tie-break ("list order"). */
  id: number;
  name: string;
  /** Position on the pitch, or null when on the bench. */
  pos: Pos | null;
  /** Seconds played, settled up to clock.base. Live seconds are added on top while running. */
  secs: number;
  /** Game-clock second when this player last went on or came off (for stint length). */
  since: number;
}

export interface Clock {
  /** Game seconds settled so far. */
  base: number;
  /** Wall-clock ms when the current run started, or null when stopped. */
  runningSince: number | null;
  /** The 10-minute mark this run will auto-stop at. */
  target: number;
}

export interface Live {
  game: GameNo;
  players: Player[];
  clock: Clock;
  /** Change moments (stop second, or 1500 / 2100 for rolling) already approved or rejected. */
  approvedAt: number[];
  view: View;
  /** True while the Full Time Summary / Take Screenshot pop-up is showing. */
  ending: boolean;
}

export interface AppState {
  v: 1;
  tab: GameNo;
  screen: 'home' | 'live';
  squads: Record<GameNo, string[]>;
  live: Live | null;
  /** Pitch View: hide each player's minutes (device preference). */
  hideTimes?: boolean;
}
