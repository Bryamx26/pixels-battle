import { Btn, type ButtonName } from '../../shared/input';
import { getBindings, onBindingsChange, type Bindings } from './controls';

/** Zone morte des sticks analogiques. */
const STICK_DEAD = 0.45;
const AIM_DEAD = 0.5;

/**
 * Entrées locales → boutons logiques : clavier (par position physique,
 * `KeyboardEvent.code`), souris et manette. Les liaisons viennent de
 * `controls.ts` (modifiables dans l'écran « Commandes »).
 */
export class Keyboard {
  private keys = new Map<string, ButtonName>();
  private mouseKeys = new Map<number, ButtonName>();
  private pad: [number, ButtonName][] = [];
  private held = new Set<string>();
  /** Appuis courts entre deux ticks : on ne les perd pas même si relâchés aussitôt. */
  private tapped = 0;
  private mouseHeld = new Set<number>();
  /** Position de la souris sur le canvas, normalisée 0..1 (null = hors canvas). */
  mouse: { x: number; y: number } | null = null;
  /** Dernier périphérique utilisé : décide si l'on vise à la souris ou au stick. */
  device: 'mouse' | 'pad' = 'mouse';
  /** Angle de visée du stick (radians), ou null s'il est au repos. */
  padAim: number | null = null;
  /** Bouton Start de la manette appuyé depuis la dernière lecture (pause). */
  padStart = false;
  private startWasDown = false;
  private unsubscribe: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.setBindings(getBindings());
    this.unsubscribe = onBindingsChange((b) => this.setBindings(b));
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.clear);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private setBindings(b: Bindings) {
    this.keys.clear();
    this.mouseKeys.clear();
    this.pad = [];
    for (const [action, codes] of Object.entries(b) as [ButtonName, string[]][]) {
      for (const code of codes) {
        const [kind, v] = code.split(':');
        if (kind === 'Key') this.keys.set(v, action);
        else if (kind === 'Mouse') this.mouseKeys.set(+v, action);
        else if (kind === 'Pad') this.pad.push([+v, action]);
      }
    }
    this.clear();
  }

  private onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const m = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    if (!this.mouse || Math.abs(m.x - this.mouse.x) + Math.abs(m.y - this.mouse.y) > 0.002) this.device = 'mouse';
    this.mouse = m;
  };

  private onMouseDown = (e: MouseEvent) => {
    const name = this.mouseKeys.get(e.button);
    if (!name) return;
    e.preventDefault();
    this.onMouseMove(e);
    this.device = 'mouse';
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
    if (this.isTyping(e) || document.body.dataset.capturing) return;
    const name = this.keys.get(e.code);
    if (!name) return;
    e.preventDefault();
    if (!e.repeat) {
      this.held.add(e.code);
      this.tapped |= Btn[name];
    }
  };

  private onUp = (e: KeyboardEvent) => {
    this.held.delete(e.code);
  };

  clear = () => {
    this.held.clear();
    this.mouseHeld.clear();
    this.tapped = 0;
  };

  /** Manette : boutons liés + stick gauche (déplacement) + visée (stick droit, sinon gauche). */
  private samplePad(): number {
    this.padAim = null;
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return 0;
    const start = !!gp.buttons[9]?.pressed;
    if (start && !this.startWasDown) this.padStart = true;
    this.startWasDown = start;
    let b = 0;
    for (const [i, action] of this.pad) {
      const btn = gp.buttons[i];
      if (btn && (btn.pressed || btn.value > 0.5)) b |= Btn[action];
    }
    const [lx = 0, ly = 0, rx = 0, ry = 0] = gp.axes;
    if (lx < -STICK_DEAD) b |= Btn.Left;
    if (lx > STICK_DEAD) b |= Btn.Right;
    if (ly > 0.6) b |= Btn.Down;
    if (Math.hypot(rx, ry) > AIM_DEAD) this.padAim = Math.atan2(ry, rx);
    else if (Math.hypot(lx, ly) > AIM_DEAD) this.padAim = Math.atan2(ly, lx);
    if (b || this.padAim !== null) this.device = 'pad';
    return b;
  }

  /** Boutons pour le tick courant (maintenus + tapés depuis le dernier tick). */
  sample(): number {
    let b = this.tapped;
    for (const code of this.held) {
      const name = this.keys.get(code);
      if (name) b |= Btn[name];
    }
    for (const m of this.mouseHeld) {
      const name = this.mouseKeys.get(m);
      if (name) b |= Btn[name];
    }
    this.tapped = 0;
    return b | this.samplePad();
  }

  dispose(): void {
    this.unsubscribe();
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.clear);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
