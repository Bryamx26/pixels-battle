import { DT } from '../constants';
import type { ArenaDef } from '../arenas/types';
import type { Fighter } from '../characters/fighter';
import type { CharacterDef } from '../characters/types';

/** Applique la gravité en respectant la vitesse de chute max (ou chute rapide). */
export function applyGravity(f: Fighter, ch: CharacterDef, scale = 1): void {
  const max = f.fastFalling ? ch.fastFall : ch.maxFall;
  if (f.fastFalling) f.vy = Math.max(f.vy, ch.fastFall);
  f.vy = Math.min(f.vy + ch.gravity * scale * DT, Math.max(max, f.vy));
}

/**
 * Intègre la vitesse et résout les collisions avec l'arène.
 * Sous-pas automatiques pour éviter de traverser les plateformes à haute vitesse.
 */
export function integrate(f: Fighter, ch: CharacterDef, arena: ArenaDef): void {
  const hw = ch.width / 2;
  const h = ch.height;
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(f.vx), Math.abs(f.vy)) * DT) / 5));
  const sdt = DT / steps;
  const ignoreSoft = f.dropTimer > 0;
  let landed = false;
  let onSoft = false;

  for (let i = 0; i < steps; i++) {
    // --- Axe horizontal : seules les plateformes solides bloquent.
    f.x += f.vx * sdt;
    for (const p of arena.platforms) {
      if (p.kind !== 'solid') continue;
      if (f.x + hw > p.x && f.x - hw < p.x + p.w && f.y > p.y && f.y - h < p.y + p.h) {
        const pushLeft = f.x + hw - p.x;
        const pushRight = p.x + p.w - (f.x - hw);
        if (pushLeft < pushRight) f.x -= pushLeft;
        else f.x += pushRight;
        f.vx = 0;
      }
    }

    // --- Axe vertical.
    const prevFeet = f.y;
    f.y += f.vy * sdt;
    for (const p of arena.platforms) {
      const overlapX = f.x + hw > p.x && f.x - hw < p.x + p.w;
      if (!overlapX) continue;
      if (p.kind === 'solid') {
        if (f.y > p.y && f.y - h < p.y + p.h) {
          if (prevFeet <= p.y + 0.5 || f.vy >= 0) {
            f.y = p.y;
            if (f.vy > 0) f.vy = 0;
            landed = true;
            onSoft = false;
          } else {
            f.y = p.y + p.h + h;
            if (f.vy < 0) f.vy = 0;
          }
        }
      } else if (!ignoreSoft && f.vy >= 0 && prevFeet <= p.y + 0.01 && f.y >= p.y) {
        f.y = p.y;
        f.vy = 0;
        landed = true;
        onSoft = true;
      }
    }
  }

  f.grounded = landed;
  f.onSoft = landed && onSoft;
}
