import type { ItemState } from '../../shared/items';
import { ring } from './arenaRenderer';
import { getItemType } from '../../shared/items';

const STEEL = '#d8d6ea';
const DARK = '#6d6a85';

/**
 * Shuriken pixel art (étoile à 4 branches) ; `rot` alterne deux orientations
 * pour donner l'impression de rotation pendant le vol.
 */
function shuriken(ctx: CanvasRenderingContext2D, x: number, y: number, rot: boolean, white = false) {
  const X = Math.round(x);
  const Y = Math.round(y);
  const px = (dx: number, dy: number, c: string) => {
    ctx.fillStyle = white ? '#fff' : c;
    ctx.fillRect(X + dx, Y + dy, 1, 1);
  };
  const arms = rot
    ? [[-3, -3], [-2, -2], [3, 3], [2, 2], [3, -3], [2, -2], [-3, 3], [-2, 2]]
    : [[0, -4], [0, -3], [0, 4], [0, 3], [-4, 0], [-3, 0], [4, 0], [3, 0]];
  for (const [dx, dy] of arms) px(dx, dy, STEEL);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]]) px(dx, dy, rot ? STEEL : DARK);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) px(dx, dy, STEEL);
  px(0, 0, '#1a1426');
}

const BOMB = '#2b2440';
const BOMB_HI = '#6d6a85';
const GOLD = '#ffd166';
const HILT = '#8c2f39';

/** Bombe ronde avec mèche ; `danger` (0..1) fait clignoter le corps en rouge. */
function bomb(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, danger = 0, white = false) {
  const X = Math.round(x);
  const Y = Math.round(y);
  const blinkRate = danger > 0 ? Math.max(2, Math.round(10 - danger * 8)) : 0;
  const red = blinkRate > 0 && Math.floor(time / blinkRate) % 2 === 0;
  const body = white ? '#fff' : red ? '#c0392b' : BOMB;
  const rows = [
    [-2, 4],
    [-3, 6],
    [-4, 8],
    [-4, 8],
    [-4, 8],
    [-4, 8],
    [-3, 6],
    [-2, 4],
  ];
  rows.forEach(([dx, w], i) => {
    ctx.fillStyle = body;
    ctx.fillRect(X + dx, Y - 4 + i, w, 1);
  });
  ctx.fillStyle = white ? '#fff' : BOMB_HI;
  ctx.fillRect(X - 2, Y - 2, 2, 1);
  ctx.fillRect(X - 3, Y - 1, 1, 1);
  // Mèche + étincelle.
  ctx.fillStyle = white ? '#fff' : '#8a6a3a';
  ctx.fillRect(X + 1, Y - 5, 1, 1);
  ctx.fillRect(X + 2, Y - 6, 1, 1);
  ctx.fillStyle = Math.floor(time / 3) % 2 ? '#ffe66d' : '#ff9f43';
  ctx.fillRect(X + 3, Y - 7, 1, 1);
  if (Math.floor(time / 3) % 3 === 0) ctx.fillRect(X + 4, Y - 8, 1, 1);
}

/** Katana pixel art de longueur `len`, orienté selon `angle` (radians). */
function sword(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, len = 14, white = false) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const hilt = Math.round(len * 0.28);
  for (let i = 0; i < len; i++) {
    const t = i - len / 2;
    const color = white ? '#fff' : i < hilt ? (i % 2 ? HILT : '#5c1f27') : i === len - 1 ? '#ffffff' : STEEL;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x + dx * t), Math.round(y + dy * t), 1, 1);
  }
  // Garde (tsuba) perpendiculaire.
  const gx = x + dx * (hilt - len / 2);
  const gy = y + dy * (hilt - len / 2);
  ctx.fillStyle = white ? '#fff' : GOLD;
  for (const k of [-1, 0, 1]) ctx.fillRect(Math.round(gx - dy * k), Math.round(gy + dx * k), 1, 1);
}

