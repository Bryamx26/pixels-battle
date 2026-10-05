import { drawText } from './pixelFont';
import { ring } from './arenaRenderer';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  gravity: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  grow: number;
  life: number;
  color: string;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  scale: number;
}

/** Effets visuels légers (particules, anneaux, textes, tremblement d'écran). */
export class Effects {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private popups: Popup[] = [];
  shake = 0;

  burst(x: number, y: number, n: number, colors: string[], speed = 120, gravity = 300, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = 14 + Math.floor(Math.random() * 14);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, color: colors[i % colors.length], size, gravity });
    }
  }

  directional(x: number, y: number, n: number, dirX: number, dirY: number, color: string, speed = 260) {
    for (let i = 0; i < n; i++) {
      const spread = (Math.random() - 0.5) * 0.9;
      const a = Math.atan2(dirY, dirX) + spread;
      const v = speed * (0.5 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 22, max: 22, color, size: 2, gravity: 0 });
    }
  }

  dust(x: number, y: number) {
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? 1 : -1;
      this.particles.push({ x: x + side * 3, y: y - 1, vx: side * (30 + Math.random() * 40), vy: -10 - Math.random() * 20, life: 14, max: 14, color: '#e8e0d0', size: 2, gravity: 0 });
    }
  }

  ring(x: number, y: number, color: string, grow = 1.5, life = 14) {
    this.rings.push({ x, y, r: 2, grow, life, color });
  }

  popup(x: number, y: number, text: string, color: string, scale = 1) {
    this.popups.push({ x, y, text, color, life: 50, scale });
  }

  update() {
    const dt = 1 / 60;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.96;
      p.life--;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const r of this.rings) {
      r.r += r.grow;
      r.life--;
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const p of this.popups) {
      p.y -= 0.4;
      p.life--;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    this.shake = Math.max(0, this.shake - 0.6);
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const r of this.rings) {
      ctx.globalAlpha = Math.min(1, r.life / 8);
      ring(ctx, r.x, r.y, r.r, r.color);
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.5);
      ctx.fillStyle = p.color;
      const sz = p.life < p.max / 3 ? Math.max(1, p.size - 1) : p.size;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), sz, sz);
    }
    ctx.globalAlpha = 1;
    for (const p of this.popups) {
      if (p.life < 12 && p.life % 2) continue;
      drawText(ctx, p.text, p.x, p.y, { color: p.color, shadow: '#000', align: 'center', scale: p.scale });
    }
  }
}
