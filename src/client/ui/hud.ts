import type { Fighter } from '../../shared/characters/fighter';
import { GUARD_MAX } from '../../shared/characters/fighter';
import { getCharacter } from '../../shared/characters';
import { getItemType } from '../../shared/items';
import type { GameMode } from '../../shared/engine/rules';
import { playerColor } from '../render/palette';

/** Couleur du pourcentage : blanc → jaune → orange → rouge. */
function damageColor(d: number): string {
  if (d < 40) return '#ffffff';
  if (d < 80) return '#ffe66d';
  if (d < 120) return '#ff9f43';
  return '#ff4d4d';
}

interface Card {
  el: HTMLElement;
  pct: HTMLElement;
  stocks: HTMLElement;
  bar: HTMLElement;
  dc: HTMLElement;
  last: string;
  damage: number;
}

/** HUD DOM : une carte par joueur (pourcentage, vies, garde). Écrit le DOM seulement si ça change. */
export class Hud {
  private cards = new Map<string, Card>();

  constructor(private root: HTMLElement) {}

  clear(): void {
    this.root.innerHTML = '';
    this.cards.clear();
  }

  update(fighters: Fighter[], mode: GameMode, localId: string, stocksMax: number): void {
    for (const f of fighters) {
      let c = this.cards.get(f.id);
      if (!c) {
        const el = document.createElement('div');
        el.className = 'hud-card';
        el.style.setProperty('--c', playerColor(f, mode));
        const me = f.id === localId ? ' <small>(toi)</small>' : '';
        el.innerHTML = `<div class="name">P${f.slot + 1} ${escapeHtml(f.name)}${me} <small>${getCharacter(f.charId).name}</small> <span class="dc"></span></div>
          <div class="pct">0%</div><div class="stocks"></div><div class="bar"><i></i></div>`;
        this.root.appendChild(el);
        c = {
          el,
          pct: el.querySelector('.pct')!,
          stocks: el.querySelector('.stocks')!,
          bar: el.querySelector('.bar i')!,
          dc: el.querySelector('.dc')!,
          last: '',
          damage: 0,
        };
        this.cards.set(f.id, c);
      }
      const key = `${Math.floor(f.damage)}|${f.stocks}|${Math.round(f.guard / 5)}|${f.eliminated}|${f.connected}|${f.heldItem}`;
      if (key === c.last) continue;
      c.last = key;
      const dmg = Math.floor(f.damage);
      c.pct.textContent = `${dmg}%`;
      c.pct.style.color = damageColor(dmg);
      if (dmg > c.damage) {
        c.el.classList.remove('shake');
        void c.el.offsetWidth;
        c.el.classList.add('shake');
      }
      c.damage = dmg;
      c.stocks.innerHTML = Array.from({ length: stocksMax }, (_, i) => `<span class="stock${i < f.stocks ? '' : ' lost'}"></span>`).join('');
      const g = Math.max(0, f.guard / GUARD_MAX);
      c.bar.style.width = `${g * 100}%`;
      c.bar.classList.toggle('low', g < 0.25);
      c.el.classList.toggle('out', f.eliminated);
      c.dc.style.color = f.connected ? '#ffe66d' : '';
      c.dc.textContent = f.connected ? (f.heldItem ? `✦ ${getItemType(f.heldItem)?.name ?? ''}` : '') : '· déconnecté';
    }
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
