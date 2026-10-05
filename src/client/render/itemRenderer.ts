import type { ItemState } from '../../shared/items';
import { ring } from './arenaRenderer';

const STEEL = '#d8d6ea';
const DARK = '#6d6a85';

/**
 * Shuriken pixel art (étoile à 4 branches) ; `rot` alterne deux orientations
 * pour donner l'impression de rotation pendant le vol.
 */
function shuriken(ctx: CanvasRenderingContext2D, x: number, y: number, rot: boolean, white = false) {
  const X = Math.round(x);
  const Y = Math.round(y);
  const px = (dx: number, dy: number, c: string) => {
    ctx.fillStyle = white ? '#fff' : c;
    ctx.fillRect(X + dx, Y + dy, 1, 1);
  };
  const arms = rot
    ? [[-3, -3], [-2, -2], [3, 3], [2, 2], [3, -3], [2, -2], [-3, 3], [-2, 2]]
    : [[0, -4], [0, -3], [0, 4], [0, 3], [-4, 0], [-3, 0], [4, 0], [3, 0]];
  for (const [dx, dy] of arms) px(dx, dy, STEEL);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -2], [0, 2], [-2, 0], [2, 0]]) px(dx, dy, rot ? STEEL : DARK);
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) px(dx, dy, STEEL);
  px(0, 0, '#1a1426');
}

/** Petit shuriken dessiné sur le personnage qui le tient. */
export function drawItemIcon(ctx: CanvasRenderingContext2D, x: number, y: number, time: number, white = false) {
  shuriken(ctx, x, y, Math.floor(time / 20) % 2 === 0, white);
}

/** Objets de l'arène : au sol (flottent + halo pour attirer l'œil) ou en vol (tournent). */
export function drawItems(ctx: CanvasRenderingContext2D, items: ItemState[], time: number, accent: string) {
  for (const it of items) {
    if (it.phase === 'thrown') {
      shuriken(ctx, it.x, it.y, Math.floor(time / 2) % 2 === 0);
      continue;
    }
    const bob = Math.round(Math.sin(time * 0.1 + it.uid) * 1.5);
    const y = it.y - 6 + bob;
    ctx.globalAlpha = 0.5;
    ring(ctx, it.x, y, 7 + (Math.floor(time / 10) % 2), accent);
    ctx.globalAlpha = 1;
    shuriken(ctx, it.x, y, Math.floor(time / 30) % 2 === 0);
  }
}
