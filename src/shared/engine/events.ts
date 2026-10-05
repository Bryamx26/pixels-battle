import type { AttackSlot } from '../combat/types';

export type HitSource = AttackSlot | 'item';

/**
 * Événements ponctuels produits par la simulation autoritaire.
 * Ils voyagent avec les snapshots et servent aux effets visuels côté client.
 */
export type GameEvent =
  | { type: 'hit'; x: number; y: number; attacker: string; target: string; slot: HitSource; power: number; combo: number }
  | { type: 'block'; x: number; y: number; target: string }
  | { type: 'parry'; x: number; y: number; target: string; attacker: string }
  | { type: 'guardbreak'; x: number; y: number; target: string }
  | { type: 'hook'; x: number; y: number; attacker: string; target: string }
  | { type: 'ko'; x: number; y: number; target: string; by: string | null }
  | { type: 'eliminated'; target: string }
  | { type: 'itemSpawn'; x: number; y: number; item: string }
  | { type: 'pickup'; x: number; y: number; target: string; item: string }
  | { type: 'throw'; x: number; y: number; attacker: string; item: string }
  | { type: 'go' }
  | { type: 'end'; winnerTeam: number | null };
