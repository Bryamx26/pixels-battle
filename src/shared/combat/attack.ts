import type { Rect } from '../math';
import { approach } from '../math';
import { DT } from '../constants';
import { Btn } from '../input';
import type { Fighter } from '../characters/fighter';
import type { CharacterDef } from '../characters/types';
import { getCharacter } from '../characters';
import { consume } from '../engine/buffer';
import { throwGrapple, canThrow } from '../grapple/grapple';
import type { AttackDef, AttackSlot } from './types';
import { attackTotal } from './types';

const SLOT_BUTTONS: [AttackSlot, number][] = [
  ['medium', Btn.Medium],
  ['light', Btn.Light],
];
const MAX_LIGHT_CHAIN = 3;
/** Une attaque enchaînée après un coup réussi démarre plus vite. */
const CANCEL_STARTUP_FACTOR = 0.6;

export function startAttack(f: Fighter, slot: AttackSlot, canceled = false): void {
  f.chain = slot === 'light' && f.action === 'attack' && f.attack === 'light' ? f.chain + 1 : 1;
  f.action = 'attack';
  f.attack = slot;
  f.attackCanceled = canceled;
  f.actionTicks = 0;
  f.attackSeq++;
  f.attackHit = false;
  f.hitIds = [];
}

/** Durées effectives (startup raccourci si l'attaque est un enchaînement). */
export function attackTiming(f: Fighter, a: AttackDef) {
  const startup = f.attackCanceled ? Math.max(2, Math.round(a.startup * CANCEL_STARTUP_FACTOR)) : a.startup;
  return { startup, active: a.active, total: startup + a.active + a.recovery };
}

export type AttackPhase = 'startup' | 'active' | 'recovery';

export function attackPhase(f: Fighter): AttackPhase | null {
  if (f.action !== 'attack' || !f.attack) return null;
  const t = attackTiming(f, getCharacter(f.charId).attacks[f.attack]);
  if (f.actionTicks <= t.startup) return 'startup';
  if (f.actionTicks <= t.startup + t.active) return 'active';
  return 'recovery';
}

/** Hitbox monde de l'attaque courante (orientée selon facing). */
export function attackRect(f: Fighter): Rect | null {
  if (!f.attack) return null;
  const hb = getCharacter(f.charId).attacks[f.attack].hitbox;
  const x = f.facing === 1 ? f.x + hb.x : f.x - hb.x - hb.w;
  return { x, y: f.y + hb.y, w: hb.w, h: hb.h };
}

/** Lance l'attaque demandée via le buffer si possible. */
export function tryStartAttack(f: Fighter, allowed?: AttackSlot[]): boolean {
  for (const [slot, btn] of SLOT_BUTTONS) {
    if (allowed && !allowed.includes(slot)) continue;
    if (slot === 'light' && allowed && f.attack === 'light' && f.chain >= MAX_LIGHT_CHAIN) continue;
    if (consume(f, btn)) {
      startAttack(f, slot, !!allowed);
      return true;
    }
  }
  return false;
}

export function updateAttack(f: Fighter, ch: CharacterDef, buttons: number, dx: number): void {
  const a = ch.attacks[f.attack!];
  const t = attackTiming(f, a);

  // Mouvement pendant l'attaque : on freine au sol, léger contrôle en l'air.
  if (f.grounded) f.vx = approach(f.vx, 0, ch.groundFriction * 0.7 * DT);
  else if (dx) f.vx = approach(f.vx, dx * ch.airSpeed, ch.airAccel * 0.5 * DT);

  if (f.actionTicks === t.startup) {
    // Fente vers l'avant au moment de frapper.
    if (f.grounded) f.vx = f.facing * a.lunge;
    else f.vx = f.facing * Math.max(Math.abs(f.vx), a.lunge * 0.6);
  }

  // Enchaînements : après un coup réussi, on peut annuler dans une autre action.
  if (f.attackHit && f.actionTicks > t.startup) {
    if (tryStartAttack(f, a.cancelInto)) return;
    if (a.cancelIntoGrapple && canThrow(f) && consume(f, Btn.Grapple)) {
      f.action = 'free';
      throwGrapple(f, ch, buttons);
      return;
    }
    if (consume(f, Btn.Up) && (f.grounded || f.airJumpsLeft > 0)) {
      if (!f.grounded) f.airJumpsLeft--;
      f.action = 'free';
      f.attack = null;
      f.vy = -(f.grounded ? ch.jumpVel : ch.doubleJumpVel);
      f.grounded = false;
      return;
    }
  }

  if (f.actionTicks >= t.total) {
    f.action = 'free';
    f.attack = null;
  }
}

export { attackTotal };
