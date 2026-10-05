import { SNAPSHOT_EVERY } from '../../shared/constants';
import { World } from '../../shared/engine/world';
import type { GameEvent } from '../../shared/engine/events';
import { MODES, teamForSlot, type GameMode } from '../../shared/engine/rules';
import { CHARACTERS } from '../../shared/characters';
import type { LobbyPlayer, RoomInfo, ServerMsg } from '../../shared/net/protocol';
import type { Session } from './session';

/** File d'entrées au-delà de laquelle on rattrape le retard du client. */
const MAX_INPUT_QUEUE = 6;
/** Délai après la fin d'un combat avant le retour au salon. */
const END_DELAY_TICKS = 60 * 4;

interface Member {
  session: Session;
  slot: number;
  charId: string;
  queue: [number, number][];
  buttons: number;
  ack: number;
}

/**
 * Une salle privée : salon (choix du mode / arène / personnage) puis combat.
 * Le serveur est autoritaire : il fait tourner la World et diffuse des snapshots.
 */
export class Room {
  members = new Map<string, Member>();
  hostId: string;
  world: World | null = null;
  private events: GameEvent[] = [];
  private endedAt = -1;
  private rematchVotes = new Set<string>();
  private matchNo = 0;

  constructor(
    public readonly code: string,
    public mode: GameMode,
    public arenaId: string,
    host: Session,
  ) {
    this.hostId = host.id;
    this.add(host);
  }

  get phase(): RoomInfo['phase'] {
    return this.world ? 'match' : 'lobby';
  }

  get isFull(): boolean {
    return this.members.size >= MODES[this.mode].maxPlayers;
  }

  add(s: Session): void {
    const used = new Set([...this.members.values()].map((m) => m.slot));
    let slot = 0;
    while (used.has(slot)) slot++;
    const charIds = Object.keys(CHARACTERS);
    this.members.set(s.id, { session: s, slot, charId: charIds[slot % charIds.length], queue: [], buttons: 0, ack: 0 });
    s.roomCode = this.code;
    this.broadcastInfo();
  }

  /** Départ définitif (volontaire ou délai de reconnexion dépassé). */
  remove(id: string): void {
    const m = this.members.get(id);
    if (!m) return;
    this.members.delete(id);
    this.rematchVotes.delete(id);
    m.session.roomCode = null;
    this.world?.eliminate(id);
    if (this.hostId === id) {
      const next = [...this.members.values()].sort((a, b) => a.slot - b.slot)[0];
      if (next) this.hostId = next.session.id;
    }
    this.broadcastInfo();
  }

  get empty(): boolean {
    return this.members.size === 0;
  }

  setConnected(id: string, connected: boolean): void {
    const f = this.world?.fighter(id);
    if (f) f.connected = connected;
    this.broadcastInfo();
  }

  configure(by: string, mode?: GameMode, arenaId?: string): string | null {
    if (by !== this.hostId) return "Seul l'hôte peut changer les réglages.";
    if (this.world) return 'Combat en cours.';
    if (mode) {
      if (!MODES[mode]) return 'Mode inconnu.';
      if (this.members.size > MODES[mode].maxPlayers) return 'Trop de joueurs pour ce mode.';
      this.mode = mode;
    }
    if (arenaId) this.arenaId = arenaId;
    this.broadcastInfo();
    return null;
  }

  setCharacter(id: string, charId: string): void {
    const m = this.members.get(id);
    if (!m || this.world || !CHARACTERS[charId]) return;
    m.charId = charId;
    this.broadcastInfo();
  }

  start(by: string): string | null {
    if (by !== this.hostId) return "Seul l'hôte peut lancer le combat.";
    if (this.world) return 'Combat déjà en cours.';
    return this.launch();
  }

