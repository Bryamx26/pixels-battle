import { ItemType, type ItemHit, type MeleeBoost } from './item';

/**
 * Épée : tenue en main, elle allonge et renforce les attaques rapides et moyennes
 * pendant quelques coups, puis se brise. On peut aussi la lancer (lourde, en cloche).
 */
export class Sword extends ItemType {
  readonly id = 'sword';
  readonly name = 'Épée';
  readonly hit: ItemHit = { damage: 12, baseKb: 200, kbGrowth: 2.4, angle: 35, guardDamage: 30 };
  override readonly melee: MeleeBoost = { reach: 12, damage: 4, kbMul: 1.25, uses: 6 };
  override readonly radius = 6;
  override readonly throwSpeed = 420;
  override readonly gravity = 600;
  override readonly flightTicks = 70;
  override readonly spawnWeight = 0.8;
}
