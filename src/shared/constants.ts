/** Paramètres globaux de la simulation, partagés client/serveur. */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Le serveur envoie un snapshot tous les N ticks (2 → 30 Hz). */
export const SNAPSHOT_EVERY = 2;

/** Résolution native du rendu pixel art. Le monde utilise la même unité (1 px). */
export const VIEW_W = 480;
export const VIEW_H = 270;

export const DEFAULT_STOCKS = 3;
export const COUNTDOWN_TICKS = 180;
export const RESPAWN_TICKS = 90;
export const RESPAWN_INVULN_TICKS = 120;

export const RECONNECT_GRACE_MS = 30_000;
