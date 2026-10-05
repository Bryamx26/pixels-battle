import type { Fighter } from '../../../shared/characters/fighter';
import { attackPhase } from '../../../shared/combat/attack';
import { animOf } from '../fighterRenderer';
import { NINJA_ATLAS, type NinjaAnim } from './ninjaAtlas';

/**
 * Choix de l'image d'animation à partir de l'état de simulation.
 * Les attaques sont découpées par phase (préparation / coup / récupération)
 * pour que l'image « bras tendu » coïncide avec la hitbox active.
 */
const ATTACK_FRAMES: Record<'light' | 'light2' | 'medium', { startup: number[]; active: number; recovery: number[] }> = {
  light: { startup: [1], active: 3, recovery: [0] },
  light2: { startup: [0], active: 1, recovery: [2, 3] },
  medium: { startup: [0], active: 3, recovery: [2] },
};

function pickFrame(f: Fighter, t: number): { anim: NinjaAnim; i: number; shake: number } {
  switch (animOf(f)) {
    case 'idle':
      return { anim: 'idle', i: Math.floor(t / 12) % 4, shake: 0 };
    case 'run':
      return { anim: 'run', i: Math.floor(t / 6) % 4, shake: 0 };
    case 'jump':
      return { anim: 'jump', i: 1, shake: 0 };
    case 'fall':
      return { anim: 'jump', i: 2, shake: 0 };
    case 'dash':
      return { anim: 'run', i: 1, shake: 0 };
    case 'zip':
      return { anim: 'jump', i: 1, shake: 0 };
    case 'guard':
      return { anim: 'guard', i: Math.floor(t / 10) % 4, shake: 0 };
    case 'throw':
      return { anim: 'throw', i: (f.grapple?.ticks ?? 0) < 4 ? 1 : 3, shake: 0 };
    case 'hurt':
    case 'hooked':
      return { anim: 'jump', i: 0, shake: t % 4 < 2 ? 1 : -1 };
    case 'dizzy':
      return { anim: 'guard', i: 0, shake: t % 16 < 8 ? 1 : 0 };
    case 'light':
    case 'medium': {
      // La 2e attaque rapide d'un enchaînement utilise une autre animation.
      const anim = f.attack === 'medium' ? 'medium' : f.chain === 2 ? 'light2' : 'light';
      const map = ATTACK_FRAMES[anim];
      const phase = attackPhase(f);
      if (phase === 'active') return { anim, i: map.active, shake: 0 };
      const list = phase === 'startup' ? map.startup : map.recovery;
      return { anim, i: list[Math.min(list.length - 1, Math.floor(f.actionTicks / 4) % list.length)], shake: 0 };
    }
  }
}

/** Dessine le personnage depuis sa planche, retourné selon `facing`, pieds sur (x, y). */
export function drawSpriteFighter(ctx: CanvasRenderingContext2D, img: HTMLImageElement, f: Fighter, t: number, white: boolean): void {
  const { anim, i, shake } = pickFrame(f, t);
  const fr = NINJA_ATLAS[anim][i];
  const X = Math.round(f.x) + shake;
  const Y = Math.round(f.y);
  if (white) ctx.filter = 'brightness(0) invert(1)';
  if (f.facing === 1) {
    ctx.drawImage(img, fr.x, fr.y, fr.w, fr.h, X - fr.ax, Y - fr.h, fr.w, fr.h);
  } else {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(img, fr.x, fr.y, fr.w, fr.h, -(X + fr.ax + 1), Y - fr.h, fr.w, fr.h);
    ctx.restore();
  }
  if (white) ctx.filter = 'none';
}
