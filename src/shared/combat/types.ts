import type { Rect } from '../math';

export type AttackSlot = 'light' | 'medium';

/**
 * Définition data-driven d'une attaque. Les durées sont en ticks (1/60 s).
 * La hitbox est exprimée relativement aux pieds du personnage, orientée
 * vers la droite (x positif = devant) ; elle est retournée selon `facing`.
 */
export interface AttackDef {
  slot: AttackSlot;
  startup: number;
  active: number;
  recovery: number;
  hitbox: Rect;
  damage: number;
  /** Knockback (px/s) = baseKb + dégâts_cible% × kbGrowth. */
  baseKb: number;
  kbGrowth: number;
  /** Angle d'éjection en degrés (0 = horizontal, 90 = vertical vers le haut). */
  angle: number;
  /** Dégâts infligés à la jauge de garde si l'attaque est bloquée. */
  guardDamage: number;
  /** Impulsion vers l'avant au début de la phase active (px/s). */
  lunge: number;
  /** Attaques dans lesquelles on peut annuler après avoir touché. */
  cancelInto: AttackSlot[];
  /** Le grappin peut-il annuler cette attaque après un coup réussi ? */
  cancelIntoGrapple: boolean;
}

export const attackTotal = (a: AttackDef) => a.startup + a.active + a.recovery;
