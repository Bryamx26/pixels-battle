import type { ClientMsg, ServerMsg } from '../../shared/net/protocol';

const TOKEN_KEY = 'pb.token';

type Listener = (msg: ServerMsg) => void;

/**
 * Connexion WebSocket au serveur avec reconnexion automatique.
 * Le token (sessionStorage, propre à chaque onglet) permet au serveur de
 * rendre au joueur sa place dans la salle / le combat.
 */
export class Connection {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private retry = 0;
  private closedByUser = false;
  playerId: string | null = null;
  rtt = 0;
  onStatus: (s: 'online' | 'reconnecting' | 'offline') => void = () => {};

  constructor(private name: string) {}

  private get url(): string {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  private static readToken(): string | undefined {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ?? undefined;
    } catch {
      return undefined;
    }
  }

  private static writeToken(t: string): void {
    try {
      sessionStorage.setItem(TOKEN_KEY, t);
    } catch {
      /* stockage indisponible : pas de reprise après rechargement */
    }
  }

  connect(): void {
    this.closedByUser = false;
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.sendNow({ t: 'hello', name: this.name, token: Connection.readToken() });
    };
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data) as ServerMsg;
      if (msg.t === 'welcome') {
        this.playerId = msg.playerId;
        Connection.writeToken(msg.token);
        this.onStatus('online');
      } else if (msg.t === 'pong') {
        this.rtt = performance.now() - msg.c;
      }
      for (const l of this.listeners) l(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.closedByUser) return;
      this.ws = null;
      this.onStatus(this.retry > 8 ? 'offline' : 'reconnecting');
      const delay = Math.min(500 * 2 ** this.retry, 5000);
      this.retry++;
      setTimeout(() => this.connect(), delay);
    };
  }

  private sendNow(msg: ClientMsg): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  send(msg: ClientMsg): void {
    this.sendNow(msg);
  }

  on(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  close(): void {
    this.closedByUser = true;
    this.ws?.close();
  }
}
