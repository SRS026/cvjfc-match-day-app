import { useRef, useState } from 'preact/hooks';
import { POSITIONS, type Pos } from '../types';

type Pt = { x: number; y: number }; // fractions of the pitch box (0–1)

/** Where each position's circle sits on the board (circle centre). */
const HOME: Record<Pos, Pt> = {
  FWD: { x: 0.5, y: 0.12 },
  LW: { x: 0.185, y: 0.32 },
  RW: { x: 0.815, y: 0.32 },
  CB: { x: 0.5, y: 0.54 },
  GK: { x: 0.5, y: 0.79 }
};
const BALL_HOME: Pt = { x: 0.9, y: 0.93 };

export interface Piece {
  id: number;
  name: string;
  pos: Pos;
  ring: string;
  offNext: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Tactics board: drag players anywhere on the pitch, plus a football.
 * Dropping a player nearest another position's spot gives them that position
 * (whoever had it takes the dragged player's old one), so the circle letters change.
 */
export function Tactics({ pieces, onMove }: { pieces: Piece[]; onMove: (id: number, pos: Pos) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Record<number, Pt>>({});
  const [ball, setBall] = useState<Pt>(BALL_HOME);
  const [drag, setDrag] = useState<{ id: number | 'ball'; off: Pt } | null>(null);

  const rect = () => box.current!.getBoundingClientRect();
  const toPt = (e: PointerEvent): Pt => {
    const r = rect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const at = (p: Piece) => spots[p.id] ?? HOME[p.pos];

  /** Nearest position spot, measured in real pixels (the pitch is taller than it is wide). */
  const nearest = (pt: Pt): Pos => {
    const r = rect();
    let best: Pos = 'CB', d = Infinity;
    for (const pos of POSITIONS) {
      const h = HOME[pos];
      const dd = ((pt.x - h.x) * r.width) ** 2 + ((pt.y - h.y) * r.height) ** 2;
      if (dd < d) (d = dd), (best = pos);
    }
    return best;
  };

  const handlers = (id: number | 'ball', cur: Pt) => ({
    onPointerDown: (e: PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      const p = toPt(e);
      setDrag({ id, off: { x: p.x - cur.x, y: p.y - cur.y } }); // keep the grab point under the finger
    },
    onPointerMove: (e: PointerEvent) => {
      if (!drag || drag.id !== id) return;
      const p = toPt(e);
      const next = { x: clamp(p.x - drag.off.x, 0.05, 0.95), y: clamp(p.y - drag.off.y, 0.04, 0.88) };
      if (id === 'ball') setBall(next);
      else setSpots(s => ({ ...s, [id]: next }));
    },
    onPointerUp: () => {
      if (!drag || drag.id !== id) return;
      setDrag(null);
      if (id !== 'ball') {
        const piece = pieces.find(p => p.id === id);
        const pos = nearest(spots[id] ?? cur);
        if (piece && pos !== piece.pos) onMove(id, pos);
      }
    },
    onPointerCancel: () => setDrag(null)
  });

  return (
    <div class="tactics" ref={box}>
      {pieces.map(p => {
        const pt = at(p);
        const gk = p.pos === 'GK';
        const dragging = drag?.id === p.id;
        // While dragging, preview the position they'd take if dropped here.
        const label = dragging && box.current ? nearest(pt) : p.pos;
        return (
          <div
            key={p.id}
            class={'tpiece' + (dragging ? ' dragging' : '')}
            style={{ left: pt.x * 100 + '%', top: pt.y * 100 + '%' }}
            aria-label={`Drag ${p.name}`}
            {...handlers(p.id, pt)}
          >
            <div
              class="disc"
              style={{
                background: gk ? 'var(--black)' : 'var(--yellow)',
                color: gk ? 'var(--yellow)' : 'var(--black)',
                borderColor: p.ring
              }}
            >
              {label}
            </div>
            <div class="tag">{p.name}</div>
            {p.offNext && <div class="offnext">OFF NEXT</div>}
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
