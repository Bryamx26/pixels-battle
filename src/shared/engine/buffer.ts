import { Btn } from '../input';
import type { Fighter } from '../characters/fighter';

/** Boutons dont l'appui est mémorisé quelques ticks (contrôles plus tolérants). */
const BUFFERABLE = Btn.Light | Btn.Medium | Btn.Grapple | Btn.Dash | Btn.Up | Btn.Throw;
const BUFFER_TICKS = 7;

export function feedBuffer(f: Fighter, pressed: number): void {
  const b = pressed & BUFFERABLE;
  if (b) {
    f.bufBtns |= b;
    f.bufTicks = BUFFER_TICKS;
  } else if (f.bufTicks > 0 && --f.bufTicks === 0) {
    f.bufBtns = 0;
  }
}

/** Consomme un appui mémorisé. */
export function consume(f: Fighter, b: number): boolean {
  if (f.bufBtns & b) {
    f.bufBtns &= ~b;
    return true;
  }
  return false;
}

export const buffered = (f: Fighter, b: number) => (f.bufBtns & b) !== 0;
