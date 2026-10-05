import { DT } from '../../shared/constants';

/**
 * Boucle client : simulation/entrées à pas fixe (60 Hz, comme le serveur),
 * rendu à la fréquence de l'écran avec un facteur d'interpolation.
 */
export class GameLoop {
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;

  constructor(
    private onTick: () => void,
    private onRender: (alpha: number) => void,
  ) {}

  start(): void {
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const frame = (now: number) => {
      if (!this.running) return;
      this.acc += Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      while (this.acc >= DT) {
        this.onTick();
        this.acc -= DT;
      }
      this.onRender(this.acc / DT);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
