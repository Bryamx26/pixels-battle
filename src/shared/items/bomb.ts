import { ItemType, type ItemExplosion, type ItemHit } from './item';

/** Bombe : lancer en cloche, explose au contact ou à la fin de la mèche (dégâts de zone). */
export class Bomb extends ItemType {
  readonly id = 'bomb';
  readonly name = 'Bombe';
  /** Impact direct (rarement utilisé : l'explosion prend le relais). */
  readonly hit: ItemHit = { damage: 4, baseKb: 80, kbGrowth: 1, angle: 40, guardDamage: 10 };
  override readonly explosion: ItemExplosion = {
    radius: 32,
    hit: { damage: 14, baseKb: 250, kbGrowth: 2.6, angle: 50, guardDamage: 45 },
  };
  override readonly radius = 4;
  override readonly throwSpeed = 380;
  override readonly gravity = 700;
  /** Mèche : explose au bout de 1,4 s de vol. */
  override readonly flightTicks = 85;
  override readonly spawnWeight = 0.8;
}
