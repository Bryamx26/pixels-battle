import { COUNTDOWN_TICKS, DEFAULT_STOCKS } from '../constants';
import { getArena, type ArenaDef } from '../arenas';
import { createFighter, type Fighter, type FighterSpawn } from '../characters/fighter';
import { stepFighter } from '../characters/controller';
import { resolveAttackHits } from '../combat/hits';
import { resolveGrappleHits, updateHooks } from '../grapple/hook';
import type { GameEvent } from './events';
import { checkBlastZones, checkWinner, knockOut, type GameMode } from './rules';

export type MatchStatus = 'countdown' | 'playing' | 'ended';

/** État sérialisable complet d'un combat (envoyé dans les snapshots). */
export interface WorldState {
  tick: number;
  status: MatchStatus;
  countdown: number;
  arenaId: string;
  mode: GameMode;
  fighters: Fighter[];
  winnerTeam: number | null;
}

/**
 * Simulation autoritaire d'un combat. Ordre d'un tick :
 *   1. chaque combattant avance seul (entrées, physique, kunai vs arène)
 *   2. kunai vs combattants (accroche) puis traction
 *   3. hitbox d'attaques vs hurtbox
 *   4. zones de chute, vies, condition de victoire
 */
export class World {
  state: WorldState;
  arena: ArenaDef;
  /** Événements produits depuis le dernier `drainEvents()`. */
  private events: GameEvent[] = [];

  constructor(arenaId: string, mode: GameMode, players: FighterSpawn[], stocks = DEFAULT_STOCKS) {
    this.arena = getArena(arenaId);
    this.state = {
      tick: 0,
      status: 'countdown',
      countdown: COUNTDOWN_TICKS,
      arenaId: this.arena.id,
      mode,
      fighters: players.map((p) => createFighter(p, this.arena.spawns[p.slot % this.arena.spawns.length], stocks)),
      winnerTeam: null,
    };
  }

  fighter(id: string): Fighter | undefined {
    return this.state.fighters.find((f) => f.id === id);
  }

  step(inputs: Record<string, number>): void {
    const s = this.state;
    s.tick++;
    if (s.status === 'countdown' && --s.countdown <= 0) {
      s.status = 'playing';
      this.events.push({ type: 'go' });
    }
    const live = s.status === 'playing';
    for (const f of s.fighters) stepFighter(f, live ? inputs[f.id] ?? 0 : 0, this.arena);

    resolveGrappleHits(s.fighters, this.events);
    updateHooks(s.fighters);
    resolveAttackHits(s.fighters, this.events);
    checkBlastZones(s.fighters, this.arena, this.events);

    if (s.status === 'playing') {
      const w = checkWinner(s.fighters);
      if (w !== undefined) {
        s.status = 'ended';
        s.winnerTeam = w;
        this.events.push({ type: 'end', winnerTeam: w });
      }
    }
  }

  /** Un joueur a quitté définitivement la partie : il est éliminé. */
  eliminate(id: string): void {
    const f = this.fighter(id);
    if (!f || f.eliminated) return;
    f.stocks = 1;
    if (f.action === 'dead') {
      f.stocks = 0;
      f.eliminated = true;
      this.events.push({ type: 'eliminated', target: f.id });
    } else knockOut(f, this.state.fighters, this.events);
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
