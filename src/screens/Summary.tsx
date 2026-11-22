import { useEffect, useState } from 'preact/hooks';
import { Header } from '../components/Header';
import { fmt, playerSecs, FULL } from '../clock';
import { STATUS_COLOURS, status } from '../logic';
import { drawSummary, prepareSummary, shareOrSave } from '../screenshot';
import { actions, getState } from '../store';
import type { Live } from '../types';

function summaryRows(live: Live, now: number) {
  return live.players
    .map(p => ({ id: p.id, name: p.name, secs: playerSecs(live, p.id, now) }))
    .sort((a, b) => Math.floor(a.secs) - Math.floor(b.secs) || a.id - b.id);
}

export function Summary({ live, now }: { live: Live; now: number }) {
  // The clock keeps running behind this screen until Yes or No, so these update live.
  const rows = summaryRows(live, now);
  const [toast, setToast] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load the font and logo now, so "Yes" can draw and share without waiting.
  useEffect(() => void prepareSummary(), []);

  // Yes: stop the clock, then draw and share in the same tap (iOS requires it).
  const yes = async () => {
    if (busy) return;
    setBusy(true);
    try {
      actions.stopClock();
      const final = getState().live!;
      const blob = drawSummary(summaryRows(final, Date.now()));
      const result = await shareOrSave(blob, `cvjfc-game${final.game}-full-time.png`);
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
