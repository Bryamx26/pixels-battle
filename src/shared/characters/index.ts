import type { CharacterDef } from './types';
import { kaze } from './kaze';
import { mizu } from './mizu';

export type { CharacterDef, GrappleStats } from './types';

export const CHARACTERS: Record<string, CharacterDef> = {
  [kaze.id]: kaze,
  [mizu.id]: mizu,
};

export const DEFAULT_CHARACTER = kaze.id;

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS[id] ?? CHARACTERS[DEFAULT_CHARACTER];
}
