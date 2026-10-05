import { Btn, type ButtonName } from '../../shared/input';

/**
 * Bindings clavier → boutons logiques. On utilise `KeyboardEvent.code`
 * (position physique) : WASD en QWERTY = ZQSD en AZERTY.
 * Ce tableau est le seul endroit à modifier pour reconfigurer les contrôles.
 */
export const DEFAULT_BINDINGS: Record<string, ButtonName> = {
  KeyA: 'Left',
  KeyD: 'Right',
  KeyW: 'Up',
  KeyS: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  KeyJ: 'Light',
  KeyK: 'Medium',
  KeyL: 'Heavy',
  ShiftLeft: 'Guard',
  ShiftRight: 'Guard',
  KeyE: 'Grapple',
  Space: 'Dash',
};

export class Keyboard {
  private held = new Set<string>();
  /** Appuis courts entre deux ticks : on ne les perd pas même si relâchés aussitôt. */
  private tapped = 0;

  constructor(private bindings: Record<string, ButtonName> = DEFAULT_BINDINGS) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.clear);
  }

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  }

  private onDown = (e: KeyboardEvent) => {
    if (this.isTyping(e)) return;
    const name = this.bindings[e.code];
    if (!name) return;
    e.preventDefault();
    if (!e.repeat) {
      this.held.add(e.code);
      this.tapped |= Btn[name];
    }
  };

  private onUp = (e: KeyboardEvent) => {
    if (this.bindings[e.code]) this.held.delete(e.code);
  };

  clear = () => {
    this.held.clear();
    this.tapped = 0;
  };

  /** Boutons pour le tick courant (maintenus + tapés depuis le dernier tick). */
  sample(): number {
    let b = this.tapped;
    for (const code of this.held) b |= Btn[this.bindings[code]];
    this.tapped = 0;
    return b;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.clear);
  }
}
