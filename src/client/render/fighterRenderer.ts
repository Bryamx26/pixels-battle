import type { Fighter } from '../../shared/characters/fighter';
import { bodyCenter, handPos, GUARD_MAX } from '../../shared/characters/fighter';
import { getCharacter } from '../../shared/characters';
import { attackPhase } from '../../shared/combat/attack';
import { ring } from './arenaRenderer';
import { shade } from './palette';
import { drawText } from './pixelFont';
import { drawItemIcon } from './itemRenderer';

type Px = (dx: number, dy: number, w: number, h: number, color: string) => void;

export type Anim =
  | 'idle' | 'run' | 'jump' | 'fall' | 'light' | 'medium' | 'guard' | 'throw'
  | 'zip' | 'hooked' | 'hurt' | 'dizzy' | 'dash';

/** Choisit l'animation à partir de l'état de simulation. */
export function animOf(f: Fighter): Anim {
  switch (f.action) {
    case 'attack':
      return f.attack ?? 'idle';
    case 'guard':
      return 'guard';
    case 'dash':
      return 'dash';
    case 'zip':
      return 'zip';
    case 'hooked':
      return 'hooked';
    case 'hitstun':
      return 'hurt';
    case 'guardbreak':
      return 'dizzy';
  }
  if (f.grapple && (f.grapple.phase === 'fly' || f.grapple.phase === 'hooked')) return 'throw';
  if (!f.grounded) return f.vy < 0 ? 'jump' : 'fall';
  return Math.abs(f.vx) > 20 ? 'run' : 'idle';
}

export interface FighterDrawOpts {
  color: string;
  time: number;
  /** Ticks restants de flash blanc (coup reçu). */
  flash: number;
}

/** Indicateur au-dessus de la tête, dessiné en coordonnées écran (net malgré le zoom). */
export function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string, bob: number): void {
  const X = Math.round(x);
  const iy = Math.round(y) - 10 - bob;
  ctx.fillStyle = color;
  ctx.fillRect(X - 2, iy + 6, 5, 1);
  ctx.fillRect(X - 1, iy + 7, 3, 1);
  ctx.fillRect(X, iy + 8, 1, 1);
  drawText(ctx, label, X + 1, iy, { color, shadow: '#000', align: 'center' });
}

/** Chaîne + kunai, dessinés derrière les personnages. */
export function drawChain(ctx: CanvasRenderingContext2D, f: Fighter, color: string): void {
  const g = f.grapple;
  if (!g || f.action === 'dead') return;
  const h = handPos(f);
  const dx = g.x - h.x;
  const dy = g.y - h.y;
  const len = Math.hypot(dx, dy);
  const n = Math.floor(len / 3);
  for (let i = 0; i <= n; i++) {
    const k = n ? i / n : 0;
    ctx.fillStyle = i % 2 ? '#6d6a85' : '#d8d6ea';
    ctx.fillRect(Math.round(h.x + dx * k), Math.round(h.y + dy * k), 2, 2);
  }
  // Kunai : pointe orientée dans la direction de la chaîne.
  const ux = len ? dx / len : f.facing;
  const uy = len ? dy / len : 0;
  const kx = Math.round(g.x);
  const ky = Math.round(g.y);
  ctx.fillStyle = '#f4f4ff';
  for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(kx + ux * i) - 1, Math.round(ky + uy * i) - 1, 2, 2);
  ctx.fillStyle = color;
  ctx.fillRect(kx - 2, ky - 2, 4, 4);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(kx + ux * 5), Math.round(ky + uy * 5), 1, 1);
  if (g.phase === 'attached' || g.phase === 'hooked') {
    ctx.fillStyle = color;
    ctx.fillRect(kx - 3, ky, 1, 1);
    ctx.fillRect(kx + 3, ky, 1, 1);
    ctx.fillRect(kx, ky - 3, 1, 1);
    ctx.fillRect(kx, ky + 3, 1, 1);
  }
}

