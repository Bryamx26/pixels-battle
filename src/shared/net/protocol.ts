import type { GameMode } from '../engine/rules';
import type { GameEvent } from '../engine/events';
import type { WorldState } from '../engine/world';

/** Messages client → serveur. */
export type ClientMsg =
  | { t: 'hello'; name: string; token?: string }
  | { t: 'create'; mode: GameMode; arenaId: string }
  | { t: 'join'; code: string }
  | { t: 'leave' }
  | { t: 'config'; mode?: GameMode; arenaId?: string }
  | { t: 'character'; charId: string }
  | { t: 'start' }
  /** Vote pour rejouer le même combat (mêmes réglages) une fois la partie finie. */
  | { t: 'rematch' }
  | { t: 'input'; inputs: [seq: number, buttons: number][] }
  | { t: 'ping'; c: number };

export interface LobbyPlayer {
  id: string;
  name: string;
  slot: number;
  team: number;
  charId: string;
  connected: boolean;
  host: boolean;
}

export interface RoomInfo {
  code: string;
  mode: GameMode;
  arenaId: string;
  phase: 'lobby' | 'match';
  /** Joueurs ayant voté pour une revanche. */
  rematch: string[];
  /** Numéro du combat (change à chaque lancement, revanche comprise). */
  matchNo: number;
  players: LobbyPlayer[];
}

/** Messages serveur → client. */
export type ServerMsg =
  | { t: 'welcome'; playerId: string; token: string; resumed: boolean }
  | { t: 'room'; room: RoomInfo | null }
  | { t: 'error'; message: string }
  | { t: 'snap'; state: WorldState; ack: number; events: GameEvent[] }
  | { t: 'pong'; c: number };
