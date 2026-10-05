import { rectsOverlap } from '../math';
import { areEnemies, hurtbox, isAlive, GUARD_MAX, type Fighter } from '../characters/fighter';
import { getCharacter } from '../characters';
import type { GameEvent } from '../engine/events';
import { attackPhase, attackRect } from './attack';
import { PERFECT_GUARD_TICKS, breakGuard } from './guard';
import type { AttackDef } from './types';

const PARRY_STUN = 30;
const HITSTUN_BASE = 8;
const HITSTUN_PER_KB = 0.035;

/** Résout toutes les hitbox actives contre les hurtbox ennemies. */
export function resolveAttackHits(fighters: Fighter[], events: GameEvent[]): void {
  for (const a of fighters) {
    if (attackPhase(a) !== 'active' || !isAlive(a)) continue;
    const hb = attackRect(a)!;
    const def = getCharacter(a.charId).attacks[a.attack!];
    for (const t of fighters) {
      if (!areEnemies(a, t) || !isAlive(t) || t.invuln > 0 || a.hitIds.includes(t.id)) continue;
      if (!rectsOverlap(hb, hurtbox(t))) continue;
      a.hitIds.push(t.id);
      applyHit(a, t, def, events);
      if (a.action !== 'attack') break; // contré par une garde parfaite
    }
  }
}

function applyHit(a: Fighter, t: Fighter, def: AttackDef, events: GameEvent[]): void {
  const x = (a.x + t.x) / 2;
  const y = t.y - 12;

  if (t.action === 'guard') {
    if (t.guardTicks <= PERFECT_GUARD_TICKS) {
      // Garde parfaite : l'attaquant est étourdi, le défenseur peut contre-attaquer.
      a.action = 'hitstun';
      a.attack = null;
      a.stun = PARRY_STUN;
      a.vx = -a.facing * 90;
      t.action = 'free';
      t.guard = Math.min(GUARD_MAX, t.guard + 15);
      events.push({ type: 'parry', x, y, target: t.id, attacker: a.id });
      return;
    }
    t.guard -= def.guardDamage;
    t.vx = a.facing * (60 + def.guardDamage * 2);
    a.vx = -a.facing * 50;
    events.push({ type: 'block', x, y, target: t.id });
    if (t.guard <= 0) {
      breakGuard(t);
      events.push({ type: 'guardbreak', x, y, target: t.id });
    }
    return;
  }

  t.damage = Math.min(999, t.damage + def.damage);
  const kb = (def.baseKb + t.damage * def.kbGrowth) * getCharacter(t.charId).kbTaken;
  const ang = (def.angle * Math.PI) / 180;
  t.vx = Math.cos(ang) * kb * a.facing;
  t.vy = -Math.sin(ang) * kb;
  if (t.grounded && t.vy > -150) t.vy = -150;
  t.grounded = false;
  t.combo = t.action === 'hitstun' || t.action === 'hooked' ? t.combo + 1 : 1;
  t.action = 'hitstun';
  t.actionTicks = 0;
  t.stun = Math.round(HITSTUN_BASE + kb * HITSTUN_PER_KB);
  t.attack = null;
  t.fastFalling = false;
  t.hookedBy = null;
  t.lastHitBy = a.id;
  if (t.grapple && t.grapple.phase !== 'retract') t.grapple.phase = 'retract';
  a.attackHit = true;
  events.push({ type: 'hit', x, y, attacker: a.id, target: t.id, slot: def.slot, power: kb, combo: t.combo });
}
