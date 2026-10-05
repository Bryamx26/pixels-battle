/**
 * Entrées joueur encodées en bitmask : c'est la seule chose que le client
 * envoie au serveur. Le mapping clavier → boutons vit côté client
 * (src/client/input) pour pouvoir être reconfiguré.
 */
export const Btn = {
  Left: 1 << 0,
  Right: 1 << 1,
  Up: 1 << 2, // saut + direction haut
  Down: 1 << 3, // chute rapide / traverser + direction bas
  Light: 1 << 4,
  Medium: 1 << 5,
  Guard: 1 << 7,
  Grapple: 1 << 8,
  Dash: 1 << 9,
  Throw: 1 << 10, // lancer l'objet tenu
} as const;

/** Bits réservés aux boutons ; au-dessus on encode la visée souris. */
export const BUTTON_MASK = 0xffff;
const AIM_SHIFT = 16;
const AIM_FLAG = 1 << 24;

/**
 * Encode un angle de visée (radians) dans les bits hauts des entrées :
 * 256 directions, assez précis pour viser à la souris et ne coûte rien en réseau.
 */
export function encodeAim(angle: number): number {
  const a = Math.round((angle / (Math.PI * 2)) * 256) & 255;
  return AIM_FLAG | (a << AIM_SHIFT);
}

/** Vecteur unitaire de visée, ou `null` si les entrées n'en contiennent pas (clavier, bot). */
export function decodeAim(buttons: number): { x: number; y: number } | null {
  if (!(buttons & AIM_FLAG)) return null;
  const a = (((buttons >> AIM_SHIFT) & 255) / 256) * Math.PI * 2;
  return { x: Math.cos(a), y: Math.sin(a) };
}

export type ButtonName = keyof typeof Btn;

export interface InputFrame {
  seq: number;
  buttons: number;
}

export const has = (buttons: number, b: number) => (buttons & b) !== 0;

/** Direction horizontale (-1, 0, 1) et verticale (-1 = haut). */
export function inputDir(buttons: number): { dx: number; dy: number } {
  const dx = (has(buttons, Btn.Right) ? 1 : 0) - (has(buttons, Btn.Left) ? 1 : 0);
  const dy = (has(buttons, Btn.Down) ? 1 : 0) - (has(buttons, Btn.Up) ? 1 : 0);
  return { dx, dy };
}
