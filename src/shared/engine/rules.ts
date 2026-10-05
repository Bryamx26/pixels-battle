import { clamp } from '../math';
import { RESPAWN_TICKS, VIEW_H, VIEW_W } from '../constants';
import type { ArenaDef } from '../arenas/types';
import { isAlive, type Fighter } from '../characters/fighter';
import { getCharacter } from '../characters';
import type { GameEvent } from './events';

export type GameMode = '1v1' | '2v2' | 'ffa';

export const MODES: Record<GameMode, { label: string; maxPlayers: number; minPlayers: number }> = {
  '1v1': { label: '1 contre 1', maxPlayers: 2, minPlayers: 2 },
  '2v2': { label: '2 contre 2', maxPlayers: 4, minPlayers: 4 },
  ffa: { label: 'Chacun pour soi', maxPlayers: 4, minPlayers: 2 },
};

export function teamForSlot(mode: GameMode, slot: number): number {
  return mode === '2v2' ? slot % 2 : slot;
}

/** Sortie de l'arène → perte d'une vie. */
export function checkBlastZones(fighters: Fighter[], arena: ArenaDef, events: GameEvent[]): void {
  const b = arena.blast;
  for (const f of fighters) {
    if (!isAlive(f)) continue;
    const h = getCharacter(f.charId).height;
    if (f.x < b.left || f.x > b.right || f.y - h > b.bottom || f.y < b.top) {
      knockOut(f, fighters, events);
    }
  }
}

export function knockOut(f: Fighter, fighters: Fighter[], events: GameEvent[]): void {
  events.push({
    type: 'ko',
    x: clamp(f.x, 0, VIEW_W),
    y: clamp(f.y - 10, 0, VIEW_H),
    target: f.id,
    by: f.lastHitBy,
  });
  const killer = fighters.find((o) => o.id === f.lastHitBy);
  if (killer && killer.id !== f.id) killer.kos++;
  f.stocks--;
  f.falls++;
  f.action = 'dead';
  f.attack = null;
  f.grapple = null;
  f.hookedBy = null;
  f.respawnTimer = RESPAWN_TICKS;
  f.vx = 0;
  f.vy = 0;
  if (f.stocks <= 0) {
    f.eliminated = true;
    events.push({ type: 'eliminated', target: f.id });
  }
}

/** Retourne l'équipe gagnante, `null` pour une égalité, `undefined` si le combat continue. */
export function checkWinner(fighters: Fighter[]): number | null | undefined {
  const teams = new Set(fighters.filter((f) => !f.eliminated).map((f) => f.team));
  if (teams.size > 1) return undefined;
  return teams.size === 1 ? [...teams][0] : null;
}
