import { rectsOverlap } from '../math';
import { areEnemies, hurtbox, isAlive, GUARD_MAX, type Fighter } from '../characters/fighter';
import { getCharacter } from '../characters';
import type { GameEvent } from '../engine/events';
import { attackPhase, attackRect } from './attack';
import { PERFECT_GUARD_TICKS, breakGuard } from './guard';

const PARRY_STUN = 30;
const HITSTUN_BASE = 8;
const HITSTUN_PER_KB = 0.035;

/** Ce qui suffit pour éjecter un combattant (attaque ou objet). */
export interface HitProps {
  damage: number;
  baseKb: number;
  kbGrowth: number;
  angle: number;
  guardDamage: number;
}

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
      const x = (a.x + t.x) / 2;
      const y = t.y - 12;
      if (t.action === 'guard' && t.guardTicks <= PERFECT_GUARD_TICKS) {
        parry(a, t, x, y, events);
        break;
      }
      if (t.action === 'guard') {
        blockHit(t, def.guardDamage, a.facing, x, y, events);
        a.vx = -a.facing * 50;
        continue;
      }
      const kb = launchFighter(t, def, a.facing, a.id, events);
      a.attackHit = true;
      events.push({ type: 'hit', x, y, attacker: a.id, target: t.id, slot: def.slot, power: kb, combo: t.combo });
    }
  }
}

/** Garde parfaite : l'attaquant est étourdi, le défenseur peut contre-attaquer. */
function parry(a: Fighter, t: Fighter, x: number, y: number, events: GameEvent[]): void {
  a.action = 'hitstun';
  a.attack = null;
  a.stun = PARRY_STUN;
  a.vx = -a.facing * 90;
  t.action = 'free';
  t.guard = Math.min(GUARD_MAX, t.guard + 15);
  events.push({ type: 'parry', x, y, target: t.id, attacker: a.id });
}

/** Coup bloqué par la garde (peut la briser). */
export function blockHit(t: Fighter, guardDamage: number, dirX: number, x: number, y: number, events: GameEvent[]): void {
  t.guard -= guardDamage;
  t.vx = dirX * (60 + guardDamage * 2);
  events.push({ type: 'block', x, y, target: t.id });
  if (t.guard <= 0) {
    breakGuard(t);
    events.push({ type: 'guardbreak', x, y, target: t.id });
  }
}

/** Applique dégâts + knockback + hitstun. Retourne la force d'éjection (px/s). */
export function launchFighter(t: Fighter, hit: HitProps, dirX: number, sourceId: string | null, _events: GameEvent[]): number {
  t.damage = Math.min(999, t.damage + hit.damage);
  const kb = (hit.baseKb + t.damage * hit.kbGrowth) * getCharacter(t.charId).kbTaken;
  const ang = (hit.angle * Math.PI) / 180;
  t.vx = Math.cos(ang) * kb * dirX;
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
  if (sourceId) t.lastHitBy = sourceId;
  if (t.grapple && t.grapple.phase !== 'retract') t.grapple.phase = 'retract';
  return kb;
}
