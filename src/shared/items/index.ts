import type { ItemType } from './item';
import { Shuriken } from './shuriken';
import { Bomb } from './bomb';
import { Sword } from './sword';

export { ItemType } from './item';
export type { ItemState, ItemHit, ItemPhase, ItemExplosion, MeleeBoost } from './item';

const types: ItemType[] = [new Shuriken(), new Bomb(), new Sword()];

/** Registre des types d'objets disponibles. */
export const ITEM_TYPES: Record<string, ItemType> = Object.fromEntries(types.map((t) => [t.id, t]));

export function getItemType(id: string): ItemType {
  return ITEM_TYPES[id];
}

/** Bonus de mêlée de l'objet tenu (épée), ou null. */
export function heldMelee(f: { heldItem: string | null }) {
  return f.heldItem ? (ITEM_TYPES[f.heldItem]?.melee ?? null) : null;
}
