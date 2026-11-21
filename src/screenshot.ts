import { fmt } from './clock';
import { FULL } from './clock';
import { STATUS_COLOURS, status } from './logic';

export interface SummaryRow {
  name: string;
  secs: number;
}

const W = 390; // design width; drawn at 3x for a crisp phone image
const SCALE = 3;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

/**
 * Draws the Full Time Summary as a PNG, matching the on-screen layout.
 * Drawn directly (no DOM capture library) so it's small, offline and reliable.
 */
export async function renderSummary(rows: SummaryRow[]): Promise<Blob> {
  await document.fonts.load('800 20px "Baloo 2"').catch(() => {});
  const font = (px: number) => `800 ${px}px "Baloo 2", system-ui, sans-serif`;

  const rowH = 30, gap = 12, pad = 18;
  const cardTop = 18 + 70 + 12;
  const cardH = pad * 2 + rows.length * rowH + Math.max(0, rows.length - 1) * gap;
  const H = cardTop + cardH + 18;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SCALE, SCALE);

  ctx.fillStyle = '#FFC629';
  ctx.fillRect(0, 0, W, H);

  try {
    const logo = await loadImage('./logo.png');
    const lh = 70, lw = (logo.width / logo.height) * lh;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowOffsetY = 3;
    ctx.drawImage(logo, 16, 18, lw, lh);
    ctx.restore();
    ctx.fillStyle = '#141414';
    ctx.font = font(28);
    ctx.textBaseline = 'middle';
    ctx.fillText('Full Time Summary', 16 + lw + 12, 18 + lh / 2 + 2);
  } catch {
    ctx.fillStyle = '#141414';
    ctx.font = font(28);
    ctx.textBaseline = 'middle';
    ctx.fillText('Full Time Summary', 16, 18 + 35);
  }

  ctx.fillStyle = '#fff';
  rrect(ctx, 16, cardTop, W - 32, cardH, 18);

  const left = 16 + 16, right = W - 16 - 16;
  const nameW = 88, timeW = 56;
  const barX = left + nameW + 10, barW = right - timeW - 10 - barX;
  rows.forEach((r, i) => {
    const y = cardTop + pad + i * (rowH + gap);
    const mid = y + rowH / 2 + 1;
    ctx.fillStyle = '#141414';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = font(19);
    ctx.fillText(ellipsize(ctx, r.name, nameW), left, mid);

    ctx.fillStyle = '#F1F1F1';
    rrect(ctx, barX, y, barW, rowH, 8);
    const w = Math.min(1, r.secs / FULL) * barW;
    if (w > 0) {
      ctx.fillStyle = STATUS_COLOURS[status(r.secs)].bg;
      rrect(ctx, barX, y, Math.max(w, 8), rowH, 8);
    }

    ctx.fillStyle = '#141414';
    ctx.textAlign = 'right';
    ctx.font = font(22);
    ctx.fillText(fmt(r.secs), right, mid);
  });

  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
}

export type ShareResult = 'shared' | 'saved' | 'cancelled';

/**
 * Must be called straight from the tap handler (no awaits before it), because
 * iOS only allows navigator.share() during the user's tap. That's why the PNG
 * is rendered ahead of time, when the summary opens.
 */
export async function shareOrSave(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Full Time Summary' });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // Share failed for another reason: fall through to download.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'saved';
}
