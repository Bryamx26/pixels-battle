import { getArena, type ArenaDef } from '../../shared/arenas';
import type { Fighter } from '../../shared/characters/fighter';
import { stepFighter } from '../../shared/characters/controller';
import type { GameEvent } from '../../shared/engine/events';
import type { WorldState } from '../../shared/engine/world';
import type { InputFrame } from '../../shared/input';
import { lerp } from '../../shared/math';
import type { ServerMsg } from '../../shared/net/protocol';
import type { MatchSource, MatchView } from '../game/matchSource';
import type { Connection } from './connection';

/** Retard d'affichage des autres joueurs (ticks) : absorbe la gigue réseau. */
const INTERP_DELAY = 6;
const MAX_SNAPSHOTS = 40;
const MAX_PENDING = 180;
/** Au-delà, on téléporte au lieu de lisser (réapparition, grosse correction). */
const SNAP_DIST = 48;

interface Snap {
  tick: number;
  state: WorldState;
}

/**
 * Combat en ligne :
 *  - le joueur local est **prédit** : ses entrées sont appliquées tout de suite
 *    via la même `stepFighter` que le serveur, puis réconciliées à chaque
 *    snapshot (on repart de l'état serveur et on rejoue les entrées non acquittées) ;
 *  - les autres joueurs sont **interpolés** entre deux snapshots, avec un léger retard.
 */
export class OnlineMatch implements MatchSource {
  readonly arena: ArenaDef;
  private seq = 0;
  private pending: InputFrame[] = [];
  private snaps: Snap[] = [];
  private predicted: Fighter | null = null;
  private prevPos = { x: 0, y: 0 };
  /** Décalage visuel résiduel après correction (lissé vers 0). */
  private errX = 0;
  private errY = 0;
  private serverTick = -1;
  private events: { tick: number; e: GameEvent }[] = [];
  private unsub: () => void;

  constructor(
    private conn: Connection,
    readonly localId: string,
    arenaId: string,
  ) {
    this.arena = getArena(arenaId);
    this.unsub = conn.on((m) => this.onMessage(m));
  }

  private get latest(): Snap | undefined {
    return this.snaps[this.snaps.length - 1];
  }

  private onMessage(m: ServerMsg): void {
    if (m.t !== 'snap') return;
    const s = m.state;
    if (this.latest && s.tick <= this.latest.tick) return;
    this.snaps.push({ tick: s.tick, state: s });
    if (this.snaps.length > MAX_SNAPSHOTS) this.snaps.shift();
    for (const e of m.events) this.events.push({ tick: s.tick, e });

    // Horloge serveur estimée, recalée en douceur.
    if (this.serverTick < 0 || Math.abs(s.tick - this.serverTick) > 30) this.serverTick = s.tick;
    else this.serverTick += (s.tick - this.serverTick) * 0.1;

    this.reconcile(s, m.ack);
  }

  private reconcile(s: WorldState, ack: number): void {
    const auth = s.fighters.find((f) => f.id === this.localId);
    if (!auth) return;
    this.pending = this.pending.filter((i) => i.seq > ack);
    const me: Fighter = structuredClone(auth);
    let countdown = s.status === 'countdown' ? s.countdown : 0;
    for (const i of this.pending) {
      const live = s.status === 'playing' || (s.status === 'countdown' && --countdown <= 0);
      stepFighter(me, live ? i.buttons : 0, this.arena);
    }
    if (this.predicted) {
      const dx = this.predicted.x + this.errX - me.x;
      const dy = this.predicted.y + this.errY - me.y;
      if (Math.hypot(dx, dy) < SNAP_DIST) {
        this.errX = dx;
        this.errY = dy;
      } else {
        this.errX = this.errY = 0;
      }
    }
    this.predicted = me;
  }

  tick(buttons: number): void {
    const latest = this.latest;
    if (!latest) return;
    this.serverTick += 1;
    const frame = { seq: ++this.seq, buttons };
    this.pending.push(frame);
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    this.conn.send({ t: 'input', inputs: [[frame.seq, frame.buttons]] });

    if (this.predicted) {
      this.prevPos = { x: this.predicted.x, y: this.predicted.y };
      const st = latest.state.status;
      const live = st === 'playing' || (st === 'countdown' && latest.state.countdown - (this.serverTick - latest.tick) <= 0);
      stepFighter(this.predicted, live ? buttons : 0, this.arena);
    }
    this.errX *= 0.82;
    this.errY *= 0.82;
  }

  view(alpha: number): MatchView | null {
    const latest = this.latest;
    if (!latest) return null;
    const t = this.serverTick - INTERP_DELAY;
    let a = latest;
    let b = latest;
    for (let i = this.snaps.length - 1; i > 0; i--) {
      if (this.snaps[i - 1].tick <= t) {
        a = this.snaps[i - 1];
        b = this.snaps[i];
        break;
      }
    }
    const k = b.tick === a.tick ? 1 : Math.min(1, Math.max(0, (t - a.tick) / (b.tick - a.tick)));
    const fighters = b.state.fighters.map((fb) => {
      if (fb.id === this.localId && this.predicted) {
        const p = this.predicted;
        return {
          ...p,
          x: lerp(this.prevPos.x, p.x, alpha) + this.errX,
          y: lerp(this.prevPos.y, p.y, alpha) + this.errY,
          // Les données de score viennent toujours du serveur.
          damage: fb.damage,
          stocks: fb.stocks,
          eliminated: fb.eliminated,
          connected: fb.connected,
          kos: fb.kos,
          falls: fb.falls,
        };
      }
      const fa = a.state.fighters.find((f) => f.id === fb.id);
      if (!fa || Math.hypot(fa.x - fb.x, fa.y - fb.y) > SNAP_DIST) return fb;
      const out = { ...fb, x: lerp(fa.x, fb.x, k), y: lerp(fa.y, fb.y, k) };
      if (fa.grapple && fb.grapple) out.grapple = { ...fb.grapple, x: lerp(fa.grapple.x, fb.grapple.x, k), y: lerp(fa.grapple.y, fb.grapple.y, k) };
      return out;
    });
    const s = latest.state;
    return { fighters, status: s.status, countdown: s.countdown, winnerTeam: s.winnerTeam, mode: s.mode };
  }

  /** Les événements sont libérés au moment où l'image interpolée les atteint. */
  drainEvents(): GameEvent[] {
    const t = this.serverTick - INTERP_DELAY + 2;
    const out: GameEvent[] = [];
    while (this.events.length && this.events[0].tick <= t) out.push(this.events.shift()!.e);
    return out;
  }

  get state(): WorldState | undefined {
    return this.latest?.state;
  }

  dispose(): void {
    this.unsub();
  }
}
