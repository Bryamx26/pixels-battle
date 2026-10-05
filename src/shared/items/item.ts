import type { Fighter } from '../characters/fighter';

/**
 * Objets de l'arène (armes à ramasser).
 *
 * - `ItemState` : données d'un objet présent dans l'arène (JSON, voyage dans les snapshots).
 * - `ItemType`  : classe de base qui décrit le comportement d'un type d'objet.
 *   Pour ajouter un objet : créer une sous-classe et l'enregistrer dans items/index.ts.
 *
 * Un objet tenu n'est pas dans la liste de l'arène : il est stocké dans
 * `Fighter.heldItem` (un seul objet à la fois).
 */
export type ItemPhase = 'ground' | 'thrown';

export interface ItemState {
  uid: number;
  type: string;
  phase: ItemPhase;
  x: number;
  y: number;
  /** Position précédente (collisions en segment pendant le vol). */
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Lanceur (pas de dégâts sur lui-même ni sur ses alliés). */
  owner: string | null;
  ticks: number;
}

export interface ItemHit {
  damage: number;
  baseKb: number;
  kbGrowth: number;
  /** Angle d'éjection en degrés, orienté dans le sens du vol. */
  angle: number;
  guardDamage: number;
}

/** Explosion de zone (bombe) : déclenchée à l'impact ou à la fin de la mèche. */
export interface ItemExplosion {
  radius: number;
  hit: ItemHit;
}

/** Bonus des attaques au corps à corps tant que l'objet est tenu (épée). */
export interface MeleeBoost {
  /** Allonge ajoutée à la hitbox (px). */
  reach: number;
  damage: number;
  kbMul: number;
  /** Nombre de coups portés avant que l'objet se brise. */
  uses: number;
}

export abstract class ItemType {
  abstract readonly id: string;
  abstract readonly name: string;
  /** Effet à l'impact sur un adversaire. */
  abstract readonly hit: ItemHit;
  /** Rayon de collision / ramassage (px). */
  readonly radius: number = 5;
  /** Vitesse de lancer (px/s). */
  readonly throwSpeed: number = 500;
  /** Gravité appliquée pendant le vol (0 = trajectoire droite). */
  readonly gravity: number = 0;
  /** Durée de vol max (ticks) avant de retomber. */
  readonly flightTicks: number = 60;
  /** Poids relatif dans le tirage des apparitions. */
  readonly spawnWeight: number = 1;
  /** Si défini, l'objet explose au lieu de retomber. */
  readonly explosion: ItemExplosion | null = null;
  /** Si défini, l'objet renforce les attaques tant qu'il est tenu. */
  readonly melee: MeleeBoost | null = null;

  /** Vitesse initiale lors d'un lancer dans la direction (unitaire) `dir`. */
  launch(item: ItemState, dir: { x: number; y: number }, thrower: Fighter): void {
    item.vx = dir.x * this.throwSpeed + thrower.vx * 0.25;
    item.vy = dir.y * this.throwSpeed;
  }

  /** Avance l'objet en vol d'un tick. */
  fly(item: ItemState, dt: number): void {
    item.vy += this.gravity * dt;
    item.x += item.vx * dt;
    item.y += item.vy * dt;
  }
}
