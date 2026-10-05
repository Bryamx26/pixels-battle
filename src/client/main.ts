import { DEFAULT_STOCKS, VIEW_H, VIEW_W } from '../shared/constants';
import type { GameMode } from '../shared/engine/rules';
import { encodeAim } from '../shared/input';
import { handPos } from '../shared/characters/fighter';
import { playerColor } from './render/palette';
import type { RoomInfo, ServerMsg } from '../shared/net/protocol';
import { GameLoop } from './engine/gameLoop';
import { LocalMatch } from './game/localMatch';
import type { MatchSource, MatchView } from './game/matchSource';
import { Keyboard } from './input/keyboard';
import { Connection } from './net/connection';
import { OnlineMatch } from './net/onlineMatch';
import { Renderer } from './render/renderer';
import { Hud } from './ui/hud';
import * as ui from './ui/screens';
import { preloadSpriteSheets } from './render/sprites/spriteSheets';

preloadSpriteSheets();

const NAME_KEY = 'pb.name';
/** Délai entre la fin du combat et l'écran de victoire/défaite. */
const RESULTS_DELAY_MS = 1800;

const canvas = document.getElementById('game') as HTMLCanvasElement;
const stage = document.getElementById('stage')!;
const hud = new Hud(document.getElementById('hud')!);
const keyboard = new Keyboard(canvas);

/** Contrôleur de l'application : écrans, connexion, combat en cours. */
class App {
  private conn: Connection | null = null;
  private pendingAction: (() => void) | null = null;
  private room: RoomInfo | null = null;
  match: MatchSource | null = null;
  private matchKind: 'online' | 'local' | null = null;
  private loop: GameLoop | null = null;
  private lastView: MatchView | null = null;
  private endHandled = false;
  private paused = false;
  private screen: 'menu' | 'lobby' | 'game' | 'results' = 'menu';
  private training: { arenaId: string; charId: string; level: 'dummy' | 'easy' } | null = null;

