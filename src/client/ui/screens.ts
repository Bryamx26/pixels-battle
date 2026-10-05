import { ARENAS } from '../../shared/arenas';
import { CHARACTERS } from '../../shared/characters';
import { MODES, type GameMode } from '../../shared/engine/rules';
import type { RoomInfo } from '../../shared/net/protocol';
import type { Fighter } from '../../shared/characters/fighter';
import { SLOT_COLORS, TEAM_COLORS } from '../render/palette';
import { escapeHtml } from './hud';

const root = () => document.getElementById('screens')!;

function mount(html: string, cls = ''): HTMLElement {
  const el = document.createElement('div');
  el.className = `screen ${cls}`;
  el.innerHTML = html;
  root().replaceChildren(el);
  return el;
}

export function hideScreens(): void {
  root().replaceChildren();
}

const options = (items: Record<string, { name?: string; label?: string }>, selected: string) =>
  Object.entries(items)
    .map(([id, v]) => `<option value="${id}" ${id === selected ? 'selected' : ''}>${escapeHtml(v.name ?? v.label ?? id)}</option>`)
    .join('');

const CONTROLS_HTML = `
<details>
  <summary>Contrôles</summary>
  <div class="controls">
    <kbd>A / D</kbd><span>Déplacement (Q / D en AZERTY)</span>
    <kbd>Espace</kbd><span>Saut / double saut · pendant le grappin : lâcher en gardant l'élan</span>
    <kbd>S</kbd><span>Chute rapide · traverser une plateforme fine</span>
    <kbd>Clic gauche</kbd><span>Attaque rapide (enchaîne jusqu'à 3)</span>
    <kbd>K</kbd><span>Coup de pied (attaque moyenne)</span>
    <kbd>Clic droit</kbd><span>Kunai-grappin vers le curseur</span>
    <kbd>F / molette</kbd><span>Lancer l'objet tenu vers le curseur</span>
    <kbd>Shift</kbd><span>Garde (au bon moment = parade)</span>
    <kbd>E</kbd><span>Dash / esquive</span>
    <kbd>Échap</kbd><span>Menu pause</span>
  </div>
  <p class="hint">Les shurikens apparaissent dans l'arène : passe dessus pour en ramasser un (un seul à la fois), lance-le sur l'adversaire puis va le récupérer là où il tombe.</p>
</details>`;

export interface MenuActions {
  create(name: string, mode: GameMode, arenaId: string): void;
  join(name: string, code: string): void;
  training(name: string, arenaId: string, charId: string, level: 'dummy' | 'easy'): void;
}

export function showMenu(a: MenuActions, defaults: { name: string; code?: string }): void {
  const el = mount(`
    <h1 class="title">PIXELS BATTLE</h1>
    <p class="subtitle">Platform fighter · kunai-grappin · multijoueur</p>
    <label class="field">Ton pseudo<input id="name" maxlength="12" value="${escapeHtml(defaults.name)}" /></label>
    <h2 style="margin-top:18px">Partie privée</h2>
    <div class="row">
      <select id="mode">${options(MODES, '1v1')}</select>
      <select id="arena">${options(ARENAS, 'sky-temple')}</select>
    </div>
    <div class="row"><button id="create">Créer une partie</button></div>
    <div class="row">
      <input id="code" class="code" maxlength="5" placeholder="CODE" value="${escapeHtml(defaults.code ?? '')}" />
      <button id="join" class="secondary">Rejoindre</button>
    </div>
    <h2 style="margin-top:18px">Entraînement solo</h2>
    <div class="row">
      <select id="tchar">${options(CHARACTERS, 'kaze')}</select>
      <select id="tlevel"><option value="easy">CPU facile</option><option value="dummy">Mannequin immobile</option></select>
    </div>
    <div class="row"><button id="train" class="secondary">S'entraîner</button></div>
    ${CONTROLS_HTML}
  `);
  const $ = <T extends HTMLElement>(id: string) => el.querySelector<T>('#' + id)!;
  const name = () => $<HTMLInputElement>('name').value.trim() || 'Ninja';
  $('create').onclick = () => a.create(name(), $<HTMLSelectElement>('mode').value as GameMode, $<HTMLSelectElement>('arena').value);
  const join = () => {
    const code = $<HTMLInputElement>('code').value.trim().toUpperCase();
    if (code) a.join(name(), code);
  };
  $('join').onclick = join;
  $('code').onkeydown = (e) => {
    if ((e as KeyboardEvent).key === 'Enter') join();
  };
  $('train').onclick = () =>
    a.training(name(), $<HTMLSelectElement>('arena').value, $<HTMLSelectElement>('tchar').value, $<HTMLSelectElement>('tlevel').value as 'dummy' | 'easy');
}

export interface LobbyActions {
  start(): void;
  leave(): void;
  config(mode?: GameMode, arenaId?: string): void;
  character(charId: string): void;
}

