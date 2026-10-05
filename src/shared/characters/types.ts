import type { AttackDef, AttackSlot } from '../combat/types';

export interface GrappleStats {
  /** Vitesse du kunai (px/s). */
  speed: number;
  /** Portée maximale de la chaîne (px). */
  range: number;
  /** Vitesse à laquelle le lanceur est tiré vers un point d'accroche. */
  zipSpeed: number;
  /** Vitesse à laquelle un ennemi accroché est ramené. */
  pullSpeed: number;
  /** Dégâts à l'accrochage d'un ennemi. */
  hookDamage: number;
  /** Temps de récupération après un lancer (ticks). */
  cooldown: number;
}

/**
 * Un personnage = des stats de déplacement + un kit d'attaques + un grappin.
 * Ajouter un personnage revient à créer un nouveau CharacterDef.
 */
export interface CharacterDef {
  id: string;
  name: string;
  width: number;
  height: number;
  runSpeed: number;
  groundAccel: number;
  groundFriction: number;
  airSpeed: number;
  airAccel: number;
  jumpVel: number;
  doubleJumpVel: number;
  gravity: number;
  maxFall: number;
  fastFall: number;
  airJumps: number;
  dashSpeed: number;
  dashTicks: number;
  /** Multiplicateur de knockback reçu (plus petit = plus lourd). */
  kbTaken: number;
  attacks: Record<AttackSlot, AttackDef>;
  grapple: GrappleStats;
  /** Couleurs du sprite (le joueur reçoit en plus une couleur d'équipe). */
  look: {
    body: string;
    trim: string;
    skin: string;
    scarf: string;
    /** Planche de sprites (client) ; sans elle le personnage est dessiné en procédural. */
    sprite?: string;
  };
}
