import { describe, expect, it } from 'vitest';
import { gameSecs, nextStop, playerSecs, settle } from '../src/clock';
import { canApprove, playersFromSquad, showOffNext, status, suggestionHeader, suggestions } from '../src/logic';
import type { Live } from '../src/types';

const squad = ['A', 'B', 'C', 'D', 'E', 'S1', 'S2', 'S3'];
const T0 = 1_000_000;

function newLive(names = squad): Live {
  return {
    game: 1,
    players: playersFromSquad(names),
    clock: { base: 0, runningSince: null, target: nextStop(0) },
    approvedAt: [],
    view: 'normal',
    ending: false
  };
}
function start(l: Live, now: number) {
  l.clock.target = nextStop(l.clock.base);
  l.clock.runningSince = now;
}

describe('squad', () => {
  it('drops blank subs and names blank starters Player N', () => {
    const ps = playersFromSquad(['A', '', 'C', 'D', 'E', 'S1', '', '']);
    expect(ps.map(p => p.name)).toEqual(['A', 'Player 2', 'C', 'D', 'E', 'S1']);
    expect(ps.filter(p => !p.pos)).toHaveLength(1);
  });
});

describe('clock', () => {
  it('auto-stops at 10:00 even after a long sleep', () => {
    const l = newLive();
    start(l, T0);
    settle(l, T0 + 25 * 60_000); // phone slept 25 minutes
    expect(l.clock.base).toBe(600);
    expect(l.clock.runningSince).toBeNull();
    expect(playerSecs(l, 0, T0 + 25 * 60_000)).toBe(600);
    expect(playerSecs(l, 5, T0 + 25 * 60_000)).toBe(0); // bench gets nothing
  });

  it('counts time across a sleep before the mark', () => {
    const l = newLive();
    start(l, T0);
    expect(gameSecs(l, T0 + 7 * 60_000)).toBe(420);
  });

  it('next block runs to 20:00', () => {
    const l = newLive();
    l.clock.base = 600;
    start(l, T0);
    expect(l.clock.target).toBe(1200);
  });
});

describe('status colours', () => {
  it('uses the 25 / 30 minute thresholds', () => {
    expect(status(1499)).toBe('green');
    expect(status(1500)).toBe('orange');
    expect(status(1800)).toBe('orange');
    expect(status(1801)).toBe('red');
  });
});

describe('suggestions', () => {
  it('one swap per bench player: most minutes off, fewest on, positions inherited', () => {
    const l = newLive();
    const secs = [600, 500, 400, 300, 200]; // A..E on pitch
    l.players.forEach((p, i) => (p.secs = secs[i] ?? 0));
    l.players[5].secs = 100; // S1
    l.players[6].secs = 0; // S2
    l.players[7].secs = 50; // S3
    const ch = suggestions(l, T0);
    expect(ch.map(c => [c.offName, c.onName, c.pos])).toEqual([
      ['A', 'S2', 'GK'],
      ['B', 'S3', 'CB'],
      ['C', 'S1', 'LW']
    ]);
  });

  it('fewer subs means fewer swaps', () => {
    const l = newLive(['A', 'B', 'C', 'D', 'E', 'S1', '', '']);
    expect(suggestions(l, T0)).toHaveLength(1);
  });

  it('ties: longest stint first, then list order', () => {
    const l = newLive();
    l.clock.base = 600;
    l.players.forEach(p => (p.secs = p.pos ? 600 : 0));
    l.players[3].since = 0; // D on since 0:00
    l.players[0].since = 300; // A came on later (shorter stint)
    l.players[1].since = 300;
    l.players[2].since = 300;
    l.players[4].since = 0; // E on since 0:00
    const off = suggestions(l, T0).map(c => c.offName);
    expect(off).toEqual(['D', 'E', 'A']);
  });
});

describe('approve and OFF NEXT gating', () => {
  it('only at a 10/20/30 stop, once per stop', () => {
    const l = newLive();
    expect(canApprove(l, T0)).toBe(false); // 0:00
    start(l, T0);
    expect(canApprove(l, T0 + 60_000)).toBe(false); // running
    settle(l, T0 + 11 * 60_000);
    expect(canApprove(l, T0)).toBe(true);
    expect(suggestionHeader(l, T0).label).toBe('Changes Now (10:00)');
    l.approvedAt.push(600);
    expect(canApprove(l, T0)).toBe(false);
    expect(suggestionHeader(l, T0)).toEqual({ label: 'Suggested Changes @ 20:00', countdown: '10:00' });
  });

  it('a mid-block injury pause is not a stop', () => {
    const l = newLive();
    l.clock.base = 412;
    expect(canApprove(l, T0)).toBe(false);
    expect(showOffNext(l, T0)).toBe(false);
  });

  it('OFF NEXT shows from 35:00 to 40:00, but not at full time', () => {
    const l = newLive();
    l.clock.base = 35 * 60;
    expect(showOffNext(l, T0)).toBe(true);
    l.clock.base = 2400;
    expect(showOffNext(l, T0)).toBe(false);
    expect(canApprove(l, T0)).toBe(false);
  });
});
