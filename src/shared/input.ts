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
  Heavy: 1 << 6,
  Guard: 1 << 7,
  Grapple: 1 << 8,
  Dash: 1 << 9,
} as const;

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
