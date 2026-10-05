import { Btn, type ButtonName } from '../../shared/input';

/**
 * Bindings clavier + souris → boutons logiques. On utilise `KeyboardEvent.code`
 * (position physique) : WASD en QWERTY = ZQSD en AZERTY.
 * Ce tableau est le seul endroit à modifier pour reconfigurer les contrôles.
 */
export const DEFAULT_BINDINGS: Record<string, ButtonName> = {
  KeyA: 'Left',
  KeyD: 'Right',
  Space: 'Up', // saut ; pendant le grappin : lâcher en gardant l'élan
  KeyW: 'Up',
  KeyS: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  KeyJ: 'Light',
  KeyK: 'Medium',
  ShiftLeft: 'Guard',
  ShiftRight: 'Guard',
  KeyE: 'Dash',
  KeyF: 'Throw',
};

/** Boutons de la souris (MouseEvent.button) → boutons logiques. */
export const MOUSE_BINDINGS: Record<number, ButtonName> = {
  0: 'Light', // clic gauche : attaque rapide
  2: 'Grapple', // clic droit : grappin vers le curseur
  1: 'Throw', // clic molette : lancer l'objet tenu (aussi F)
};

export class Keyboard {
  private held = new Set<string>();
  /** Appuis courts entre deux ticks : on ne les perd pas même si relâchés aussitôt. */
  private tapped = 0;
  private mouseHeld = new Set<number>();
  /** Position de la souris sur le canvas, normalisée 0..1 (null = hors canvas). */
  mouse: { x: number; y: number } | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private bindings: Record<string, ButtonName> = DEFAULT_BINDINGS,
    private mouseBindings: Record<number, ButtonName> = MOUSE_BINDINGS,
  ) {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.clear);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    this.mouse = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  private onMouseDown = (e: MouseEvent) => {
    const name = this.mouseBindings[e.button];
    if (!name) return;
    e.preventDefault();
    this.onMouseMove(e);
    this.mouseHeld.add(e.button);
    this.tapped |= Btn[name];
  };

  private onMouseUp = (e: MouseEvent) => {
    this.mouseHeld.delete(e.button);
  };

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
    this.mouseHeld.clear();
    this.tapped = 0;
  };

  /** Boutons pour le tick courant (maintenus + tapés depuis le dernier tick). */
  sample(): number {
    let b = this.tapped;
    for (const code of this.held) b |= Btn[this.bindings[code]];
    for (const m of this.mouseHeld) b |= Btn[this.mouseBindings[m]];
    this.tapped = 0;
    return b;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.clear);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
