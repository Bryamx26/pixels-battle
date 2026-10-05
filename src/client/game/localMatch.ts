import { getArena, type ArenaDef } from '../../shared/arenas';
import { Bot } from '../../shared/ai/bot';
import type { GameEvent } from '../../shared/engine/events';
import { World } from '../../shared/engine/world';
import type { Fighter } from '../../shared/characters/fighter';
import { lerp } from '../../shared/math';
import type { MatchSource, MatchView } from './matchSource';

/** Entraînement hors-ligne : la même simulation que le serveur, dans le navigateur. */
export class LocalMatch implements MatchSource {
  readonly localId = 'local';
  readonly arena: ArenaDef;
  readonly world: World;
  private bot: Bot;
  private prev = new Map<string, { x: number; y: number }>();

  constructor(arenaId: string, charId: string, botLevel: 'dummy' | 'easy') {
    this.arena = getArena(arenaId);
    this.world = new World(arenaId, '1v1', [
      { id: 'local', name: 'Toi', charId, slot: 0, team: 0 },
      { id: 'cpu', name: botLevel === 'dummy' ? 'Mannequin' : 'CPU', charId: charId === 'kaze' ? 'tetsu' : 'kaze', slot: 1, team: 1 },
    ]);
    this.bot = new Bot('cpu', botLevel);
  }

  tick(buttons: number): void {
    for (const f of this.world.state.fighters) this.prev.set(f.id, { x: f.x, y: f.y });
    this.world.step({ local: buttons, cpu: this.bot.input(this.world.state.fighters, this.arena, this.world.state.items) });
  }

  view(alpha: number): MatchView {
    const s = this.world.state;
    const fighters: Fighter[] = s.fighters.map((f) => {
      const p = this.prev.get(f.id);
      if (!p || Math.hypot(p.x - f.x, p.y - f.y) > 48) return f;
      return { ...f, x: lerp(p.x, f.x, alpha), y: lerp(p.y, f.y, alpha) };
    });
    return { fighters, items: s.items, status: s.status, countdown: s.countdown, winnerTeam: s.winnerTeam, mode: s.mode };
  }

  drainEvents(): GameEvent[] {
    return this.world.drainEvents();
  }

  dispose(): void {}
}
