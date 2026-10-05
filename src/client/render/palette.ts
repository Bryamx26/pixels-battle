import type { Fighter } from '../../shared/characters/fighter';
import type { GameMode } from '../../shared/engine/rules';

export const SLOT_COLORS = ['#ff4d4d', '#3fa7ff', '#5ee87a', '#ffcc33'];
export const TEAM_COLORS = ['#ff4d4d', '#3fa7ff'];

/** Couleur d'identification d'un joueur (équipe en 2v2, slot sinon). */
export function playerColor(f: Pick<Fighter, 'slot' | 'team'>, mode: GameMode): string {
  return mode === '2v2' ? TEAM_COLORS[f.team % 2] : SLOT_COLORS[f.slot % SLOT_COLORS.length];
}

/** Assombrit / éclaircit une couleur hex. */
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
