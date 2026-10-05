import { segmentRect } from '../math';
import { areEnemies, hurtbox, isAlive, type Fighter } from '../characters/fighter';
import { getCharacter } from '../characters';
import type { GameEvent } from '../engine/events';

/**
 * Interactions grappin ↔ combattants (résolues uniquement par la simulation
 * autoritaire : serveur, ou partie locale d'entraînement).
 */

const HOOK_MAX_TICKS = 30;
/** Hitstun laissé à la cible après la traction : fenêtre pour enchaîner. */
const PULL_END_STUN = 22;
const HOOK_GUARD_DAMAGE = 15;

export function resolveGrappleHits(fighters: Fighter[], events: GameEvent[]): void {
  for (const f of fighters) {
    const g = f.grapple;
    if (!g || g.phase !== 'fly' || !isAlive(f)) continue;
    for (const t of fighters) {
      if (!areEnemies(f, t) || !isAlive(t) || t.invuln > 0 || t.action === 'hooked') continue;
      if (segmentRect(g.px, g.py, g.x, g.y, hurtbox(t)) < 0) continue;

      if (t.action === 'guard') {
        // La garde renvoie le kunai.
        g.phase = 'retract';
        t.guard = Math.max(1, t.guard - HOOK_GUARD_DAMAGE);
        events.push({ type: 'block', x: g.x, y: g.y, target: t.id });
        break;
      }

      g.phase = 'hooked';
      g.targetId = t.id;
      t.combo = t.action === 'hitstun' ? t.combo + 1 : 1;
      t.action = 'hooked';
      t.actionTicks = 0;
      t.stun = HOOK_MAX_TICKS;
      t.hookedBy = f.id;
      t.attack = null;
      t.vx = 0;
      t.vy = 0;
      t.fastFalling = false;
      t.damage = Math.min(999, t.damage + getCharacter(f.charId).grapple.hookDamage);
      t.lastHitBy = f.id;
      if (t.grapple && t.grapple.phase !== 'retract') t.grapple.phase = 'retract';
      events.push({ type: 'hook', x: g.x, y: g.y, attacker: f.id, target: t.id });
      break;
    }
  }
}

/** Tire les ennemis accrochés vers leur lanceur (distance limitée par la portée du kunai). */
export function updateHooks(fighters: Fighter[]): void {
  const byId = new Map(fighters.map((f) => [f.id, f]));
  // Chaîne orpheline (cible frappée, morte…) → elle revient.
  for (const p of fighters) {
    const g = p.grapple;
    if (!g || g.phase !== 'hooked') continue;
    const t = g.targetId ? byId.get(g.targetId) : undefined;
    if (!t || t.action !== 'hooked' || t.hookedBy !== p.id) g.phase = 'retract';
  }
  for (const t of fighters) {
    if (t.action !== 'hooked') continue;
    const p = t.hookedBy ? byId.get(t.hookedBy) : undefined;
    const g = p?.grapple;
    if (!p || !g || !isAlive(p) || g.phase !== 'hooked' || g.targetId !== t.id) {
      releaseHooked(t, 8);
      continue;
    }
    const tx = p.x + p.facing * 15;
    const ty = p.y;
    const dx = tx - t.x;
    const dy = ty - t.y;
    const d = Math.hypot(dx, dy);
    const speed = getCharacter(p.charId).grapple.pullSpeed;
    t.stun--;
    if (d < 10 || t.stun <= 0) {
      releaseHooked(t, PULL_END_STUN);
      g.phase = 'retract';
      continue;
    }
    const s = Math.min(speed, d * 60);
    t.vx = (dx / d) * s;
    t.vy = (dy / d) * s;
    g.x = t.x;
    g.y = t.y - 11;
  }
}

export function releaseHooked(t: Fighter, stun: number): void {
  t.action = 'hitstun';
  t.actionTicks = 0;
  t.stun = stun;
  t.hookedBy = null;
  t.vx *= 0.15;
  t.vy = Math.min(t.vy * 0.15, -60);
}
