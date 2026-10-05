import type { CharacterDef } from './types';
import { kaze } from './kaze';
import { tetsu } from './tetsu';

export type { CharacterDef, GrappleStats } from './types';

export const CHARACTERS: Record<string, CharacterDef> = {
  [kaze.id]: kaze,
  [tetsu.id]: tetsu,
};

export const DEFAULT_CHARACTER = kaze.id;

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS[id] ?? CHARACTERS[DEFAULT_CHARACTER];
}