  /**
   * Revanche : chaque joueur vote depuis l'écran de résultats ; quand tous les
   * joueurs connectés ont voté, un nouveau combat démarre avec les mêmes réglages.
   */
  voteRematch(id: string): string | null {
    if (!this.members.has(id)) return null;
    if (this.world && this.world.state.status !== 'ended') return 'Combat en cours.';
    this.rematchVotes.add(id);
    const connected = [...this.members.values()].filter((m) => m.session.connected);
    if (connected.every((m) => this.rematchVotes.has(m.session.id)) && this.members.size >= MODES[this.mode].minPlayers) {
      return this.launch();
    }
    this.broadcastInfo();
    return null;
  }

  private launch(): string | null {
    const { minPlayers, maxPlayers } = MODES[this.mode];
    if (this.members.size < minPlayers) return `Il faut au moins ${minPlayers} joueurs pour ce mode.`;
    if (this.members.size > maxPlayers) return 'Trop de joueurs pour ce mode.';
    const spawns = [...this.members.values()].map((m) => ({
      id: m.session.id,
      name: m.session.name,
      charId: m.charId,
      slot: m.slot,
      team: teamForSlot(this.mode, m.slot),
    }));
    this.world = new World(this.arenaId, this.mode, spawns);
    for (const m of this.members.values()) {
      m.queue = [];
      m.buttons = 0;
      m.ack = 0;
      const f = this.world.fighter(m.session.id);
      if (f) f.connected = m.session.connected;
    }
    this.events = [];
    this.endedAt = -1;
    this.rematchVotes.clear();
    this.matchNo++;
    this.broadcastInfo();
    this.broadcastSnapshot();
    return null;
  }

  onInputs(id: string, inputs: [number, number][]): void {
    const m = this.members.get(id);
    if (!m || !this.world) return;
    for (const [seq, b] of inputs) {
      if (typeof seq !== 'number' || typeof b !== 'number' || seq <= m.ack) continue;
      m.queue.push([seq, b | 0]);
    }
  }

  tick(): void {
    const w = this.world;
    if (!w) return;
    const inputs: Record<string, number> = {};
    for (const m of this.members.values()) {
      const q = m.queue;
      // Client en avance (gigue réseau) : on fusionne les plus anciennes entrées.
      while (q.length > MAX_INPUT_QUEUE) {
        const [, b] = q.shift()!;
        q[0][1] |= b;
      }
      const next = q.shift();
      if (next) {
        m.ack = next[0];
        m.buttons = next[1];
      }
      inputs[m.session.id] = m.session.connected ? m.buttons : 0;
    }
    w.step(inputs);
    this.events.push(...w.drainEvents());

    if (w.state.tick % SNAPSHOT_EVERY === 0) this.broadcastSnapshot();

    if (w.state.status === 'ended') {
      if (this.endedAt < 0) this.endedAt = w.state.tick;
      else if (w.state.tick - this.endedAt > END_DELAY_TICKS) {
        this.world = null;
        this.broadcastInfo();
      }
    }
  }

  private broadcastSnapshot(): void {
    if (!this.world) return;
    // Sérialisé une seule fois, seul l'ack diffère par joueur.
    const body = `"events":${JSON.stringify(this.events)},"state":${JSON.stringify(this.world.state)}}`;
    this.events = [];
    for (const m of this.members.values()) m.session.sendRaw(`{"t":"snap","ack":${m.ack},${body}`);
  }

  info(): RoomInfo {
    const players: LobbyPlayer[] = [...this.members.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((m) => ({
        id: m.session.id,
        name: m.session.name,
        slot: m.slot,
        team: teamForSlot(this.mode, m.slot),
        charId: m.charId,
        connected: m.session.connected,
        host: m.session.id === this.hostId,
      }));
    return { code: this.code, mode: this.mode, arenaId: this.arenaId, phase: this.phase, players, rematch: [...this.rematchVotes], matchNo: this.matchNo };
  }

  broadcast(msg: ServerMsg): void {
    const data = JSON.stringify(msg);
    for (const m of this.members.values()) m.session.sendRaw(data);
  }

  broadcastInfo(): void {
    this.broadcast({ t: 'room', room: this.info() });
  }
}
