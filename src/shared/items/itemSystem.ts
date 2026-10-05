import { DT } from '../constants';
import { segmentRect } from '../math';
import { Btn, decodeAim } from '../input';
import type { ArenaDef } from '../arenas/types';
import { areEnemies, bodyCenter, handPos, hurtbox, isAlive, type Fighter } from '../characters/fighter';
import { consume } from '../engine/buffer';
import type { GameEvent } from '../engine/events';
import { blockHit, launchFighter } from '../combat/hits';
import { ITEM_TYPES, getItemType, type ItemState } from './index';

/** Nombre max d'objets en jeu (au sol, en vol ou tenus). */
export const MAX_ITEMS = 2;
export const FIRST_SPAWN_TICKS = 120;
export const SPAWN_INTERVAL_TICKS = 360;
const PICKUP_DIST = 14;
const GROUND_GRAVITY = 900;
const GROUND_MAX_FALL = 320;

export interface ItemWorld {
  items: ItemState[];
  itemTimer: number;
  itemUid: number;
  seed: number;
  fighters: Fighter[];
}

/** Générateur déterministe stocké dans l'état (rejouable). */
function rand(w: ItemWorld): number {
  w.seed = (w.seed * 1664525 + 1013904223) >>> 0;
  return w.seed / 2 ** 32;
}

/**
 * Cycle de vie des objets à chaque tick :
 * apparition → chute au sol → ramassage (1 objet max par joueur) → lancer → impact → retombe au sol.
 */
export function updateItems(w: ItemWorld, arena: ArenaDef, inputs: Record<string, number>, events: GameEvent[]): void {
  spawn(w, arena, events);
  throwHeld(w, inputs, events);
  for (const item of [...w.items]) {
    if (item.phase === 'thrown') updateThrown(w, item, arena, events);
    else updateGround(w, item, arena);
  }
  pickup(w, events);
}

function spawn(w: ItemWorld, arena: ArenaDef, events: GameEvent[]): void {
  if (--w.itemTimer > 0) return;
  w.itemTimer = SPAWN_INTERVAL_TICKS;
  const inPlay = w.items.length + w.fighters.filter((f) => f.heldItem && isAlive(f)).length;
  if (inPlay >= MAX_ITEMS || arena.itemSpawns.length === 0) return;
  // Point d'apparition loin des objets déjà présents.
  const free = arena.itemSpawns.filter((p) => w.items.every((i) => Math.hypot(i.x - p.x, i.y - p.y) > 40));
  const pts = free.length ? free : arena.itemSpawns;
  const p = pts[Math.floor(rand(w) * pts.length)];
  const types = Object.values(ITEM_TYPES);
  let r = rand(w) * types.reduce((s, t) => s + t.spawnWeight, 0);
  const type = types.find((t) => (r -= t.spawnWeight) <= 0) ?? types[0];
  w.items.push({ uid: ++w.itemUid, type: type.id, phase: 'ground', x: p.x, y: p.y, px: p.x, py: p.y, vx: 0, vy: 0, owner: null, ticks: 0 });
  events.push({ type: 'itemSpawn', x: p.x, y: p.y, item: type.id });
}

const canUseItem = (f: Fighter) => isAlive(f) && (f.action === 'free' || f.action === 'attack' || f.action === 'dash' || f.action === 'zip');

function throwHeld(w: ItemWorld, inputs: Record<string, number>, events: GameEvent[]): void {
  for (const f of w.fighters) {
    if (!f.heldItem || !canUseItem(f) || !consume(f, Btn.Throw)) continue;
    const type = getItemType(f.heldItem);
    const dir = decodeAim(inputs[f.id] ?? 0) ?? { x: f.facing, y: 0 };
    if (dir.x !== 0) f.facing = dir.x > 0 ? 1 : -1;
    const h = handPos(f);
    const item: ItemState = { uid: ++w.itemUid, type: type.id, phase: 'thrown', x: h.x, y: h.y, px: h.x, py: h.y, vx: 0, vy: 0, owner: f.id, ticks: 0 };
    type.launch(item, dir, f);
    w.items.push(item);
    f.heldItem = null;
    events.push({ type: 'throw', x: h.x, y: h.y, attacker: f.id, item: type.id });
  }
}

/** L'objet retombe et redevient ramassable. */
function drop(item: ItemState, bounce = true): void {
  item.phase = 'ground';
  item.owner = null;
  item.vx = bounce ? -item.vx * 0.15 : 0;
  item.vy = bounce ? -140 : 0;
  item.ticks = 0;
}

function remove(w: ItemWorld, item: ItemState): void {
  w.items = w.items.filter((i) => i !== item);
}

function outOfArena(item: ItemState, arena: ArenaDef): boolean {
  const b = arena.blast;
  return item.x < b.left || item.x > b.right || item.y > b.bottom || item.y < b.top;
}

function updateThrown(w: ItemWorld, item: ItemState, arena: ArenaDef, events: GameEvent[]): void {
  const type = getItemType(item.type);
  item.px = item.x;
  item.py = item.y;
  type.fly(item, DT);
  item.ticks++;
  if (outOfArena(item, arena)) return remove(w, item);

  const owner = w.fighters.find((f) => f.id === item.owner);
  for (const t of w.fighters) {
    if (!isAlive(t) || t.invuln > 0 || t.id === item.owner) continue;
    if (owner && !areEnemies(owner, t)) continue;
    if (segmentRect(item.px, item.py, item.x, item.y, hurtbox(t)) < 0) continue;
    const dirX = item.vx >= 0 ? 1 : -1;
    if (t.action === 'guard') blockHit(t, type.hit.guardDamage, dirX, item.x, item.y, events);
    else {
      const kb = launchFighter(t, type.hit, dirX, item.owner, events);
      events.push({ type: 'hit', x: item.x, y: item.y, attacker: item.owner ?? '', target: t.id, slot: 'item', power: kb, combo: t.combo });
    }
    return drop(item);
  }

  for (const p of arena.platforms) {
    if (p.kind !== 'solid') continue;
    const k = segmentRect(item.px, item.py, item.x, item.y, p);
    if (k >= 0) {
      item.x = item.px + (item.x - item.px) * k;
      item.y = item.py + (item.y - item.py) * k;
      return drop(item);
    }
  }
  if (item.ticks >= type.flightTicks) drop(item, false);
}

function updateGround(w: ItemWorld, item: ItemState, arena: ArenaDef): void {
  item.ticks++;
  item.vx *= 0.9;
  item.vy = Math.min(item.vy + GROUND_GRAVITY * DT, GROUND_MAX_FALL);
  const prevY = item.y;
  item.x += item.vx * DT;
  item.y += item.vy * DT;
  if (item.vy >= 0) {
    for (const p of arena.platforms) {
      if (item.x < p.x || item.x > p.x + p.w) continue;
      if (prevY <= p.y && item.y >= p.y) {
        item.y = p.y;
        item.vy = 0;
        item.vx = 0;
      }
    }
  }
  if (outOfArena(item, arena)) remove(w, item);
}

/** Ramassage automatique au contact, seulement les mains vides. */
function pickup(w: ItemWorld, events: GameEvent[]): void {
  for (const f of w.fighters) {
    if (f.heldItem || !canUseItem(f)) continue;
    const c = bodyCenter(f);
    const item = w.items.find((i) => i.phase === 'ground' && Math.hypot(i.x - c.x, i.y - 3 - c.y) < PICKUP_DIST);
    if (!item) continue;
    f.heldItem = item.type;
    remove(w, item);
    events.push({ type: 'pickup', x: item.x, y: item.y, target: f.id, item: item.type });
  }
}
