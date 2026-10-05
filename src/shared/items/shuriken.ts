import { ItemType, type ItemHit } from './item';

/** Shuriken : se lance en ligne droite, rapide, éjection moyenne. */
export class Shuriken extends ItemType {
  readonly id = 'shuriken';
  readonly name = 'Shuriken';
  readonly hit: ItemHit = { damage: 8, baseKb: 160, kbGrowth: 2.2, angle: 25, guardDamage: 22 };
  override readonly radius = 5;
  override readonly throwSpeed = 560;
  override readonly flightTicks = 55;
}
