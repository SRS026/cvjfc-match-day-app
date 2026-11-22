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
          <circle cx="12" cy="12" r="11" fill="#fff" stroke="#141414" stroke-width="1.4" />
          <polygon points="12,8 15.8,10.8 14.4,15.2 9.6,15.2 8.2,10.8" fill="#141414" />
          <g stroke="#141414" stroke-width="1.3" stroke-linecap="round">
            <path d="M12 8V1.6M15.8 10.8l6-2M14.4 15.2l4 5.2M9.6 15.2l-4 5.2M8.2 10.8l-6-2" />
          </g>
        </svg>
      </div>
    </div>
  );
}
