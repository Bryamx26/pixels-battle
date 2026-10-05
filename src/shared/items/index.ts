import type { ItemType } from './item';
import { Shuriken } from './shuriken';

export { ItemType } from './item';
export type { ItemState, ItemHit, ItemPhase } from './item';

const types: ItemType[] = [new Shuriken()];

/** Registre des types d'objets disponibles. */
export const ITEM_TYPES: Record<string, ItemType> = Object.fromEntries(types.map((t) => [t.id, t]));

export function getItemType(id: string): ItemType {
  return ITEM_TYPES[id];
}