/** Dessine un objet selon son type. */
function drawType(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, time: number, spin: number | null, danger = 0, white = false) {
  if (type === 'bomb') bomb(ctx, x, y, time, danger, white);
  else if (type === 'sword') sword(ctx, x, y, spin ?? 0, 14, white);
  else shuriken(ctx, x, y, spin !== null ? Math.floor(time / 2) % 2 === 0 : Math.floor(time / 30) % 2 === 0, white);
}

/**
 * Objet tenu en main, dessiné par-dessus le personnage. L'épée suit le geste :
 * pointée vers l'avant au repos, elle balaie de haut en bas pendant une attaque
 * (`swing` = avancement 0..1, null hors attaque).
 */
export function drawHeldItem(ctx: CanvasRenderingContext2D, type: string, hand: { x: number; y: number }, facing: 1 | -1, time: number, swing: number | null, white = false) {
  if (type === 'sword') {
    const a = swing === null ? -0.9 : -1.9 + swing * 2.5;
    const angle = facing === 1 ? a : Math.PI - a;
    const len = 14;
    const off = len / 2 - 3;
    sword(ctx, hand.x + Math.cos(angle) * off, hand.y + Math.sin(angle) * off, angle, len, white);
  } else if (type === 'bomb') bomb(ctx, hand.x + facing * 2, hand.y + 1, time, 0, white);
  else shuriken(ctx, hand.x + facing * 2, hand.y, Math.floor(time / 20) % 2 === 0, white);
}

/** Objet tenu, dessiné sur le personnage (dans le dos). */
export function drawItemIcon(ctx: CanvasRenderingContext2D, type: string, x: number, y: number, facing: 1 | -1, time: number, white = false) {
  if (type === 'sword') sword(ctx, x, y, facing === 1 ? -2.3 : -0.84, 12, white);
  else if (type === 'bomb') bomb(ctx, x, y + 2, time, 0, white);
  else shuriken(ctx, x, y, Math.floor(time / 20) % 2 === 0, white);
}

/** Objets de l'arène : au sol (flottent + halo pour attirer l'œil) ou en vol (tournent). */
export function drawItems(ctx: CanvasRenderingContext2D, items: ItemState[], time: number, accent: string) {
  for (const it of items) {
    if (it.phase === 'thrown') {
      const type = getItemType(it.type);
      const spin = it.type === 'sword' ? it.ticks * 0.45 * (it.vx >= 0 ? 1 : -1) : 0;
      drawType(ctx, it.type, it.x, it.y, time, spin, type?.explosion ? it.ticks / type.flightTicks : 0);
      continue;
    }
    const bob = Math.round(Math.sin(time * 0.1 + it.uid) * 1.5);
    const y = it.y - 6 + bob;
    ctx.globalAlpha = 0.5;
    ring(ctx, it.x, y, 7 + (Math.floor(time / 10) % 2), accent);
    ctx.globalAlpha = 1;
    drawType(ctx, it.type, it.x, y, time, it.type === 'sword' ? -0.6 : null);
  }
}

/** Traînée de lame quand un combattant frappe avec l'épée. */
export function drawSwordSlash(ctx: CanvasRenderingContext2D, r: { x: number; y: number; w: number; h: number }, facing: 1 | -1, progress: number) {
  const cx = facing === 1 ? r.x : r.x + r.w;
  const cy = r.y + r.h / 2;
  const R = r.w;
  ctx.fillStyle = '#ffffff';
  for (let a = -1.1; a <= 1.1; a += 0.08) {
    if (a > -1.1 + progress * 2.6) break;
    for (const k of [0.8, 0.92, 1]) {
      ctx.globalAlpha = k === 1 ? 0.9 : 0.45;
      ctx.fillRect(Math.round(cx + Math.cos(a) * R * k * facing), Math.round(cy + Math.sin(a) * R * 0.55 * k), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
