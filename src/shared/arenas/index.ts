import type { ArenaDef } from './types';
import { skyTemple } from './skyTemple';
import { twinForge } from './twinForge';
import { floatingRuins } from './floatingRuins';

export type { ArenaDef, Platform, Anchor, ArenaTheme } from './types';

/** Registre des arènes : ajouter une arène = ajouter un fichier + une entrée ici. */
export const ARENAS: Record<string, ArenaDef> = {
  [skyTemple.id]: skyTemple,
  [twinForge.id]: twinForge,
  [floatingRuins.id]: floatingRuins,
};

export const DEFAULT_ARENA = skyTemple.id;

export function getArena(id: string): ArenaDef {
  return ARENAS[id] ?? ARENAS[DEFAULT_ARENA];
}
