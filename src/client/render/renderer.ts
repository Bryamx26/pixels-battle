import type { ArenaDef } from '../../shared/arenas';
import { VIEW_H, VIEW_W } from '../../shared/constants';
import type { Fighter } from '../../shared/characters/fighter';
import { getCharacter } from '../../shared/characters';
import type { GameEvent } from '../../shared/engine/events';
import { clamp } from '../../shared/math';
import type { MatchView } from '../game/matchSource';
import { drawAnchors, renderArenaBackground } from './arenaRenderer';
import { Effects } from './effects';
import { drawChain, drawFighter, drawLabel } from './fighterRenderer';
import { playerColor } from './palette';
import { drawText } from './pixelFont';
import { drawItems } from './itemRenderer';

/** Caméra : zoom doux sur les combattants (rendu natif puis agrandi au plus proche voisin). */
const MAX_ZOOM = 1.45;
const CAM_MARGIN_X = 80;
const CAM_MARGIN_Y = 70;

interface Track {
  grounded: boolean;
  action: Fighter['action'];
  trail: { x: number; y: number }[];
}

/** Rendu d'une image de combat dans le canvas natif 480×270. */
export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private out: CanvasRenderingContext2D;
  private cam = { x: VIEW_W / 2, y: VIEW_H / 2, zoom: 1 };
  private view = { x: 0, y: 0, w: VIEW_W, h: VIEW_H };
  /** Curseur souris (coordonnées normalisées du canvas) pour le réticule. */
  cursor: { x: number; y: number; color: string } | null = null;
  private bg: HTMLCanvasElement;
  private fx = new Effects();
  private time = 0;
  private flashes = new Map<string, number>();
  private tracks = new Map<string, Track>();
  private goTimer = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private arena: ArenaDef,
    private localId: string,
  ) {
    const world = document.createElement('canvas');
    world.width = VIEW_W;
    world.height = VIEW_H;
    this.ctx = world.getContext('2d')!;
    this.out = canvas.getContext('2d')!;
    this.out.imageSmoothingEnabled = false;
    this.bg = renderArenaBackground(arena);
  }

  /** Transforme les événements de simulation en effets. */
  private onEvents(events: GameEvent[], view: MatchView) {
    const byId = new Map(view.fighters.map((f) => [f.id, f]));
    for (const e of events) {
      switch (e.type) {
        case 'hit': {
          const heavy = e.power > 330;
          const a = byId.get(e.attacker);
          const dir = a ? a.facing : 1;
          this.fx.burst(e.x, e.y, heavy ? 16 : 8, ['#ffffff', '#ffe66d', '#ff9f43'], heavy ? 200 : 120);
          this.fx.directional(e.x, e.y, heavy ? 8 : 3, dir, -0.5, '#ffffff');
          this.fx.ring(e.x, e.y, heavy ? '#ffe66d' : '#ffffff', heavy ? 2.5 : 1.5, heavy ? 16 : 10);
          this.flashes.set(e.target, heavy ? 10 : 6);
          this.fx.shake = Math.max(this.fx.shake, Math.min(7, e.power / 120));
          if (e.combo >= 2) this.fx.popup(e.x, e.y - 22, `${e.combo} COUPS`, '#ffe66d');
          break;
        }
        case 'block':
          this.fx.burst(e.x, e.y, 6, ['#7cf5ff', '#ffffff'], 90, 0);
          break;
        case 'parry':
          this.fx.ring(e.x, e.y, '#ffffff', 3, 18);
          this.fx.burst(e.x, e.y, 14, ['#ffffff', '#7cf5ff'], 160, 0);
          this.fx.popup(e.x, e.y - 24, 'PARADE!', '#7cf5ff', 2);
          this.fx.shake = 4;
          break;
        case 'guardbreak':
          this.fx.burst(e.x, e.y, 18, ['#7cf5ff', '#ff4d4d', '#ffffff'], 180);
          this.fx.popup(e.x, e.y - 24, 'GARDE BRISEE', '#ff4d4d');
          this.fx.shake = 5;
          break;
        case 'hook':
          this.fx.burst(e.x, e.y, 8, ['#d8d6ea', '#ffffff'], 110, 0);
          this.fx.popup(e.x, e.y - 16, 'ACCROCHE!', '#ffe66d');
          this.flashes.set(e.target, 6);
          break;
        case 'ko': {
          const f = byId.get(e.target);
          const color = f ? playerColor(f, view.mode) : '#ffffff';
          const dx = e.x <= 1 ? 1 : e.x >= VIEW_W - 1 ? -1 : 0;
          const dy = e.y <= 1 ? 1 : e.y >= VIEW_H - 1 ? -1 : 0;
          this.fx.directional(e.x, e.y, 30, dx || 0.01, dy, color, 360);
          this.fx.directional(e.x, e.y, 16, dx || 0.01, dy, '#ffffff', 260);
          this.fx.ring(e.x, e.y, color, 4, 20);
          this.fx.shake = 9;
          break;
        }
        case 'itemSpawn':
          this.fx.ring(e.x, e.y, this.arena.theme.accent, 1.2, 18);
          this.fx.burst(e.x, e.y, 8, [this.arena.theme.accent, '#ffffff'], 70, 0);
          break;
        case 'pickup':
          this.fx.ring(e.x, e.y - 6, '#ffffff', 1.5, 10);
          break;
        case 'throw':
          this.fx.burst(e.x, e.y, 4, ['#d8d6ea'], 60, 0);
          break;
        case 'go':
          this.goTimer = 50;
          break;
      }
    }
  }

  render(view: MatchView, events: GameEvent[]) {
    const ctx = this.ctx;
    this.time++;
    this.onEvents(events, view);
    this.fx.update();
    for (const [id, n] of this.flashes) this.flashes.set(id, n - 1);

    // Poussière d'atterrissage / de saut, traînées de dash.
    for (const f of view.fighters) {
      let tr = this.tracks.get(f.id);
      if (!tr) this.tracks.set(f.id, (tr = { grounded: f.grounded, action: f.action, trail: [] }));
      if (tr.action === 'dead' && f.action !== 'dead') this.fx.ring(f.x, f.y - 11, '#ffffff', 2, 16);
      if (f.action !== 'dead') {
        if (f.grounded && !tr.grounded) this.fx.dust(f.x, f.y);
        if (!f.grounded && tr.grounded && f.vy < -100) this.fx.dust(f.x, f.y);
      }
      tr.grounded = f.grounded;
      tr.action = f.action;
      const fast = f.action === 'dash' || f.action === 'zip' || (f.action === 'hitstun' && Math.hypot(f.vx, f.vy) > 400);
      if (fast && this.time % 2 === 0) tr.trail.push({ x: f.x, y: f.y });
      if (!fast || tr.trail.length > 4) tr.trail.shift();
    }

    const sh = this.fx.shake;
    const ox = sh ? Math.round((Math.random() - 0.5) * sh) : 0;
    const oy = sh ? Math.round((Math.random() - 0.5) * sh) : 0;
    ctx.setTransform(1, 0, 0, 1, ox, oy);
    ctx.fillStyle = '#000';
    ctx.fillRect(-10, -10, VIEW_W + 20, VIEW_H + 20);
    ctx.drawImage(this.bg, 0, 0);
    drawAnchors(ctx, this.arena, this.time);

    for (const f of view.fighters) drawChain(ctx, f, playerColor(f, view.mode));
    drawItems(ctx, view.items, this.time, this.arena.theme.accent);

    // Images fantômes (dash, zip, grosse éjection).
    for (const f of view.fighters) {
      const tr = this.tracks.get(f.id)!;
      const c = playerColor(f, view.mode);
      const ch = getCharacter(f.charId);
      tr.trail.forEach((p, i) => {
        ctx.globalAlpha = 0.06 + i * 0.04;
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(p.x - ch.width / 2), Math.round(p.y - ch.height), ch.width, ch.height);
      });
      ctx.globalAlpha = 1;
    }

    // Le joueur local est dessiné en dernier (toujours visible).
    const order = [...view.fighters].sort((a, b) => Number(a.id === this.localId) - Number(b.id === this.localId));
    for (const f of order) {
      drawFighter(ctx, f, {
        color: playerColor(f, view.mode),
        time: this.time,
        flash: this.flashes.get(f.id) ?? 0,
      });
    }
    this.fx.draw(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const r = this.updateCamera(view);
    this.view = r;
    this.out.drawImage(ctx.canvas, r.x, r.y, r.w, r.h, 0, 0, VIEW_W, VIEW_H);
    for (const f of order) {
      if (f.action === 'dead' || f.eliminated) continue;
      const top = f.y - getCharacter(f.charId).height;
      const local = f.id === this.localId;
      drawLabel(this.out, (f.x - r.x) * r.zoom, (top - r.y) * r.zoom, local ? 'TOI' : `P${f.slot + 1}`, playerColor(f, view.mode), local ? Math.floor(this.time / 20) % 2 : 0);
    }
    this.drawOffscreen(view, r);
    this.drawCenterText(view);
    this.drawCursor();
  }

  /** Convertit une position souris (0..1 sur le canvas) en coordonnées monde. */
  toWorld(nx: number, ny: number): { x: number; y: number } {
    return { x: this.view.x + nx * this.view.w, y: this.view.y + ny * this.view.h };
  }

  private drawCursor() {
    if (!this.cursor) return;
    const ctx = this.out;
    const x = Math.round(this.cursor.x * VIEW_W);
    const y = Math.round(this.cursor.y * VIEW_H);
    for (const [c, o] of [['#000', 1], [this.cursor.color, 0]] as const) {
      ctx.fillStyle = c;
      ctx.fillRect(x - 5 + o, y + o, 3, 1);
      ctx.fillRect(x + 3 + o, y + o, 3, 1);
      ctx.fillRect(x + o, y - 5 + o, 1, 3);
      ctx.fillRect(x + o, y + 3 + o, 1, 3);
    }
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, 1, 1);
  }

  /** Cadre la zone qui contient tous les combattants vivants. */
  private updateCamera(view: MatchView) {
    const alive = view.fighters.filter((f) => f.action !== 'dead' && !f.eliminated);
    let tx = VIEW_W / 2;
    let ty = VIEW_H / 2;
    let tz = 1;
    if (alive.length && view.status !== 'countdown') {
      const xs = alive.map((f) => clamp(f.x, 0, VIEW_W));
      const ys = alive.map((f) => clamp(f.y - 11, 0, VIEW_H));
      const x0 = Math.min(...xs) - CAM_MARGIN_X;
      const x1 = Math.max(...xs) + CAM_MARGIN_X;
      const y0 = Math.min(...ys) - CAM_MARGIN_Y;
      const y1 = Math.max(...ys) + CAM_MARGIN_Y;
      tz = clamp(Math.min(VIEW_W / (x1 - x0), VIEW_H / (y1 - y0)), 1, MAX_ZOOM);
      tx = (x0 + x1) / 2;
      ty = (y0 + y1) / 2;
    }
    const c = this.cam;
    c.zoom += (tz - c.zoom) * 0.06;
    c.x += (tx - c.x) * 0.08;
    c.y += (ty - c.y) * 0.08;
    const w = VIEW_W / c.zoom;
    const h = VIEW_H / c.zoom;
    const x = clamp(c.x - w / 2, 0, VIEW_W - w);
    const y = clamp(c.y - h / 2, 0, VIEW_H - h);
    return { x, y, w, h, zoom: c.zoom };
  }

  /** Flèches au bord de l'écran pour les joueurs hors champ. */
  private drawOffscreen(view: MatchView, cam: { x: number; y: number; zoom: number }) {
    const ctx = this.out;
    for (const f of view.fighters) {
      if (f.action === 'dead' || f.eliminated) continue;
      const h = getCharacter(f.charId).height;
      const cx = (f.x - cam.x) * cam.zoom;
      const cy = (f.y - h / 2 - cam.y) * cam.zoom;
      if (cx >= 0 && cx <= VIEW_W && cy >= 0 && cy <= VIEW_H) continue;
      const x = Math.round(clamp(cx, 8, VIEW_W - 9));
      const y = Math.round(clamp(cy, 8, VIEW_H - 9));
      const c = playerColor(f, view.mode);
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 6, y - 6, 13, 13);
      ctx.fillStyle = c;
      ctx.fillRect(x - 5, y - 5, 11, 11);
      ctx.fillStyle = '#000';
      ctx.fillRect(x - 1, y - 1, 3, 3);
      // pointe vers le joueur
      const dx = Math.sign(cx - x);
      const dy = Math.sign(cy - y);
      ctx.fillStyle = c;
      ctx.fillRect(x + dx * 7 - 1, y + dy * 7 - 1, 3, 3);
    }
  }

  private drawCenterText(view: MatchView) {
    const ctx = this.out;
    if (view.status === 'countdown') {
      const n = Math.ceil(view.countdown / 60);
      drawText(ctx, String(n), VIEW_W / 2, 90, { scale: 8, color: '#ffe66d', shadow: '#000', align: 'center' });
      drawText(ctx, this.arena.name, VIEW_W / 2, 140, { scale: 2, color: '#ffffff', shadow: '#000', align: 'center' });
    } else if (this.goTimer > 0) {
      this.goTimer--;
      if (this.goTimer % 6 < 4) drawText(ctx, 'COMBAT!', VIEW_W / 2, 95, { scale: 6, color: '#ff4d4d', shadow: '#000', align: 'center' });
    }
    if (view.status === 'ended') {
      drawText(ctx, 'FIN!', VIEW_W / 2, 95, { scale: 7, color: '#ffffff', shadow: '#000', align: 'center' });
    }
  }
}
