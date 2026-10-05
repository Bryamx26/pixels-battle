import { DT } from '../constants';
import { segmentCircle, segmentRect } from '../math';
import { inputDir } from '../input';
import type { ArenaDef } from '../arenas/types';
import { bodyCenter, handPos, type Fighter } from '../characters/fighter';
import type { CharacterDef } from '../characters/types';
import { Btn } from '../input';
import { consume } from '../engine/buffer';
import { tryStartAttack } from '../combat/attack';

/**
 * Grappin / kunai à chaîne.
 *
 * Cycle du projectile : fly → (attached | hooked | retract) → retract → null.
 *  - attached : le kunai est planté dans une plateforme ou un anneau,
 *               le lanceur passe en état `zip` et est tiré vers le point.
 *  - hooked   : le kunai a touché un ennemi (résolu côté serveur, voir hook.ts).
 *  - retract  : la chaîne revient vers la main.
 */

const ZIP_MAX_TICKS = 45;
const ZIP_ARRIVE_DIST = 14;
const RETRACT_SPEED_FACTOR = 1.5;
const LEDGE_INSET = 5;
/** Le centre du corps vise un peu au-dessus du point planté dans une plateforme. */
const LEDGE_LIFT = 12;

export const canThrow = (f: Fighter) => !f.grapple && f.grappleCooldown === 0;

/** Direction de lancer : 8 directions, horizontale devant soi par défaut. */
export function throwDirection(f: Fighter, buttons: number): { x: number; y: number } {
  const { dx, dy } = inputDir(buttons);
  if (dx === 0 && dy === 0) return { x: f.facing, y: 0 };
  const len = Math.hypot(dx, dy);
  return { x: dx / len, y: dy / len };
}

export function throwGrapple(f: Fighter, ch: CharacterDef, buttons: number): void {
  const dir = throwDirection(f, buttons);
  if (dir.x !== 0) f.facing = dir.x > 0 ? 1 : -1;
  const hand = handPos(f);
  f.grapple = {
    phase: 'fly',
    x: hand.x,
    y: hand.y,
    px: hand.x,
    py: hand.y,
    vx: dir.x * ch.grapple.speed,
    vy: dir.y * ch.grapple.speed,
    targetId: null,
    onLedge: false,
    ticks: 0,
  };
  f.grappleCooldown = ch.grapple.cooldown;
}

/** Avance le kunai et teste l'accroche sur l'arène (plateformes + anneaux). */
export function updateGrappleProjectile(f: Fighter, ch: CharacterDef, arena: ArenaDef): void {
  const g = f.grapple;
  if (!g) return;
  g.ticks++;
  const hand = handPos(f);

  // Interrompu si le lanceur est frappé ou meurt.
  if (g.phase !== 'retract' && (f.action === 'hitstun' || f.action === 'guardbreak' || f.action === 'hooked' || f.action === 'dead')) {
    g.phase = 'retract';
  }

  switch (g.phase) {
    case 'fly': {
      g.px = g.x;
      g.py = g.y;
      const nx = g.x + g.vx * DT;
      const ny = g.y + g.vy * DT;
      let best = 2;
      let ledge: { x: number; y: number } | null = null;
      for (const p of arena.platforms) {
        if (!p.grapple) continue;
        const t = segmentRect(g.x, g.y, nx, ny, p);
        if (t >= 0 && t < best) {
          best = t;
          // Sur une plateforme, le kunai se plante au bord supérieur le plus proche :
          // le joueur est hissé sur la plateforme (récupération fiable).
          const hx = g.x + (nx - g.x) * t;
          ledge = { x: Math.min(Math.max(hx, p.x + LEDGE_INSET), p.x + p.w - LEDGE_INSET), y: p.y - 1 };
        }
      }
      for (const a of arena.anchors) {
        const t = segmentCircle(g.x, g.y, nx, ny, a.x, a.y, a.r);
        if (t >= 0 && t < best) {
          best = t;
          ledge = null;
        }
      }
      if (best <= 1) {
        g.x = ledge ? ledge.x : g.x + (nx - g.x) * best;
        g.y = ledge ? ledge.y : g.y + (ny - g.y) * best;
        g.phase = 'attached';
        g.onLedge = !!ledge;
        if (f.action === 'free' || f.action === 'dash' || f.action === 'attack') {
          f.action = 'zip';
          f.actionTicks = 0;
          f.attack = null;
          f.fastFalling = false;
          // Les appuis faits avant l'accroche (ex. W+E) n'annulent pas le zip.
          f.bufBtns = 0;
        } else {
          g.phase = 'retract';
        }
        return;
      }
      g.x = nx;
      g.y = ny;
      if (Math.hypot(g.x - hand.x, g.y - hand.y) >= ch.grapple.range) g.phase = 'retract';
      return;
    }
    case 'attached':
      if (f.action !== 'zip') g.phase = 'retract';
      return;
    case 'hooked':
      return; // position mise à jour par hook.ts
    case 'retract': {
      const step = ch.grapple.speed * RETRACT_SPEED_FACTOR * DT;
      const dx = hand.x - g.x;
      const dy = hand.y - g.y;
      const d = Math.hypot(dx, dy);
      if (d <= step + 2) f.grapple = null;
      else {
        g.x += (dx / d) * step;
        g.y += (dy / d) * step;
      }
    }
  }
}

/** État `zip` : le lanceur est tiré vers le point d'accroche. */
export function updateZip(f: Fighter, ch: CharacterDef): void {
  const g = f.grapple;
  if (!g || g.phase !== 'attached') {
    f.action = 'free';
    return;
  }
  // Annulation par saut : on garde l'élan (mouvement avancé « fronde »).
  if (consume(f, Btn.Up)) {
    f.vy = Math.min(f.vy * 0.5, 0) - ch.jumpVel * 0.85;
    f.action = 'free';
    g.phase = 'retract';
    return;
  }
  // Annulation en attaque : grappin → attaque en conservant la vitesse.
  if (tryStartAttack(f)) {
    g.phase = 'retract';
    return;
  }
  const c = bodyCenter(f);
  const dx = g.x - c.x;
  const dy = g.y - (g.onLedge ? LEDGE_LIFT : 0) - c.y;
  const d = Math.hypot(dx, dy);
  if (d < ZIP_ARRIVE_DIST || f.actionTicks > ZIP_MAX_TICKS) {
    endZip(f);
    return;
  }
  f.vx = (dx / d) * ch.grapple.zipSpeed;
  f.vy = (dy / d) * ch.grapple.zipSpeed;
  if (Math.abs(dx) > 2) f.facing = dx > 0 ? 1 : -1;
}

/** Arrivée au point d'accroche : petit rebond et récupération du double saut. */
export function endZip(f: Fighter): void {
  f.action = 'free';
  f.vx *= 0.45;
  f.vy = Math.min(f.vy * 0.6, -200);
  f.airJumpsLeft = Math.max(f.airJumpsLeft, 1);
  f.airDashUsed = false;
  if (f.grapple) f.grapple.phase = 'retract';
}
