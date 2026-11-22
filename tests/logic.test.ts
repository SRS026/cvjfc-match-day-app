import { describe, expect, it } from 'vitest';
import { gameSecs, nextStop, playerSecs, settle } from '../src/clock';
import { canApprove, changeMoment, playersFromSquad, showOffNext, status, suggestionHeader, suggestions } from '../src/logic';
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
    expect(suggestionHeader(l, T0).label).toBe('Stoppage Changes Now (10:00)');
    l.approvedAt.push(600);
    expect(canApprove(l, T0)).toBe(false);
    expect(suggestionHeader(l, T0)).toEqual({ label: 'Stoppage Changes @ 20:00', countdown: '10:00' });
  });

  it('stays greyed out at a stop when there are no subs', () => {
    const l = newLive(['A', 'B', 'C', 'D', 'E', '', '', '']);
    l.clock.base = 600;
    expect(canApprove(l, T0)).toBe(false);
    expect(showOffNext(l, T0)).toBe(false);
    expect(suggestionHeader(l, T0).label).toBe('Stoppage Changes @ 20:00');
  });

  it('a mid-block injury pause is not a stop', () => {
    const l = newLive();
    l.clock.base = 412;
    expect(canApprove(l, T0)).toBe(false);
    expect(showOffNext(l, T0)).toBe(false);
  });

  it('OFF NEXT shows in the 35:00 rolling window, but not at full time', () => {
    const l = newLive();
    l.players.forEach(p => (p.secs = p.pos ? 1500 : 1000));
    l.clock.base = 34 * 60;
    expect(showOffNext(l, T0)).toBe(false);
    expect(suggestionHeader(l, T0).label).toBe('Rolling Changes @ 35:00');
    l.clock.base = 35 * 60;
    expect(showOffNext(l, T0)).toBe(true);
    expect(suggestionHeader(l, T0)).toEqual({ label: 'Rolling Changes Now (35:00)', countdown: '5:00' });
    expect(canApprove(l, T0)).toBe(true); // Approve / Reject live in the rolling window
    l.approvedAt.push(2100); // approved or rejected
    expect(canApprove(l, T0)).toBe(false);
    expect(showOffNext(l, T0)).toBe(false);
    expect(suggestionHeader(l, T0).label).toBe('Full Time @ 40:00');
    l.clock.base = 2400;
    expect(showOffNext(l, T0)).toBe(false);
    expect(canApprove(l, T0)).toBe(false);
  });
});

