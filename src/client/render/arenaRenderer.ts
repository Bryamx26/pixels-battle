import type { ArenaDef, Platform } from '../../shared/arenas';
import { VIEW_H, VIEW_W } from '../../shared/constants';
import { shade } from './palette';

/** Générateur pseudo-aléatoire déterministe (décor identique à chaque partie). */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Pré-rend le décor statique (ciel, montagnes, plateformes) dans un canvas. */
export function renderArenaBackground(arena: ArenaDef): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = VIEW_W;
  c.height = VIEW_H;
  const ctx = c.getContext('2d')!;
  const t = arena.theme;
  const rand = rng(hashString(arena.id));

  // Ciel en bandes avec tramage (dithering) entre deux couleurs.
  const bands = 14;
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1);
    const col = mix(t.skyTop, t.skyBottom, k);
    const y0 = Math.floor((i / bands) * VIEW_H);
    const y1 = Math.floor(((i + 1) / bands) * VIEW_H);
    ctx.fillStyle = col;
    ctx.fillRect(0, y0, VIEW_W, y1 - y0);
    ctx.fillStyle = mix(t.skyTop, t.skyBottom, Math.min(1, k + 1 / bands));
    for (let y = y1 - 3; y < y1; y++) for (let x = (y % 2) * 1; x < VIEW_W; x += 2) ctx.fillRect(x, y, 1, 1);
  }

  // Étoiles / poussières.
  ctx.fillStyle = shade(t.skyBottom, 0.35);
  for (let i = 0; i < 70; i++) ctx.fillRect(Math.floor(rand() * VIEW_W), Math.floor(rand() * VIEW_H * 0.55), 1, 1);

  // Grand astre.
  const sx = 70 + rand() * 340;
  disc(ctx, sx, 60, 26, shade(t.skyBottom, 0.25));
  disc(ctx, sx, 60, 22, shade(t.skyBottom, 0.4));

  // Montagnes lointaines puis proches (silhouettes par colonnes).
  ridge(ctx, rand, 150, 50, t.far, 0.02);
  ridge(ctx, rand, 205, 40, t.near, 0.045);

  // Nuages pixel.
  for (let i = 0; i < 6; i++) cloud(ctx, rand() * VIEW_W, 20 + rand() * 90, 16 + rand() * 30, shade(t.skyBottom, 0.18));

  for (const p of arena.platforms) drawPlatform(ctx, p, arena);
  return c;
}

function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
  }
}

function ridge(ctx: CanvasRenderingContext2D, rand: () => number, base: number, amp: number, color: string, freq: number) {
  ctx.fillStyle = color;
  const p1 = rand() * 10;
  const p2 = rand() * 10;
  for (let x = 0; x < VIEW_W; x += 2) {
    const h = Math.sin(x * freq + p1) * amp * 0.6 + Math.sin(x * freq * 2.7 + p2) * amp * 0.3;
    const top = Math.round(base - Math.abs(h));
    ctx.fillRect(x, top, 2, VIEW_H - top);
  }
}

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color;
  x = Math.round(x);
  y = Math.round(y);
  ctx.fillRect(x, y, w, 4);
  ctx.fillRect(x + 4, y - 3, w - 10, 3);
  ctx.fillRect(x + 8, y - 5, Math.max(4, w - 20), 2);
}

function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, arena: ArenaDef) {
  const t = arena.theme;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  if (p.kind === 'soft') {
    // Planche fine traversable.
    ctx.fillStyle = shade(t.soft, -0.35);
    ctx.fillRect(x, y + 1, p.w, p.h);
    ctx.fillStyle = t.soft;
    ctx.fillRect(x, y, p.w, 3);
    ctx.fillStyle = shade(t.soft, 0.25);
    ctx.fillRect(x, y, p.w, 1);
    ctx.fillStyle = shade(t.soft, -0.2);
    for (let i = x + 3; i < x + p.w - 2; i += 8) ctx.fillRect(i, y + 1, 1, 2);
    // Supports.
    ctx.fillStyle = shade(t.soft, -0.45);
    ctx.fillRect(x + 2, y + 3, 2, 3);
    ctx.fillRect(x + p.w - 4, y + 3, 2, 3);
    return;
  }
  // Bloc solide : dessous effilé (île flottante) puis corps en briques.
  ctx.fillStyle = shade(t.dark, -0.15);
  const taper = 10;
  for (let i = 0; i < taper; i++) {
    const inset = Math.round((i + 1) * (p.w / 2 / (taper + 4)));
    ctx.fillRect(x + inset, y + p.h + i, p.w - inset * 2, 1);
  }
  ctx.fillStyle = t.body;
  ctx.fillRect(x, y, p.w, p.h);
  ctx.fillStyle = t.dark;
  for (let row = 0; row * 6 < p.h; row++) {
    const ry = y + 4 + row * 6;
    ctx.fillRect(x, ry, p.w, 1);
    for (let bx = x + (row % 2 ? 6 : 0); bx < x + p.w; bx += 12) ctx.fillRect(bx, ry, 1, 6);
  }
  ctx.fillStyle = shade(t.body, 0.12);
  ctx.fillRect(x, y + 3, p.w, 1);
  ctx.fillStyle = t.dark;
  ctx.fillRect(x, y + p.h - 2, p.w, 2);
  ctx.fillRect(x, y, 1, p.h);
  ctx.fillRect(x + p.w - 1, y, 1, p.h);
  // Dessus (herbe / métal) avec quelques brins.
  ctx.fillStyle = t.top;
  ctx.fillRect(x, y, p.w, 3);
  ctx.fillStyle = shade(t.top, 0.25);
  ctx.fillRect(x, y, p.w, 1);
  ctx.fillStyle = shade(t.top, -0.25);
  for (let i = x + 2; i < x + p.w - 2; i += 5) ctx.fillRect(i, y + 3, 1, 1 + ((i * 7) % 3 === 0 ? 1 : 0));
}

/** Anneaux d'accroche du grappin (animés). */
export function drawAnchors(ctx: CanvasRenderingContext2D, arena: ArenaDef, time: number) {
  const pulse = Math.floor(time / 8) % 2;
  for (const a of arena.anchors) {
    const x = Math.round(a.x);
    const y = Math.round(a.y);
    // Chaîne qui pend du haut de l'écran.
    ctx.fillStyle = shade(arena.theme.dark, -0.1);
    for (let cy = Math.max(0, y - 60); cy < y - a.r; cy += 3) ctx.fillRect(x, cy, 1, 2);
    ring(ctx, x, y, a.r + 1, '#00000088');
    ring(ctx, x, y, a.r, arena.theme.accent);
    ring(ctx, x, y, a.r - 1, shade(arena.theme.accent, -0.3));
    if (pulse) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - a.r, 2, 1);
    }
  }
}

export function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.fillStyle = color;
  const steps = Math.max(12, Math.round(r * 7));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
  }
}
