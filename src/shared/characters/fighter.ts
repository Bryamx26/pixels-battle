import type { Rect } from '../math';
import type { AttackSlot } from '../combat/types';
import { getCharacter } from './index';
import { DEFAULT_STOCKS } from '../constants';

/**
 * Machine à états d'un combattant :
 *  free       → contrôle normal (sol/air)
 *  attack     → attaque en cours (startup / active / recovery)
 *  dash       → dash au sol ou aérien (invulnérable au début = esquive)
 *  guard      → garde maintenue
 *  hitstun    → éjecté après un coup, aucune action possible
 *  hooked     → accroché par le kunai adverse et tiré
 *  zip        → tiré vers un point d'accroche par son propre grappin
 *  guardbreak → garde brisée, étourdi
 *  dead       → hors de l'arène, en attente de réapparition
 */
export type Action = 'free' | 'attack' | 'dash' | 'guard' | 'hitstun' | 'hooked' | 'zip' | 'guardbreak' | 'dead';

export type GrapplePhase = 'fly' | 'attached' | 'hooked' | 'retract';

export interface GrappleState {
  phase: GrapplePhase;
  x: number;
  y: number;
  /** Position précédente (pour tester les collisions en segment). */
  px: number;
  py: number;
  vx: number;
  vy: number;
  targetId: string | null;
  /** Planté dans une plateforme (le zip vise au-dessus du bord). */
  onLedge: boolean;
  ticks: number;
}

/** État complet d'un combattant. Uniquement des données JSON (sérialisé tel quel). */
export interface Fighter {
  id: string;
  name: string;
  charId: string;
  slot: number;
  team: number;

  x: number; // centre horizontal
  y: number; // pieds
  vx: number;
  vy: number;
  facing: 1 | -1;
  grounded: boolean;
  onSoft: boolean;

  airJumpsLeft: number;
  airDashUsed: boolean;
  dropTimer: number;
  fastFalling: boolean;

  action: Action;
  actionTicks: number;
  attack: AttackSlot | null;
  attackSeq: number;
  attackHit: boolean;
  attackCanceled: boolean;
  hitIds: string[];
  chain: number;

  /** Ticks restants de hitstun / guardbreak / hooked. */
  stun: number;
  hookedBy: string | null;
  combo: number;
  lastHitBy: string | null;

  damage: number;
  stocks: number;
  eliminated: boolean;
  respawnTimer: number;
  invuln: number;

  guard: number;
  guardTicks: number;
  guardRegenDelay: number;

  dashCooldown: number;
  grapple: GrappleState | null;
  grappleCooldown: number;
  /** Objet tenu (id de type), un seul à la fois. */
  heldItem: string | null;
  /** Coups restants avant que l'objet tenu se brise (épée). */
  itemUses: number;

  /** Buffer d'entrées : les appuis restent valides quelques ticks. */
  bufBtns: number;
  bufTicks: number;
  prevButtons: number;

  kos: number;
  falls: number;
  connected: boolean;
}

export const GUARD_MAX = 100;

export interface FighterSpawn {
  id: string;
  name: string;
  charId: string;
  slot: number;
  team: number;
}

export function createFighter(s: FighterSpawn, spawn: { x: number; y: number }, stocks = DEFAULT_STOCKS): Fighter {
  return {
    ...s,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    facing: spawn.x < 240 ? 1 : -1,
    grounded: false,
    onSoft: false,
    airJumpsLeft: getCharacter(s.charId).airJumps,
    airDashUsed: false,
    dropTimer: 0,
    fastFalling: false,
    action: 'free',
    actionTicks: 0,
    attack: null,
    attackSeq: 0,
    attackHit: false,
    attackCanceled: false,
    hitIds: [],
    chain: 0,
    stun: 0,
    hookedBy: null,
    combo: 0,
    lastHitBy: null,
    damage: 0,
    stocks,
    eliminated: false,
    respawnTimer: 0,
    invuln: 0,
    guard: GUARD_MAX,
    guardTicks: 0,
    guardRegenDelay: 0,
    dashCooldown: 0,
    grapple: null,
    grappleCooldown: 0,
    heldItem: null,
    itemUses: 0,
    bufBtns: 0,
    bufTicks: 0,
    prevButtons: 0,
    kos: 0,
    falls: 0,
    connected: true,
  };
}

export function hurtbox(f: Fighter): Rect {
  const ch = getCharacter(f.charId);
  return { x: f.x - ch.width / 2, y: f.y - ch.height, w: ch.width, h: ch.height };
}

/** Main qui tient la chaîne (origine du kunai). */
export function handPos(f: Fighter): { x: number; y: number } {
  return { x: f.x + f.facing * 5, y: f.y - 14 };
}

export function bodyCenter(f: Fighter): { x: number; y: number } {
  return { x: f.x, y: f.y - getCharacter(f.charId).height / 2 };
}

export const isAlive = (f: Fighter) => !f.eliminated && f.action !== 'dead';

/** Deux combattants peuvent-ils se toucher ? (pas de tir allié) */
export const areEnemies = (a: Fighter, b: Fighter) => a.id !== b.id && a.team !== b.team;
