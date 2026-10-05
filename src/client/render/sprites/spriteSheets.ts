import ninjaJaune from '../../assets/ninja-jaune.png';
import ninjaBleu from '../../assets/ninja-bleu.png';

/** Planches de sprites disponibles, référencées par `CharacterDef.look.sprite`. */
const URLS: Record<string, string> = {
  'ninja-jaune': ninjaJaune,
  'ninja-bleu': ninjaBleu,
};

const cache = new Map<string, HTMLImageElement>();

/** Image prête à dessiner, ou `null` pendant le chargement (rendu procédural en attendant). */
export function getSpriteSheet(id: string): HTMLImageElement | null {
  let img = cache.get(id);
  if (!img) {
    const url = URLS[id];
    if (!url) return null;
    img = new Image();
    img.src = url;
    cache.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** Précharge toutes les planches (appelé au démarrage). */
export function preloadSpriteSheets(): void {
  for (const id of Object.keys(URLS)) getSpriteSheet(id);
}
