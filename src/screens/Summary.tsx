import { useEffect, useRef, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { fmt, playerSecs, FULL } from '../clock';
import { STATUS_COLOURS, status } from '../logic';
import { renderSummary, shareOrSave } from '../screenshot';
import { actions } from '../store';
import type { Live } from '../types';

export function Summary({ live }: { live: Live }) {
  // The clock is paused here, so these numbers are final.
  const now = Date.now();
  const rows = live.players
    .map(p => ({ id: p.id, name: p.name, secs: playerSecs(live, p.id, now) }))
    .sort((a, b) => Math.floor(a.secs) - Math.floor(b.secs) || a.id - b.id);

  const blob = useRef<Blob | null>(null);
  const [toast, setToast] = useState(false);
  const [busy, setBusy] = useState(false);

  // Render the PNG as soon as the summary opens, so "Yes" can share instantly.
  useEffect(() => {
    let alive = true;
    renderSummary(rows).then(b => alive && (blob.current = b), () => {});
    return () => void (alive = false);
  }, []);

  const yes = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const b = blob.current ?? (await renderSummary(rows));
      const result = await shareOrSave(b, `cvjfc-game${live.game}-full-time.png`);
      if (result === 'cancelled') return; // stay on the pop-up; they can try again or tap No
      setToast(true);
      setTimeout(actions.endGame, 1500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="screen" style={{ position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 5, background: 'var(--yellow)' }}>
      <Header title="Full Time Summary" />
      <div class="summary-card">
        {rows.map(r => (
          <div class="sum-row" key={r.id}>
            <div class="n">{r.name}</div>
            <div class="bar">
              <div style={{ width: Math.min(100, (r.secs / FULL) * 100) + '%', background: STATUS_COLOURS[status(r.secs)].bg }} />
            </div>
            <div class="t">{fmt(r.secs)}</div>
          </div>
        ))}
      </div>

      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)', pointerEvents: 'none' }} />
      <div class="shot-panel" role="dialog" aria-modal="true" aria-label="Take Screenshot?">
        <h2>Take Screenshot?</h2>
        <div class="grid2">
          <button class="btn sbtn" style={{ background: 'var(--green)', color: '#fff' }} onClick={yes}>
            Yes
          </button>
          <button class="btn sbtn" style={{ background: 'var(--black)', color: '#fff' }} onClick={actions.endGame}>
            No
          </button>
        </div>
        <button class="btn sbtn" style={{ border: '3px solid var(--black)', fontSize: '20px', minHeight: '52px', padding: '10px' }} onClick={actions.cancelEnd}>
          Back to Game
        </button>
      </div>

      {toast && (
        <div class="toast-wrap">
          <div class="toast">Screenshot Saved</div>
        </div>
      )}
    </div>
  );
}
