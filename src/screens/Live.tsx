import { useEffect, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { SwapDialog, type SwapDraft } from '../components/SwapDialog';
import { Tactics } from '../components/Tactics';
import { fmt, gameSecs, isRunning, playerSecs } from '../clock';
import { STATUS_COLOURS, canApprove, isFullTime, showOffNext, status, suggestionHeader, suggestions } from '../logic';
import { actions } from '../store';
import { blowWhistle } from '../whistle';
import { POSITIONS, type Live as LiveT, type Pos } from '../types';

// Formation, as % of the pitch box: FWD top, wingers, CB, GK by the bottom goal.
/** GK row's top edge (its circle) on the pitch. */
const GK_TOP = '79.5%';
/** CB circle + name + OFF NEXT is 122px tall; keep it at least 10px clear of the GK circle. */
const CB_CLEAR = 132;

const SPOTS: Record<Exclude<Pos, 'GK'>, { left: string; top: string }> = {
  FWD: { left: '50%', top: '3%' },
  LW: { left: '18.5%', top: '23.5%' },
  RW: { left: '81.5%', top: '23.5%' },
  // 46% down on roomy pitches; on shorter ones, moved up just enough to stay clear of the GK.
  CB: { left: '50%', top: `min(46%, calc(${GK_TOP} - ${CB_CLEAR}px))` }
};

export function Live({ live, now, hideTimes, muted }: { live: LiveT; now: number; hideTimes: boolean; muted: boolean }) {
  // Clock button on = tactics board: times hidden, changes box collapsed, players draggable.
  const tactics = hideTimes;
  const [swap, setSwap] = useState<SwapDraft | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  // Stop Clock asks first, since the clock stops itself at every 10:00 mark anyway.
  const [askStop, setAskStop] = useState(false);

  const pitchView = live.view === 'pitch';
  const clock = gameSecs(live, now);
  const running = isRunning(live);
  useEffect(() => {
    if (!running) setAskStop(false); // clock stopped itself at 10:00: drop the question
  }, [running]);
  const fullTime = isFullTime(live, now);
  const secs = (id: number) => playerSecs(live, id, now);
  const bySecsDesc = (a: { id: number }, b: { id: number }) =>
    Math.floor(secs(b.id)) - Math.floor(secs(a.id)) || a.id - b.id;

  const onPitch = live.players.filter(p => p.pos);
  const bench = live.players.filter(p => !p.pos);
  const changes = suggestions(live, now);
  const offIds = showOffNext(live, now) ? changes.map(c => c.offId) : [];
  const decideOk = canApprove(live, now); // Approve / Reject
  const head = suggestionHeader(live, now);

  const snap = () => Object.fromEntries(live.players.map(p => [p.id, secs(p.id)]));
  const openTileSwap = (benchId: number) => {
    // Default "Swap with" to whoever the app would take off for this sub.
    const pair = changes.find(c => c.onId === benchId);
    const most = onPitch.slice().sort(bySecsDesc)[0];
    setSwap({ manual: false, bench: benchId, target: pair?.offId ?? most.id, snap: snap() });
  };
  const openManual = () => {
    if (!bench.length) return;
    const first = changes[0];
    setSwap({
      manual: true,
      bench: first?.onId ?? bench[0].id,
      target: first?.offId ?? onPitch[0].id,
      snap: snap()
    });
  };

  const theme = pitchView
    ? { bg: 'var(--pitch-bg)', fg: '#fff', clockBg: 'var(--yellow)', clockFg: 'var(--black)', toggle: 'var(--pitch-panel)' }
    : { bg: 'var(--yellow)', fg: 'var(--black)', clockBg: 'var(--black)', clockFg: 'var(--yellow)', toggle: 'var(--black)' };
  const on = { background: 'var(--yellow)', color: 'var(--black)' };
  const off = { color: '#fff' };

  const menuPlayer = live.players.find(p => p.id === menu && p.pos);

  return (
    <div class="screen" style={{ background: theme.bg, color: theme.fg, maxWidth: 'none' }}>
      <div style={{ width: '100%', maxWidth: '448px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'inherit', flexGrow: 1 }}>
        <Header title={`Game ${live.game}`} onLogo={actions.goHome} size={26}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              class={'btn glass glass-inline' + (pitchView ? '' : ' glass-dark')}
              aria-label={muted ? 'Whistle off: tap to turn on' : 'Whistle on: tap to turn off'}
              aria-pressed={muted}
              onClick={() => {
                // Turning it back on blows once, so the coach can check the volume.
                if (muted) blowWhistle(1);
                actions.toggleMute();
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M11 5L6 9H2.5v6H6l5 4V5z" />
                <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                {muted ? <path d="M3 3l18 18" /> : <path d="M18.5 5.5a9 9 0 0 1 0 13" />}
              </svg>
            </button>
            <div class="clock" style={{ background: theme.clockBg, color: theme.clockFg }} aria-label="Game clock">
              {fmt(clock)}
            </div>
          </div>
        </Header>

        <div class="tabs" style={{ background: theme.toggle }}>
          <button class="btn tab" style={{ fontSize: '17px', lineHeight: 1, ...(pitchView ? off : on) }} onClick={() => actions.setView('normal')}>
            Normal View
          </button>
          <button class="btn tab" style={{ fontSize: '17px', lineHeight: 1, ...(pitchView ? on : off) }} onClick={() => actions.setView('pitch')}>
            Pitch View
          </button>
        </div>

        {!pitchView ? (
          <>
            <div class="section">Pitch</div>
            <div class="grid2">
              {onPitch
                .slice()
                .sort(bySecsDesc)
                .map(p => (
                  <div key={p.id} class="tile" style={{ background: STATUS_COLOURS[status(secs(p.id))].bg, color: '#fff' }}>
                    <span class="n">{p.name}</span>
                    <span class="t">{fmt(secs(p.id))}</span>
                  </div>
                ))}
            </div>

            {bench.length > 0 && (
              <>
                <div class="section">Bench</div>
                <div class="grid2">
                  {bench
                    .slice()
                    .sort(bySecsDesc)
                    .map(p => {
                      const c = STATUS_COLOURS[status(secs(p.id))];
                      return (
                        <button
                          key={p.id}
                          class="btn tile bench-tile"
                          style={{ borderColor: c.border, textAlign: 'left' }}
                          aria-label={`Swap ${p.name} onto the pitch`}
                          onClick={() => openTileSwap(p.id)}
                        >
                          <span class="n">{p.name}</span>
                          <span class="t" style={{ color: c.text }}>
                            {fmt(secs(p.id))}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </>
            )}

            <div class="spacer" />
            <div class="grid2" style={{ gap: '12px' }}>
              <button
                class="btn big"
                aria-disabled={running || fullTime}
                style={{ background: 'var(--green)', opacity: running || fullTime ? 0.45 : 1 }}
                onClick={actions.startClock}
              >
                Start Clock
              </button>
              <button
                class="btn big"
                aria-disabled={!running}
                style={{ background: 'var(--red)', opacity: running ? 1 : 0.45 }}
                onClick={() => running && setAskStop(true)}
              >
                Stop Clock
              </button>
            </div>
            <button class="btn end" onClick={actions.askEnd}>
              End Game
            </button>
          </>
        ) : (
          <>
            <div class={'pitch ' + (tactics ? 'pitch-big' : 'pitch-fill')}>
              <div class="line" style={{ left: 0, right: 0, top: '50%', borderWidth: '3px 0 0 0' }} />
              <div class="line" style={{ left: '50%', top: '50%', width: '80px', height: '80px', margin: '-40px 0 0 -40px', borderRadius: '50%' }} />
              <div class="line" style={{ left: '50%', bottom: '-3px', width: '150px', height: '60px', marginLeft: '-75px' }} />
              <div class="line" style={{ left: '50%', top: '-3px', width: '150px', height: '60px', marginLeft: '-75px' }} />

              <button
                class="btn glass"
                aria-label={tactics ? 'Turn off tactics board' : 'Tactics board (hide times)'}
                aria-pressed={hideTimes}
                onClick={actions.toggleTimes}
              >
                {tactics ? (
                  // In tactics mode: a clock, to go back to the normal view with times.
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="8.5" />
                    <path d="M12 7.5V12l3 2" />
                  </svg>
                ) : (
                  // Normal view: a tactics-board icon (X, O and a play arrow).
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />
                    <circle cx="17.5" cy="17.5" r="3" />
                    <path d="M7 12.5c0 4.5 2.5 6 6.5 5.5" stroke-dasharray="2 2.6" />
                    <path d="M11 4.5c3.5 0 6 1.5 6.5 5" />
                    <path d="M15.2 8.4l2.3 1.6 1.7-2.2" />
                  </svg>
                )}
              </button>

              {tactics && (
                <Tactics
                  pieces={onPitch.map(p => ({
                    id: p.id,
                    name: p.name,
                    pos: p.pos as Pos,
                    ring: STATUS_COLOURS[status(secs(p.id))].ring
                  }))}
                  onTap={setMenu}
                />
              )}

              {!tactics && onPitch.map(p => {
                const pos = p.pos as Pos;
                const gk = pos === 'GK';
                const t = secs(p.id);
                const place = gk ? { left: 'calc(50% - 34px)', top: GK_TOP } : SPOTS[pos];
                return (
                  <div key={p.id} class={'spot ' + (gk ? 'spot-row' : 'spot-col')} style={place}>
                    <button
                      class="btn disc"
                      aria-label={`Change ${p.name}'s position`}
                      style={{
                        background: gk ? 'var(--black)' : 'var(--yellow)',
                        color: gk ? 'var(--yellow)' : 'var(--black)',
                        borderColor: STATUS_COLOURS[status(t)].ring
                      }}
                      onClick={() => setMenu(p.id)}
                    >
                      {pos}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <div class="tag">{hideTimes ? p.name : `${p.name} ${fmt(t)}`}</div>
                      {offIds.includes(p.id) && (
                        // GK: hang evenly either side of a short name so the name itself never moves.
                        <div class="offnext" style={gk ? { margin: '0 -40px' } : undefined}>
                          OFF NEXT
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {menuPlayer && (
                <div class="overlay in-pitch" role="dialog" aria-modal="true">
                  <div class="dialog" style={{ padding: '16px' }}>
                    <div style={{ fontSize: '20px', lineHeight: 1.1 }}>Move {menuPlayer.name} to…</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
                      {POSITIONS.map(pos => {
                        const cur = menuPlayer.pos === pos;
                        return (
                          <button
                            key={pos}
                            class="btn"
                            style={{
                              borderRadius: '10px',
                              padding: '12px 0',
                              minHeight: '48px',
                              fontSize: '15px',
                              background: cur ? 'var(--black)' : 'var(--yellow)',
                              color: cur ? 'var(--yellow)' : 'var(--black)'
                            }}
                            onClick={() => {
                              actions.movePos(menuPlayer.id, pos);
                              setMenu(null);
                            }}
                          >
                            {pos}
                          </button>
                        );
                      })}
                    </div>
                    <button class="btn dbtn outline" style={{ minHeight: '44px', padding: '10px', fontSize: '15px' }} onClick={() => setMenu(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!tactics && (
            <div class="plan">
              <div class="plan-head">
                <div style={{ fontSize: '15px' }}>{head.label}</div>
                <div style={{ fontSize: '22px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{head.countdown}</div>
              </div>
              <div class="plan-body">
                <div class="plan-list">
                  {fullTime ? null : changes.length === 0 ? (
                    <div class="plan-empty">{bench.length ? 'No Changes Needed' : 'No Subs'}</div>
                  ) : (
                    changes.map(c => (
                      <div key={c.onId} class="plan-row">
                        <span style={{ color: '#7EE2A8' }}>{c.onName} On</span>
                        <span style={{ color: '#FF8A95' }}>{c.offName} Off</span>
                      </div>
                    ))
                  )}
                </div>
                <div class="plan-actions">
                  <button
                    class="btn decide"
                    aria-disabled={!decideOk}
                    style={{ background: 'var(--yellow)', color: 'var(--black)', opacity: decideOk ? 1 : 0.4 }}
                    onClick={actions.approve}
                  >
                    Approve
                  </button>
                  <button
                    class="btn decide"
                    aria-disabled={!decideOk}
                    style={{ color: '#fff', opacity: decideOk ? 1 : 0.4 }}
                    onClick={actions.reject}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
            )}

            <button
              class="btn pbtn subs"
              aria-disabled={!bench.length}
              style={{ color: '#fff', width: '100%', fontSize: '22px', opacity: bench.length ? 1 : 0.4 }}
              onClick={openManual}
            >
              Make Subs
            </button>
          </>
        )}
      </div>

      {swap && (
        <SwapDialog
          draft={swap}
          players={live.players}
          onChange={setSwap}
          onCancel={() => setSwap(null)}
          onSwap={() => {
            actions.swap(swap.bench, swap.target);
            setSwap(null);
          }}
        />
      )}

      {/* Hidden again if the clock reaches a 10:00 mark and stops on its own while this is open. */}
      {askStop && running && (
        <div class="overlay" role="dialog" aria-modal="true" aria-label="Stop the clock?">
          <div class="dialog">
            <h2 style={{ fontSize: '22px' }}>Clock will always auto-stop at 10 min intervals. Are you sure you want to continue?</h2>
            <div class="grid2">
              <button
                class="btn dbtn"
                style={{ background: 'var(--red)', color: '#fff', fontSize: '20px' }}
                onClick={() => {
                  actions.stopClock();
                  setAskStop(false);
                }}
              >
                Yes
              </button>
              <button class="btn dbtn outline" style={{ fontSize: '20px' }} onClick={() => setAskStop(false)}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