  constructor() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.screen === 'game') this.togglePause();
    });
    this.resize();

    const params = new URLSearchParams(location.search);
    const code = params.get('code')?.toUpperCase();
    if (code) history.replaceState(null, '', location.pathname + (params.has('debug') ? '?debug' : ''));

    // Reprise après rechargement de la page : on a déjà un token de session.
    let hasToken = false;
    try {
      hasToken = !!sessionStorage.getItem('pb.token');
    } catch {
      /* ignore */
    }
    if (hasToken) this.ensureConnection(this.storedName());
    this.showMenu(code);
    if (code) this.online(this.storedName(), () => this.conn!.send({ t: 'join', code }));
  }

  private storedName(): string {
    try {
      const n = localStorage.getItem(NAME_KEY);
      if (n) return n;
    } catch {
      /* ignore */
    }
    return 'Ninja' + Math.floor(Math.random() * 90 + 10);
  }

  private saveName(n: string) {
    try {
      localStorage.setItem(NAME_KEY, n);
    } catch {
      /* ignore */
    }
  }

  private resize() {
    const scale = Math.max(0.5, Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H) * 0.98);
    canvas.style.width = `${Math.floor(VIEW_W * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW_H * scale)}px`;
    stage.style.setProperty('--scale', String(scale));
  }

  // ---------------------------------------------------------------- réseau

  private ensureConnection(name: string): Connection {
    if (this.conn) return this.conn;
    const c = new Connection(name);
    this.conn = c;
    c.onStatus = (s) => {
      if (s === 'online') ui.hideToast();
      else if (s === 'reconnecting') ui.toast('Connexion perdue, reconnexion…', 'error', 0);
      else ui.toast('Serveur injoignable.', 'error', 0);
    };
    c.on((m) => this.onServer(m));
    c.connect();
    return c;
  }

  /** Exécute une action réseau dès que la connexion est prête. */
  private online(name: string, action: () => void) {
    this.saveName(name);
    const fresh = !this.conn;
    this.ensureConnection(name);
    if (fresh || !this.conn!.playerId) this.pendingAction = action;
    else action();
  }

  private onServer(m: ServerMsg) {
    switch (m.t) {
      case 'welcome':
        if (this.pendingAction) {
          const a = this.pendingAction;
          this.pendingAction = null;
          a();
        }
        break;
      case 'error':
        ui.toast(m.message);
        break;
      case 'room':
        this.onRoom(m.room);
        break;
    }
  }

  private onRoom(room: RoomInfo | null) {
    this.room = room;
    if (this.matchKind === 'local') return;
    if (!room) {
      if (this.screen !== 'menu' && this.screen !== 'results') {
        this.stopMatch();
        this.showMenu();
      }
      return;
    }
    if (room.phase === 'match') {
      if (this.matchKind !== 'online') this.startOnline(room);
      return;
    }
    // Retour au salon : on laisse l'écran de résultats affiché jusqu'au clic.
    if (this.screen === 'results') return;
    if (this.screen === 'game' && this.lastView?.status === 'ended') return;
    if (this.matchKind === 'online') this.stopMatch();
    this.showLobby();
  }

  // ---------------------------------------------------------------- écrans

  private showMenu(code?: string) {
    this.screen = 'menu';
    stage.classList.remove('active');
    ui.showMenu(
      {
        create: (name: string, mode: GameMode, arenaId: string) =>
          this.online(name, () => this.conn!.send({ t: 'create', mode, arenaId })),
        join: (name, c) => this.online(name, () => this.conn!.send({ t: 'join', code: c })),
        training: (name, arenaId, charId, level) => {
          this.saveName(name);
          this.training = { arenaId, charId, level };
          this.startLocal();
        },
      },
      { name: this.storedName(), code },
    );
  }

  private showLobby() {
    if (!this.room || !this.conn?.playerId) return;
    this.screen = 'lobby';
    stage.classList.remove('active');
    ui.showLobby(this.room, this.conn.playerId, {
      start: () => this.conn!.send({ t: 'start' }),
      leave: () => this.conn!.send({ t: 'leave' }),
      config: (mode, arenaId) => this.conn!.send({ t: 'config', mode, arenaId }),
      character: (charId) => this.conn!.send({ t: 'character', charId }),
    });
  }

  private togglePause() {
    this.paused = !this.paused;
    if (!this.paused) {
      ui.hideScreens();
      return;
    }
    ui.showPause(
      () => this.togglePause(),
      () => {
        this.paused = false;
        if (this.matchKind === 'online') {
          this.stopMatch();
          this.conn?.send({ t: 'leave' });
        } else {
          this.stopMatch();
        }
        this.showMenu();
      },
    );
  }

  // ---------------------------------------------------------------- combat

  private startOnline(room: RoomInfo) {
    this.stopMatch();
    this.match = new OnlineMatch(this.conn!, this.conn!.playerId!, room.arenaId);
    this.matchKind = 'online';
    this.runMatch();
  }

  private startLocal() {
    this.stopMatch();
    const t = this.training!;
    this.match = new LocalMatch(t.arenaId, t.charId, t.level);
    this.matchKind = 'local';
    this.runMatch();
  }

  private runMatch() {
    const match = this.match!;
    this.screen = 'game';
    this.paused = false;
    this.endHandled = false;
    this.lastView = null;
    ui.hideScreens();
    stage.classList.add('active');
    hud.clear();
    keyboard.clear();
    const renderer = new Renderer(canvas, match.arena, match.localId);
    /** Boutons + visée souris (angle main → curseur, en coordonnées monde). */
    const sampleInput = () => {
      if (this.paused) return 0;
      let b = keyboard.sample();
      const me = this.lastView?.fighters.find((f) => f.id === match.localId);
      if (keyboard.mouse && me) {
        const w = renderer.toWorld(keyboard.mouse.x, keyboard.mouse.y);
        const h = handPos(me);
        b |= encodeAim(Math.atan2(w.y - h.y, w.x - h.x));
      }
      return b;
    };
    this.loop = new GameLoop(
      () => match.tick(sampleInput()),
      (alpha) => {
        const view = match.view(alpha);
        if (!view) return;
        this.lastView = view;
        const me = view.fighters.find((f) => f.id === match.localId);
        renderer.cursor = keyboard.mouse && me && !this.paused ? { ...keyboard.mouse, color: playerColor(me, view.mode) } : null;
        renderer.render(view, match.drainEvents());
        hud.update(view.fighters, view.mode, match.localId, DEFAULT_STOCKS);
        if (view.status === 'ended' && !this.endHandled) {
          this.endHandled = true;
          setTimeout(() => this.showEnd(), RESULTS_DELAY_MS);
        }
      },
    );
    this.loop.start();
  }

  private showEnd() {
    const v = this.lastView;
    if (!v || !this.match || this.screen !== 'game') return;
    this.screen = 'results';
    const local = this.matchKind === 'local';
    ui.showResults(v.fighters, v.winnerTeam, this.match.localId, local ? 'Rejouer' : 'Retour au salon', () => {
      this.stopMatch();
      if (local) this.startLocal();
      else if (this.room) this.showLobby();
      else this.showMenu();
    });
  }

  private stopMatch() {
    this.loop?.stop();
    this.loop = null;
    this.match?.dispose();
    this.match = null;
    this.matchKind = null;
    hud.clear();
  }
}

const app = new App();
// `?debug` expose l'application dans la console (tests, réglages).
if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { pixelsBattle: app });
