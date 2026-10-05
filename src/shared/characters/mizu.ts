import type { CharacterDef } from './types';
import { kaze } from './kaze';

/** Mizu : identique à Kaze (mêmes stats et attaques), en tenue bleue. */
export const mizu: CharacterDef = {
  ...kaze,
  id: 'mizu',
  name: 'Mizu',
  look: { ...kaze.look, scarf: '#3fa7ff', sprite: 'ninja-bleu' },
};
