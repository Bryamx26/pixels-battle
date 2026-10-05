import type { ButtonName } from '../../shared/input';

/**
 * Réglage des commandes : chaque action logique est liée à une liste d'entrées.
 * Une entrée s'écrit `Key:<KeyboardEvent.code>`, `Mouse:<bouton>` ou `Pad:<bouton manette>`
 * (disposition « standard » de la Gamepad API). Sauvegardé dans le navigateur.
 */
export type InputCode = string;
export type Bindings = Record<ButtonName, InputCode[]>;

export const ACTIONS: { id: ButtonName; label: string }[] = [
  { id: 'Left', label: 'Gauche' },
  { id: 'Right', label: 'Droite' },
  { id: 'Up', label: 'Saut / lâcher le grappin' },
  { id: 'Down', label: 'Chute rapide / traverser' },
  { id: 'Light', label: 'Attaque rapide' },
  { id: 'Medium', label: 'Coup de pied' },
  { id: 'Grapple', label: 'Grappin' },
  { id: 'Throw', label: "Lancer l'objet" },
  { id: 'Guard', label: 'Garde / parade' },
  { id: 'Dash', label: 'Dash / esquive' },
];

export const DEFAULT_BINDINGS: Bindings = {
  Left: ['Key:KeyA', 'Key:ArrowLeft', 'Pad:14'],
  Right: ['Key:KeyD', 'Key:ArrowRight', 'Pad:15'],
  Up: ['Key:Space', 'Key:KeyW', 'Key:ArrowUp', 'Pad:0', 'Pad:12'],
  Down: ['Key:KeyS', 'Key:ArrowDown', 'Pad:13'],
  Light: ['Mouse:0', 'Key:KeyJ', 'Pad:2'],
  Medium: ['Key:KeyK', 'Pad:1'],
  Grapple: ['Mouse:2', 'Pad:7'],
  Throw: ['Key:KeyF', 'Mouse:1', 'Pad:3'],
  Guard: ['Key:ShiftLeft', 'Key:ShiftRight', 'Pad:6'],
  Dash: ['Key:KeyE', 'Pad:5', 'Pad:4'],
};

/** Touches réservées (non assignables). */
export const RESERVED = new Set(['Key:Escape']);

const STORAGE_KEY = 'pb.controls';
const listeners = new Set<(b: Bindings) => void>();

function clone(b: Bindings): Bindings {
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, [...v]])) as Bindings;
}

function load(): Bindings {
  const b = clone(DEFAULT_BINDINGS);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return b;
    const saved = JSON.parse(raw) as Partial<Record<string, unknown>>;
    for (const { id } of ACTIONS) {
      const v = saved[id];
      if (Array.isArray(v)) b[id] = v.filter((x): x is string => typeof x === 'string' && /^(Key|Mouse|Pad):/.test(x));
    }
  } catch {
    /* stockage indisponible : réglages par défaut */
  }
  return b;
}

let current = load();

export function getBindings(): Bindings {
  return current;
}

function commit(b: Bindings): void {
  current = b;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
  } catch {
    /* navigation privée : réglage gardé pour la session seulement */
  }
  for (const l of listeners) l(current);
}

/** Lie une entrée à une action (elle est retirée de l'action qui l'utilisait). */
export function bind(action: ButtonName, code: InputCode): void {
  if (RESERVED.has(code)) return;
  const b = clone(current);
  for (const { id } of ACTIONS) b[id] = b[id].filter((c) => c !== code);
  b[action].push(code);
  commit(b);
}

export function unbind(action: ButtonName, code: InputCode): void {
  const b = clone(current);
  b[action] = b[action].filter((c) => c !== code);
  commit(b);
}

export function resetBindings(): void {
  commit(clone(DEFAULT_BINDINGS));
}

export function onBindingsChange(fn: (b: Bindings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ------------------------------------------------------------ libellés

/** Disposition réelle du clavier (Chrome/Edge) : « Q » au lieu de « A » en AZERTY. */
let layout: Map<string, string> | null = null;
const nav = navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<Map<string, string>> } };
nav.keyboard
  ?.getLayoutMap?.()
  .then((m) => {
    layout = m;
    for (const l of listeners) l(current);
  })
  .catch(() => {});

const KEY_NAMES: Record<string, string> = {
  Space: 'Espace',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ShiftLeft: 'Maj gauche',
  ShiftRight: 'Maj droite',
  ControlLeft: 'Ctrl gauche',
  ControlRight: 'Ctrl droite',
  AltLeft: 'Alt',
  AltRight: 'Alt Gr',
  Enter: 'Entrée',
  Tab: 'Tab',
  Backspace: 'Retour',
  CapsLock: 'Verr. maj',
};
const MOUSE_NAMES = ['Clic gauche', 'Clic molette', 'Clic droit', 'Souris 4', 'Souris 5'];
const PAD_NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Select', 'Start', 'L3', 'R3', 'Croix ↑', 'Croix ↓', 'Croix ←', 'Croix →', 'Home'];

export function inputLabel(code: InputCode): string {
  const [kind, v] = code.split(':');
  if (kind === 'Mouse') return MOUSE_NAMES[+v] ?? `Souris ${+v + 1}`;
  if (kind === 'Pad') return `🎮 ${PAD_NAMES[+v] ?? +v}`;
  const fromLayout = layout?.get(v);
  if (fromLayout && fromLayout.trim()) return fromLayout.toUpperCase();
  if (KEY_NAMES[v]) return KEY_NAMES[v];
  if (v.startsWith('Key')) return v.slice(3);
  if (v.startsWith('Digit')) return v.slice(5);
  if (v.startsWith('Numpad')) return `Pavé ${v.slice(6)}`;
  return v;
}
