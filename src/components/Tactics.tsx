import { useEffect, useRef, useState } from 'preact/hooks';
import type { Pos } from '../types';

type Pt = { x: number; y: number }; // fractions of the pitch box (0–1)

/** Where each position's circle sits on the board (circle centre). */
const HOME: Record<Pos, Pt> = {
  FWD: { x: 0.5, y: 0.12 },
  LW: { x: 0.185, y: 0.32 },
  RW: { x: 0.815, y: 0.32 },
  CB: { x: 0.5, y: 0.59 },
  GK: { x: 0.5, y: 0.85 }
};
/** Room (px) a piece needs below its circle centre: circle and name tag (no OFF NEXT on the board). */
const BELOW = 72;
/** Gap (px) needed between the CB centre and the GK centre so their labels don't touch. */
const CB_GK_GAP = 104;

/**
 * Start spots for a pitch of height h (px). GK and CB sit well back, but on short
 * pitches (small phones) they're pulled up just enough that nothing is cut off or overlaps.
 */
function homeFor(h: number): Record<Pos, Pt> {
  if (!h) return HOME;
  const gk = Math.min(HOME.GK.y, (h - BELOW) / h);
  const cb = Math.min(HOME.CB.y, gk - CB_GK_GAP / h);
  return { ...HOME, GK: { x: 0.5, y: gk }, CB: { x: 0.5, y: cb } };
}
const BALL_HOME: Pt = { x: 0.9, y: 0.93 };

