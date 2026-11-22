import { Header } from '../components/Header';
import { actions } from '../store';
import { SLOTS, type AppState, type GameNo } from '../types';

const isSub = (i: number) => i >= 5;

export function Home({ state }: { state: AppState }) {
  const { tab, squads, live } = state;
  const names = squads[tab];

  const kick = (g: GameNo) => {
    const locked = !!live && live.game !== g;
    return (
      <button
        class="btn kick"
        aria-disabled={locked}
        style={{ opacity: locked ? 0.4 : 1 }}
        onClick={() => !locked && actions.kickOff(g)}
      >
        <span>{live?.game === g ? 'Return to' : 'Kick Off'}</span>
        <span>Game {g}</span>
      </button>
    );
  };

  return (
    <div class="screen">
      <Header title="CVJFC Match Day App" />

      <div class="tabs" role="tablist" style={{ gap: '6px' }}>
        {([1, 2] as GameNo[]).map(g => (
          <button
            key={g}
            role="tab"
            aria-selected={tab === g}
            class="btn tab"
            style={{ fontSize: '17px', lineHeight: 1, ...(tab === g ? { background: 'var(--yellow)', color: 'var(--black)' } : { color: '#fff' }) }}
            onClick={() => actions.setTab(g)}
          >
            Game {g}
          </button>
        ))}
      </div>

      <div class="rows">
        {SLOTS.map((slot, i) => {
          const fg = isSub(i) ? '#141414' : '#fff';
          return (
            <div class="row" key={tab + '-' + i}>
              <div class="slot">
                <select
                  aria-label={`Position for row ${i + 1}`}
                  value={slot}
                  style={{ background: isSub(i) ? '#EEEEEE' : '#157A42', color: fg }}
                  onChange={e => actions.setSlot(i, SLOTS.indexOf((e.target as HTMLSelectElement).value as never))}
                >
                  {SLOTS.map(s => (
                    <option value={s} key={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden="true">
                  <path d="M1 1.5 L6 6.5 L11 1.5" fill="none" stroke={fg} stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </div>
              <input
                aria-label={`${slot} name`}
                value={names[i]}
                placeholder="Type Player Name"
                autoComplete="off"
                autoCapitalize="words"
                spellcheck={false}
                enterKeyHint={i < 7 ? 'next' : 'done'}
                onInput={e => actions.setName(i, (e.target as HTMLInputElement).value)}
              />
            </div>
          );
        })}
      </div>

      <div class="spacer" />
      <div class="grid2">
        {kick(1)}
        {kick(2)}
      </div>
      <div class="spacer" />
    </div>
  );
}
