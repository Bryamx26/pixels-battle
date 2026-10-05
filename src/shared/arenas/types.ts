import type { Rect } from '../math';

export type PlatformKind = 'solid' | 'soft';

/**
 * - solid : bloque dans toutes les directions.
 * - soft  : traversable par le bas, on peut descendre au travers (S).
 * Toutes les plateformes avec `grapple: true` acceptent le kunai.
 */
export interface Platform extends Rect {
  kind: PlatformKind;
  grapple: boolean;
}

/** Point d'accroche dédié au grappin (anneau suspendu). */
export interface Anchor {
  x: number;
  y: number;
  r: number;
}

export interface ArenaTheme {
  skyTop: string;
  skyBottom: string;
  far: string;
  near: string;
  top: string;
  body: string;
  dark: string;
  soft: string;
  accent: string;
}

export interface ArenaDef {
  id: string;
  name: string;
  /** Hors de ces limites, le joueur perd une vie. */
  blast: { left: number; right: number; top: number; bottom: number };
  platforms: Platform[];
  anchors: Anchor[];
  /** Positions des pieds au spawn, indexées par slot de joueur. */
  spawns: { x: number; y: number }[];
  /** Points d'apparition des objets (ils tombent ensuite sur la plateforme dessous). */
  itemSpawns: { x: number; y: number }[];
  theme: ArenaTheme;
}