export interface Piece {
  id: number;
  name: string;
  pos: Pos;
  ring: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Tactics board: each piece is a position (GK, CB, …) that can be dragged anywhere,
 * plus a football. Pieces never move on their own: a single tap opens "Move to…",
 * and the players' names swap between the two position pieces, which stay put.
 */
/** Finger travel (px) before a press counts as a drag rather than a tap. */
const TAP_SLOP = 8;

export function Tactics({
  pieces,
  onTap
}: {
  pieces: Piece[];
  /** A single press (no drag) on a player: opens the "Move to…" menu. */
  onTap: (id: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Board spots belong to positions, so a piece stays put when a different player takes it.
  const [spots, setSpots] = useState<Partial<Record<Pos, Pt>>>({});
  const [ball, setBall] = useState<Pt>(BALL_HOME);
  const [drag, setDrag] = useState<{ id: Pos | 'ball'; off: Pt; x0: number; y0: number; moved: boolean } | null>(null);

  // Track the pitch height so the start spots fit any phone.
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const home = homeFor(h);

  const rect = () => box.current!.getBoundingClientRect();
  const toPt = (e: PointerEvent): Pt => {
    const r = rect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const at = (pos: Pos) => spots[pos] ?? home[pos];

  const handlers = (id: Pos | 'ball', cur: Pt) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone: the drag still works without capture */
      }
      const p = toPt(e);
      // Keep the grab point under the finger; remember where the press started.
      setDrag({ id, off: { x: p.x - cur.x, y: p.y - cur.y }, x0: e.clientX, y0: e.clientY, moved: false });
    },
    onPointerMove: (e: PointerEvent) => {
      if (!drag || drag.id !== id) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < TAP_SLOP) return; // still a tap
        setDrag({ ...drag, moved: true });
      }
      const p = toPt(e);
      const next = { x: clamp(p.x - drag.off.x, 0.05, 0.95), y: clamp(p.y - drag.off.y, 0.04, 0.88) };
      if (id === 'ball') setBall(next);
      else setSpots(s => ({ ...s, [id]: next }));
    },
    onPointerUp: () => {
      if (!drag || drag.id !== id) return;
      setDrag(null);
      if (id === 'ball') return;
      // Dragging only moves the piece; a single tap opens "Move to…" for its player.
      const piece = pieces.find(p => p.pos === id);
      if (!drag.moved && piece) onTap(piece.id);
    },
    onPointerCancel: () => setDrag(null)
  });

  return (
    <div class="tactics" ref={box}>
      {pieces.map(p => {
        const pt = at(p.pos);
        const gk = p.pos === 'GK';
        const dragging = drag?.id === p.pos;
        return (
          <div
            key={p.pos}
            class={'tpiece' + (dragging ? ' dragging' : '')}
            style={{ left: pt.x * 100 + '%', top: pt.y * 100 + '%' }}
            aria-label={`Drag ${p.name}, or tap to change position`}
            {...handlers(p.pos, pt)}
          >
            <div
              class="disc"
              style={{
                background: gk ? 'var(--black)' : 'var(--yellow)',
                color: gk ? 'var(--yellow)' : 'var(--black)',
                borderColor: p.ring
              }}
            >
              {p.pos}
            </div>
            <div class="tag">{p.name}</div>
          </div>
        );
      })}

      <div
        class={'ball' + (drag?.id === 'ball' ? ' dragging' : '')}
        style={{ left: ball.x * 100 + '%', top: ball.y * 100 + '%' }}
        aria-label="Drag the ball"
        {...handlers('ball', ball)}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
          {/* Classic 32-panel ball (black pentagons, white hexagons), drawn from the real geometry. */}
          <defs>
            <clipPath id="ball-clip">
              <circle cx="12" cy="12" r="11" />
            </clipPath>
          </defs>
          <circle cx="12" cy="12" r="11" fill="#fff" />
          <g clip-path="url(#ball-clip)" stroke="#141414" stroke-width="0.6" stroke-linejoin="round">
            <polygon points="7.56,22.05 9.78,21.84 14.22,21.84 16.44,22.05 14.22,22.26 9.78,22.26" fill="#fff" />
            <polygon points="2.60,7.23 3.97,4.48 3.97,5.83 2.60,9.93 1.23,12.68 1.23,11.32" fill="#fff" />
            <polygon points="20.03,5.83 20.03,4.48 21.40,7.23 22.77,11.32 22.77,12.68 21.40,9.93" fill="#fff" />
            <polygon points="7.56,1.95 9.78,1.74 7.56,4.14 3.97,5.83 3.97,4.48" fill="#141414" />
            <polygon points="14.22,1.74 16.44,1.95 20.03,4.48 20.03,5.83 16.44,4.14" fill="#141414" />
            <polygon points="2.60,16.77 4.82,16.56 8.41,19.09 9.78,21.84 7.56,22.05 3.97,19.52" fill="#fff" />
            <polygon points="15.59,19.09 19.18,16.56 21.40,16.77 20.03,19.52 16.44,22.05 14.22,21.84" fill="#fff" />
            <polygon points="1.23,12.68 2.60,9.93 4.82,12.33 4.82,16.56 2.60,16.77" fill="#141414" />
            <polygon points="19.18,12.33 21.40,9.93 22.77,12.68 21.40,16.77 19.18,16.56" fill="#141414" />
            <polygon points="9.78,1.74 14.22,1.74 16.44,4.14 14.22,6.54 9.78,6.54 7.56,4.14" fill="#fff" />
            <polygon points="8.41,19.09 12.00,17.39 15.59,19.09 14.22,21.84 9.78,21.84" fill="#141414" />
            <polygon points="3.97,5.83 7.56,4.14 9.78,6.54 8.41,10.63 4.82,12.33 2.60,9.93" fill="#fff" />
            <polygon points="14.22,6.54 16.44,4.14 20.03,5.83 21.40,9.93 19.18,12.33 15.59,10.63" fill="#fff" />
            <polygon points="4.82,12.33 8.41,10.63 12.00,13.16 12.00,17.39 8.41,19.09 4.82,16.56" fill="#fff" />
            <polygon points="12.00,13.16 15.59,10.63 19.18,12.33 19.18,16.56 15.59,19.09 12.00,17.39" fill="#fff" />
            <polygon points="9.78,6.54 14.22,6.54 15.59,10.63 12.00,13.16 8.41,10.63" fill="#141414" />
          </g>
          <circle cx="12" cy="12" r="11" fill="none" stroke="#141414" stroke-width="1.2" />
        </svg>
      </div>
    </div>
  );
}
