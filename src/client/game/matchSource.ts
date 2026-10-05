import type { ArenaDef } from '../../shared/arenas';
import type { Fighter } from '../../shared/characters/fighter';
import type { GameEvent } from '../../shared/engine/events';
import type { MatchStatus } from '../../shared/engine/world';
import type { GameMode } from '../../shared/engine/rules';

/** Ce que le rendu affiche pour une image. */
export interface MatchView {
  fighters: Fighter[];
  status: MatchStatus;
  countdown: number;
  winnerTeam: number | null;
  mode: GameMode;
}

/**
 * Source d'un combat pour le client : en ligne (serveur autoritaire + prédiction)
 * ou locale (entraînement). Le rendu et l'UI ne connaissent que cette interface.
 */
export interface MatchSource {
  readonly localId: string;
  readonly arena: ArenaDef;
  /** Appelé à 60 Hz avec les boutons du joueur local. */
  tick(buttons: number): void;
  /** État à afficher ; `alpha` = fraction entre deux ticks. */
  view(alpha: number): MatchView | null;
  drainEvents(): GameEvent[];
  dispose(): void;
}
