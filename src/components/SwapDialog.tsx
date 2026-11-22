import { fmt } from '../clock';
import type { Player } from '../types';

export interface SwapDraft {
  manual: boolean;
  bench: number;
  target: number;
  /** Minutes frozen when the pop-up opened, so the open dropdown doesn't flicker. */
  snap: Record<number, number>;
}

export function SwapDialog(props: {
  draft: SwapDraft;
  players: Player[];
  onChange: (d: SwapDraft) => void;
  onCancel: () => void;
  onSwap: () => void;
}) {
  const { draft, players } = props;
  const t = (id: number) => fmt(draft.snap[id] ?? 0);
  // Bring on: fewest minutes first. Swap with: most minutes first. (Ties: list order.)
  const mins = (id: number) => Math.floor(draft.snap[id] ?? 0);
  const bench = players.filter(p => !p.pos).sort((a, b) => mins(a.id) - mins(b.id) || a.id - b.id);
  const pitch = players.filter(p => p.pos).sort((a, b) => mins(b.id) - mins(a.id) || a.id - b.id);
  const benchP = players.find(p => p.id === draft.bench);

  return (
    <div class="overlay" role="dialog" aria-modal="true" aria-label="Swap players">
      <div class="dialog">
        {draft.manual ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label for="bringOn">Bring on</label>
            <select
              id="bringOn"
              value={String(draft.bench)}
              onChange={e => props.onChange({ ...draft, bench: Number((e.target as HTMLSelectElement).value) })}
            >
              {bench.map(p => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({t(p.id)})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <h2>
            {benchP?.name} <span style={{ fontSize: '16px', color: '#555' }}>({t(draft.bench)})</span>
          </h2>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label for="swapWith">Swap with</label>
          <select
            id="swapWith"
            value={String(draft.target)}
            onChange={e => props.onChange({ ...draft, target: Number((e.target as HTMLSelectElement).value) })}
          >
            {pitch.map(p => (
              <option key={p.id} value={String(p.id)}>
                {p.name} · {p.pos} ({t(p.id)})
              </option>
            ))}
          </select>
        </div>
        <div class="grid2">
          <button class="btn dbtn outline" onClick={props.onCancel}>
            Cancel
          </button>
          <button class="btn dbtn" style={{ background: 'var(--green)', color: '#fff' }} onClick={props.onSwap}>
            Swap
          </button>
        </div>
      </div>
    </div>
  );
}
