import { Btn } from '../input';
import type { ArenaDef } from '../arenas/types';
import { isAlive, type Fighter } from '../characters/fighter';

/**
 * IA très simple pour l'entraînement : se rapproche, frappe, garde parfois,
 * et utilise saut + grappin pour revenir sur l'arène.
 */
export class Bot {
  private t = 0;
  private plan = 0;

  constructor(
    private id: string,
    private level: 'dummy' | 'easy' = 'easy',
  ) {}

  input(fighters: Fighter[], arena: ArenaDef): number {
    this.t++;
    const me = fighters.find((f) => f.id === this.id);
    if (!me || !isAlive(me) || this.level === 'dummy') return 0;
    const main = arena.platforms.reduce((a, p) => (p.w > a.w ? p : a));
    let b = 0;

    // Récupération : hors de la plateforme principale et en dessous du bord.
    const offStage = me.x < main.x - 4 || me.x > main.x + main.w + 4;
    if (offStage && !me.grounded) {
      const toward = me.x < main.x ? Btn.Right : Btn.Left;
      b |= toward;
      if (me.vy > 0 && me.airJumpsLeft > 0 && this.t % 3 === 0) b |= Btn.Up;
      else if (me.airJumpsLeft === 0 && me.grappleCooldown === 0 && !me.grapple && me.y > main.y - 30) b |= Btn.Grapple | Btn.Up;
      return b;
    }

    const target = fighters
      .filter((f) => f.id !== me.id && f.team !== me.team && isAlive(f))
      .sort((a, c) => Math.abs(a.x - me.x) - Math.abs(c.x - me.x))[0];
    if (!target) return 0;
    const dx = target.x - me.x;
    const dist = Math.abs(dx);

    if (this.t % 90 === 0) this.plan = Math.floor(Math.random() * 4);

    // Garde quand l'adversaire prépare une attaque proche.
    if (target.action === 'attack' && dist < 34 && this.plan === 0) return Btn.Guard;

    if (dist > 26) {
      b |= dx > 0 ? Btn.Right : Btn.Left;
      if (target.y < me.y - 30 && me.grounded && this.t % 40 === 0) b |= Btn.Up;
      if (dist > 120 && this.plan === 1 && me.grappleCooldown === 0 && this.t % 20 === 0) b |= Btn.Grapple;
    } else if (this.t % 16 === 0) {
      if (me.facing !== Math.sign(dx)) b |= dx > 0 ? Btn.Right : Btn.Left;
      const r = Math.random();
      b |= r < 0.55 ? Btn.Light : r < 0.85 ? Btn.Medium : Btn.Heavy;
    }
    return b;
  }
}