export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, o: FighterDrawOpts): void {
  if (f.action === 'dead' || f.eliminated) return;
  const ch = getCharacter(f.charId);
  const X = Math.round(f.x);
  const Y = Math.round(f.y);
  const s = f.facing;
  const blink = f.invuln > 0 && f.action !== 'dash' && Math.floor(o.time / 3) % 2 === 0;
  const white = o.flash > 0 && o.flash % 2 === 1;
  ctx.globalAlpha = blink ? 0.35 : f.connected ? 1 : 0.5;

  const P: Px = (dx, dy, w, h, color) => {
    ctx.fillStyle = white ? '#ffffff' : color;
    ctx.fillRect(s === 1 ? X + dx : X - dx - w, Y + dy, w, h);
  };

  const look = ch.look;
  const body = look.body;
  const dark = shade(body, -0.12);
  const scarf = o.color;
  const anim = animOf(f);
  const t = o.time;
  const wide = ch.width > 12 ? 1 : 0; // Tetsu est plus large

  let by = 0; // décalage vertical du haut du corps (accroupi > 0)
  let lean = 0; // décalage horizontal du haut du corps (vers l'avant > 0)
  let legs: [number, number, number, number][] = [
    [-3, -7, 3, 7],
    [1, -7, 3, 7],
  ];
  let armB: [number, number, number, number] = [-5, -14, 2, 5];
  let armF: [number, number, number, number] | null = [3 + wide, -14, 2, 5];
  let hurtEyes = false;
  let armTo: { x: number; y: number } | null = null;
  const phase = attackPhase(f);

  switch (anim) {
    case 'idle':
      by = Math.floor(t / 30) % 2;
      break;
    case 'run': {
      const fr = Math.floor(t / 5) % 4;
      lean = 1;
      legs = fr % 2 === 0 ? [[-5, -7, 3, 7], [3, -7, 3, 7]] : [[-2, -8, 3, 5], [0, -7, 3, 7]];
      if (fr >= 2) legs = [legs[1], legs[0]];
      by = fr % 2;
      armB = fr < 2 ? [-6, -14, 2, 4] : [-4, -14, 2, 5];
      armF = fr < 2 ? [3, -14, 2, 5] : [5, -14, 2, 4];
      break;
    }
    case 'jump':
      legs = [[-3, -8, 3, 5], [1, -9, 3, 5]];
      armB = [-6, -17, 2, 4];
      armF = [3, -18, 2, 4];
      break;
    case 'fall':
      legs = [[-5, -7, 3, 6], [2, -8, 3, 6]];
      armB = [-7, -15, 3, 2];
      armF = [4, -15, 3, 2];
      break;
    case 'light':
      if (phase === 'startup') armF = [-6, -14, 4, 2];
      else if (phase === 'active') {
        lean = 1;
        armF = [3, -14, 7, 2];
        P(10, -15, 4, 1, '#e6e6f0');
        P(10, -14, 5, 1, '#ffffff');
      } else armF = [3, -14, 5, 2];
      break;
    case 'medium':
      if (phase === 'startup') {
        lean = -1;
        legs = [[-3, -7, 3, 7], [1, -10, 3, 4]];
      } else if (phase === 'active') {
        lean = -1;
        legs = [[-3, -7, 3, 7], [2, -11, 10, 3]];
        P(11, -12, 2, 4, '#1a1426');
      } else legs = [[-3, -7, 3, 7], [2, -9, 6, 3]];
      break;
    case 'guard':
      by = 1;
      armB = [1, -13, 4, 2];
      armF = [3, -16, 3, 6];
      break;
    case 'dash':
      lean = 2;
      legs = [[-6, -6, 3, 6], [2, -7, 3, 7]];
      armB = [-8, -14, 3, 2];
      armF = null;
      break;
    case 'throw':
    case 'zip':
      if (f.grapple) armTo = { x: f.grapple.x, y: f.grapple.y };
      armF = null;
      if (anim === 'zip') {
        lean = 1;
        legs = [[-5, -6, 3, 5], [-2, -7, 3, 5]];
      }
      break;
    case 'hooked':
    case 'hurt':
    case 'dizzy':
      hurtEyes = anim !== 'dizzy';
      lean = -1;
      legs = [[-5, -7, 3, 6], [3, -8, 3, 6]];
      armB = [-6, -20, 2, 5];
      armF = [3, -21, 2, 5];
      if (anim === 'hooked' && Math.floor(t / 3) % 2) armF = [4, -18, 3, 2];
      break;
  }

  // Jambes.
  for (const [dx, dy, w, h] of legs) {
    P(dx, dy, w, h, dark);
    if (h >= 5 && w === 3) P(dx, dy + h - 1, w, 1, '#141020');
  }
  // Bras arrière.
  P(armB[0] + lean, armB[1] + by, armB[2], armB[3], shade(body, -0.25));
  // Torse + ceinture.
  P(-4 - wide + lean, -15 + by, 8 + wide * 2, 8, body);
  P(-4 - wide + lean, -10 + by, 8 + wide * 2, 2, look.trim);
  // Tête (capuche), bandeau couleur joueur, visage.
  P(-4 + lean, -22 + by, 8, 7, body);
  P(-4 + lean, -21 + by, 8, 1, scarf);
  P(-1 + lean, -19 + by, 6, 2, look.skin);
  if (hurtEyes) {
    P(2 + lean, -19 + by, 1, 1, '#1a1426');
    P(4 + lean, -18 + by, 1, 1, '#1a1426');
  } else P(3 + lean, -19 + by, 1, 1, '#1a1426');
  // Écharpe qui flotte derrière (suit la vitesse).
  const speed = Math.min(1, Math.abs(f.vx) / 200);
  for (let i = 1; i <= 3; i++) {
    const wave = Math.round(Math.sin(t * 0.25 + i * 1.3) * (1 - speed * 0.6));
    const drop = Math.round((1 - speed) * i * 0.7) - (f.vy > 100 ? i : 0);
    P(-4 - i * 2 + lean, -20 + by + wave + drop, 2, 1, i === 3 ? shade(scarf, -0.2) : scarf);
  }
  // Objet tenu, accroché dans le dos.
  if (f.heldItem) drawItemIcon(ctx, X - s * 6, Y - 13 + by, o.time, white);
  // Bras avant.
  if (armF) {
    P(armF[0] + lean, armF[1] + by, armF[2], armF[3], look.trim);
    P(armF[0] + lean + armF[2] - 1, armF[1] + by + armF[3] - 1, 1, 1, look.skin);
  }
  if (armTo) {
    // Bras tendu vers le kunai.
    const sx = X + s * 2;
    const sy = Y - 13 + by;
    const dx = armTo.x - sx;
    const dy = armTo.y - sy;
    const d = Math.hypot(dx, dy) || 1;
    ctx.fillStyle = white ? '#fff' : look.trim;
    for (let i = 0; i < 7; i++) ctx.fillRect(Math.round(sx + (dx / d) * i), Math.round(sy + (dy / d) * i), 2, 2);
  }
  ctx.globalAlpha = 1;

  // Bulle de garde (couleur selon la jauge, blanche pendant la fenêtre parfaite).
  if (f.action === 'guard') {
    const c = bodyCenter(f);
    const k = f.guard / GUARD_MAX;
    const col = f.guardTicks <= 7 ? '#ffffff' : k > 0.5 ? '#7cf5ff' : k > 0.25 ? '#ffcc33' : '#ff4d4d';
    ctx.globalAlpha = 0.25;
    for (let r = 4; r < 13; r += 2) ring(ctx, c.x, c.y, r, col);
    ctx.globalAlpha = 1;
    ring(ctx, c.x, c.y, 13 + (Math.floor(t / 6) % 2), col);
  }
  if (f.action === 'guardbreak') {
    for (let i = 0; i < 3; i++) {
      const a = t * 0.15 + (i * Math.PI * 2) / 3;
      ctx.fillStyle = '#ffe66d';
      ctx.fillRect(Math.round(X + Math.cos(a) * 7), Math.round(Y - 27 + Math.sin(a) * 2), 2, 2);
    }
  }

  // Arc de l'attaque pendant les frames actives.
  if (phase === 'active' && f.attack) {
    drawSlash(ctx, f, X, Y, s, f.attack === 'medium' ? scarf : '#ffffff');
  }

}

function drawSlash(ctx: CanvasRenderingContext2D, f: Fighter, X: number, Y: number, s: number, color: string) {
  const hb = getCharacter(f.charId).attacks[f.attack!].hitbox;
  const cx = X + s * (hb.x + 2);
  const cy = Y + hb.y + hb.h / 2;
  const r = hb.w * 0.75;
  ctx.fillStyle = color;
  const a0 = -1.1;
  const a1 = 1.1;
  for (let a = a0; a <= a1; a += 0.06) {
    const px = cx + Math.cos(a) * r * s;
    const py = cy + Math.sin(a) * r * (hb.h / hb.w + 0.35);
    ctx.fillRect(Math.round(px), Math.round(py), 2, 1);
    if (f.attack !== 'light') ctx.fillRect(Math.round(px - s * 2), Math.round(py), 1, 1);
  }
}