describe('rolling changes and fairness', () => {
  it('skips swaps that would not make things fairer', () => {
    const l = newLive();
    l.clock.base = 1200;
    l.players.forEach(p => ((p.secs = 1200), (p.since = 1000))); // everyone level, short spells
    expect(suggestions(l, T0)).toHaveLength(0);
    expect(canApprove(l, T0)).toBe(false);
  });

  it('Approve / Reject stay greyed out between change moments', () => {
    const l = newLive();
    l.players.forEach(p => (p.secs = p.pos ? 1300 : 900));
    l.clock.base = 1320; // 22:00, between the 20:00 stop and 25:00
    l.approvedAt.push(600, 1200);
    expect(suggestions(l, T0).length).toBeGreaterThan(0); // previewed...
    expect(canApprove(l, T0)).toBe(false); // ...but not yet actionable
    expect(showOffNext(l, T0)).toBe(false);
  });

  it('rejecting at a stop keeps everyone and moves on to the next change', () => {
    const l = newLive();
    l.players.forEach(p => (p.secs = p.pos ? 600 : 0));
    l.clock.base = 600;
    expect(changeMoment(l, T0)).toBe(600);
    l.approvedAt.push(600); // Reject records the moment without swapping
    expect(changeMoment(l, T0)).toBeNull();
    expect(l.players.filter(p => p.pos).map(p => p.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(suggestionHeader(l, T0).label).toBe('Stoppage Changes @ 20:00');
  });

  it('after the 20:00 stop, previews the 25:00 rolling change', () => {
    const l = newLive();
    l.clock.base = 1200;
    l.approvedAt.push(600, 1200);
    expect(suggestionHeader(l, T0)).toEqual({ label: 'Rolling Changes @ 25:00', countdown: '5:00' });
  });

  // Plays a whole game the way the coaches would: approve at each stop,
  // make the suggested swaps at 25:00 and 35:00 while the clock keeps running.
  function playGame(names: string[]) {
    const l = newLive(names);
    let now = T0;
    // Longest unbroken spell each child had on the pitch and on the bench (minutes).
    const longestOn = new Map<number, number>(), longestBench = new Map<number, number>();
    const spell = (p: Live['players'][number], at: number) => {
      const map = p.pos ? longestOn : longestBench;
      map.set(p.id, Math.max(map.get(p.id) ?? 0, (at - p.since) / 60));
    };
    const apply = () => {
      for (const c of suggestions(l, now)) {
        const at = gameSecs(l, now);
        const on = l.players.find(p => p.id === c.onId)!, off = l.players.find(p => p.id === c.offId)!;
        spell(on, at); spell(off, at);
        on.pos = off.pos; off.pos = null; on.since = off.since = at;
      }
    };
    for (let block = 0; block < 4; block++) {
      start(l, now);
      if (block >= 2) {
        now += 5 * 60_000;
        settle(l, now);
        expect(l.clock.runningSince).not.toBeNull(); // clock keeps running at 25:00 / 35:00
        apply();
      }
      now += 20 * 60_000;
      settle(l, now); // auto-stops at the next 10-minute mark
      if (canApprove(l, now)) {
        apply();
        l.approvedAt.push(Math.round(gameSecs(l, now)));
      }
    }
    expect(gameSecs(l, now)).toBe(2400);
    for (const p of l.players) spell(p, 2400);
    const minutes = l.players.map(p => p.secs / 60).sort((a, b) => a - b);
    return { minutes, maxOn: Math.max(...longestOn.values()), maxBench: Math.max(0, ...longestBench.values()) };
  }

  it('8 players: everyone gets 25 minutes, nobody 25 in a row, nobody benched over 10', () => {
    const g = playGame(squad);
    expect(g.minutes).toEqual([25, 25, 25, 25, 25, 25, 25, 25]);
    expect(g.maxOn).toBeLessThan(25);
    expect(g.maxBench).toBeLessThanOrEqual(10);
  });

  it('7 players: everyone within 25–30 minutes, nobody benched over 10', () => {
    const g = playGame(['A', 'B', 'C', 'D', 'E', 'S1', 'S2', '']);
    expect(g.minutes[0]).toBeGreaterThanOrEqual(25);
    expect(g.minutes.at(-1)).toBeLessThanOrEqual(30);
    expect(g.maxBench).toBeLessThanOrEqual(10);
  });

  it('6 players: everyone within 30–35 minutes, nobody benched over 10', () => {
    const g = playGame(['A', 'B', 'C', 'D', 'E', 'S1', '', '']);
    expect(g.minutes[0]).toBeGreaterThanOrEqual(30);
    expect(g.minutes.at(-1)).toBeLessThanOrEqual(35);
    expect(g.maxBench).toBeLessThanOrEqual(10);
  });

  it('3 subs always come on at 10:00', () => {
    const l = newLive();
    l.clock.base = 600;
    l.players.forEach(p => (p.secs = p.pos ? 600 : 0));
    expect(suggestions(l, T0).map(c => c.onName)).toEqual(['S1', 'S2', 'S3']);
  });

  it('a starter still on at 20:00 must come off, even if minutes are level', () => {
    const l = newLive();
    l.clock.base = 1200;
    l.players.forEach(p => (p.secs = 1200)); // level minutes (as if edited)
    for (const p of l.players) p.since = p.pos ? (p.name === 'A' ? 0 : 1000) : 600;
    const ch = suggestions(l, T0);
    expect(ch[0].offName).toBe('A');
  });

  it('a child benched for 10 minutes comes back on, even if minutes are level', () => {
    const l = newLive();
    l.clock.base = 1500;
    l.players.forEach(p => (p.secs = 1200));
    for (const p of l.players) p.since = p.pos ? 1200 : p.name === 'S1' ? 900 : 1200;
    expect(suggestions(l, T0).map(c => c.onName)).toEqual(['S1']);
  });
});

describe('whistle', () => {
  it('3 blows at the stops and full time, 2 at the rolling changes', async () => {
    const { whistleBlows } = await import('../src/logic');
    expect(whistleBlows(599.8, 600)).toBe(3);
    expect(whistleBlows(1199.9, 1200)).toBe(3);
    expect(whistleBlows(1799.75, 1800)).toBe(3);
    expect(whistleBlows(2399.9, 2400)).toBe(3);
    expect(whistleBlows(1499.8, 1500.05)).toBe(2);
    expect(whistleBlows(2099.8, 2100.1)).toBe(2);
  });
  it('silent between marks, and never twice for the same mark', async () => {
    const { whistleBlows } = await import('../src/logic');
    expect(whistleBlows(300, 300.25)).toBe(0);
    expect(whistleBlows(600, 600)).toBe(0); // clock sat on 10:00 after stopping
    expect(whistleBlows(600, 600.25)).toBe(0); // restarted after the stop
    expect(whistleBlows(1500.05, 1500.3)).toBe(0);
  });
});