export function showLobby(room: RoomInfo, me: string, a: LobbyActions): void {
  const host = room.players.find((p) => p.host)?.id === me;
  const mode = MODES[room.mode];
  const link = `${location.origin}${location.pathname}?code=${room.code}`;
  const slots = Array.from({ length: mode.maxPlayers }, (_, i) => room.players.find((p) => p.slot === i));
  const color = (slot: number) => (room.mode === '2v2' ? TEAM_COLORS[slot % 2] : SLOT_COLORS[slot]);
  const canStart = room.players.length >= mode.minPlayers && room.players.length <= mode.maxPlayers;

  const el = mount(`
    <h2>Salle privée — ${escapeHtml(mode.label)}</h2>
    <div class="code-box" id="codebox">${room.code}</div>
    <p class="hint">Partage ce code (ou le lien) à ton adversaire.</p>
    <div class="row"><button id="copy" class="secondary">Copier le lien</button></div>
    <div class="players">
      ${slots
        .map((p, i) =>
          p
            ? `<div class="player" style="--c:${color(i)}">
                <span class="swatch"></span>
                <span>P${i + 1} ${escapeHtml(p.name)} ${p.id === me ? '<span class="tag">(toi)</span>' : ''} ${p.host ? '<span class="tag">★ hôte</span>' : ''} ${p.connected ? '' : '<span class="tag">· reconnexion…</span>'}${room.mode === '2v2' ? ` <span class="tag">équipe ${p.team + 1}</span>` : ''}</span>
                ${p.id === me ? `<select data-char>${options(CHARACTERS, p.charId)}</select>` : `<span class="tag">${CHARACTERS[p.charId]?.name ?? ''}</span>`}
              </div>`
            : `<div class="player empty"><span class="swatch"></span><span>P${i + 1} — en attente…</span><span></span></div>`,
        )
        .join('')}
    </div>
    ${
      host
        ? `<div class="row"><select id="mode">${options(MODES, room.mode)}</select><select id="arena">${options(ARENAS, room.arenaId)}</select></div>`
        : `<p class="hint">Arène : ${escapeHtml(ARENAS[room.arenaId]?.name ?? '')} · l'hôte lance le combat.</p>`
    }
    <div class="row">
      ${host ? `<button id="start" ${canStart ? '' : 'disabled'}>Lancer le combat</button>` : ''}
      <button id="leave" class="danger">Quitter</button>
    </div>
    ${host && !canStart ? `<p class="hint">Il faut ${mode.minPlayers} joueur(s) minimum.</p>` : ''}
    ${CONTROLS_HTML}
  `);
  const $ = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel);
  $('#copy')!.onclick = async () => {
    try {
      await navigator.clipboard.writeText(link);
      $('#copy')!.textContent = 'Lien copié !';
    } catch {
      $('#copy')!.textContent = link;
    }
  };
  $('#leave')!.onclick = a.leave;
  const start = $('#start');
  if (start) start.onclick = a.start;
  const charSel = $<HTMLSelectElement>('[data-char]');
  if (charSel) charSel.onchange = () => a.character(charSel.value);
  const modeSel = $<HTMLSelectElement>('#mode');
  if (modeSel) modeSel.onchange = () => a.config(modeSel.value as GameMode);
  const arenaSel = $<HTMLSelectElement>('#arena');
  if (arenaSel) arenaSel.onchange = () => a.config(undefined, arenaSel.value);
}

export function showResults(
  fighters: Fighter[],
  winnerTeam: number | null,
  localId: string,
  label: string,
  onContinue: () => void,
): void {
  const me = fighters.find((f) => f.id === localId);
  const outcome = winnerTeam === null ? 'draw' : me && me.team === winnerTeam ? 'win' : 'lose';
  const title = outcome === 'win' ? 'VICTOIRE !' : outcome === 'lose' ? 'DÉFAITE' : 'ÉGALITÉ';
  const rows = [...fighters]
    .sort((a, b) => Number(b.team === winnerTeam) - Number(a.team === winnerTeam) || b.kos - a.kos)
    .map(
      (f) => `<tr><td style="color:${SLOT_COLORS[f.slot]}">P${f.slot + 1} ${escapeHtml(f.name)}${f.id === localId ? ' (toi)' : ''}</td>
        <td>${f.kos}</td><td>${f.falls}</td><td>${Math.max(0, f.stocks)}</td></tr>`,
    )
    .join('');
  const el = mount(
    `<div class="result-title ${outcome === 'win' ? 'win' : 'lose'}">${title}</div>
     <table class="stats"><tr><th>Joueur</th><th>KO</th><th>Chutes</th><th>Vies</th></tr>${rows}</table>
     <div class="row"><button id="cont">${escapeHtml(label)}</button></div>`,
    'overlay',
  );
  el.querySelector<HTMLButtonElement>('#cont')!.onclick = onContinue;
}

export function showPause(onResume: () => void, onQuit: () => void): void {
  const el = mount(
    `<h2>Pause</h2>
     <p class="hint">En ligne, le combat continue pendant la pause.</p>
     <div class="row"><button id="resume">Reprendre</button><button id="quit" class="danger">Quitter le combat</button></div>
     ${CONTROLS_HTML}`,
    'overlay',
  );
  el.querySelector<HTMLButtonElement>('#resume')!.onclick = onResume;
  el.querySelector<HTMLButtonElement>('#quit')!.onclick = onQuit;
}

let toastTimer = 0;
export function toast(text: string, kind: 'error' | 'info' = 'error', ms = 3000): void {
  const t = document.getElementById('toast')!;
  t.textContent = text;
  t.className = `show ${kind}`;
  clearTimeout(toastTimer);
  if (ms > 0) toastTimer = window.setTimeout(() => (t.className = ''), ms);
}
export function hideToast(): void {
  document.getElementById('toast')!.className = '';
}
