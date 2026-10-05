import { approach } from '../math';
import { DT } from '../constants';
import { Btn, has } from '../input';
import { GUARD_MAX, type Fighter } from '../characters/fighter';
import type { CharacterDef } from '../characters/types';

/** Ticks au début de la garde pendant lesquels un blocage est une garde parfaite. */
export const PERFECT_GUARD_TICKS = 7;
const GUARD_DRAIN_PER_SEC = 12;
const GUARD_REGEN_PER_SEC = 30;
const GUARD_REGEN_DELAY = 30;
/** Jauge minimale pour pouvoir relever la garde. */
export const GUARD_MIN_TO_RAISE = 20;
export const GUARD_BREAK_TICKS = 70;

/** `fresh` : la touche vient d'être pressée (sinon pas de fenêtre de garde parfaite). */
export function startGuard(f: Fighter, fresh: boolean): void {
  f.action = 'guard';
  f.actionTicks = 0;
  f.guardTicks = fresh ? 0 : PERFECT_GUARD_TICKS + 1;
}

export function updateGuard(f: Fighter, ch: CharacterDef, buttons: number): void {
  f.vx = approach(f.vx, 0, ch.groundFriction * DT);
  f.guard -= GUARD_DRAIN_PER_SEC * DT;
  f.guardTicks++;
  f.guardRegenDelay = GUARD_REGEN_DELAY;
  if (f.guard <= 0) {
    breakGuard(f);
    return;
  }
  if (!has(buttons, Btn.Guard) || !f.grounded) f.action = 'free';
}

export function regenGuard(f: Fighter): void {
  if (f.action === 'guard' || f.action === 'guardbreak') return;
  if (f.guardRegenDelay > 0) f.guardRegenDelay--;
  else f.guard = Math.min(GUARD_MAX, f.guard + GUARD_REGEN_PER_SEC * DT);
}

export function breakGuard(f: Fighter): void {
  f.action = 'guardbreak';
  f.actionTicks = 0;
  f.stun = GUARD_BREAK_TICKS;
  f.guard = 0;
  f.guardRegenDelay = GUARD_BREAK_TICKS;
  f.vy = -180;
  f.grounded = false;
}
