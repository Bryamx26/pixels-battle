/**
 * Tests headless de la simulation partagée : `npm test`.
 * Chaque scénario pilote un World avec des entrées scriptées.
 */
import { World } from '../src/shared/engine/world';
import { Btn, encodeAim } from '../src/shared/input';
import { FIRST_SPAWN_TICKS } from '../src/shared/items/itemSystem';
import { COUNTDOWN_TICKS } from '../src/shared/constants';
import type { GameEvent } from '../src/shared/engine/events';

let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  console.log(`${cond ? '✔' : '✘'} ${name}${detail ? `  (${detail})` : ''}`);
  if (!cond) failed++;
}

function makeWorld(arena = 'sky-temple') {
  const w = new World(arena, '1v1', [
    { id: 'a', name: 'A', charId: 'kaze', slot: 0, team: 0 },
    { id: 'b', name: 'B', charId: 'kaze', slot: 1, team: 1 },
  ]);
  for (let i = 0; i < COUNTDOWN_TICKS + 30; i++) w.step({});
  return w;
}

function run(w: World, ticks: number, inputs: (t: number) => Record<string, number> = () => ({})) {
  const events: GameEvent[] = [];
  for (let t = 0; t < ticks; t++) {
    w.step(inputs(t));
    events.push(...w.drainEvents());
  }
  return events;
}
/** Appui d'un tick suivi d'un relâchement. */
const tap = (t: number, at: number, b: number) => (t === at ? b : 0);

// 1. Au sol après le compte à rebours.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  check('repos sur la plateforme principale', a.grounded && a.y === 186, `y=${a.y}`);
}

// 2. Saut + double saut.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  let minY = a.y;
  run(w, 60, (t) => ({ a: tap(t, 0, Btn.Up) | tap(t, 20, Btn.Up) }));
  // re-run tracking min
  const w2 = makeWorld();
  const a2 = w2.fighter('a')!;
  for (let t = 0; t < 60; t++) {
    w2.step({ a: tap(t, 0, Btn.Up) | tap(t, 20, Btn.Up) });
    minY = Math.min(minY, a2.y);
  }
  check('double saut', 186 - minY > 90, `hauteur=${(186 - minY).toFixed(0)}`);
  run(w2, 90);
  check('réatterrit', a2.grounded);
  void a;
}

// 3. Déplacement + attaque légère qui touche.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  const b = w.fighter('b')!;
  b.x = a.x + 16;
  const ev = run(w, 30, (t) => ({ a: tap(t, 0, Btn.Light) }));
  check('attaque légère touche', ev.some((e) => e.type === 'hit') && b.damage === 4, `dmg=${b.damage}`);
}

// 4. Combo léger → léger → moyen.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  const b = w.fighter('b')!;
  b.x = a.x + 14;
  const seq: Record<number, number> = { 0: Btn.Light, 7: Btn.Light, 14: Btn.Medium };
  const ev = run(w, 60, (t) => ({ a: seq[t] ?? 0 }));
  const hits = ev.filter((e) => e.type === 'hit') as Extract<GameEvent, { type: 'hit' }>[];
  check('combo L→L→M', hits.length === 3 && hits[2].combo === 3, `hits=${hits.length} combo=${hits.at(-1)?.combo}`);
}

// 5. Attaque moyenne à très haut pourcentage → KO ; à 0% non.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  const b = w.fighter('b')!;
  b.damage = 200;
  b.x = a.x + 18;
  const ev = run(w, 200, (t) => ({ a: tap(t, 0, Btn.Medium) }));
  check('moyenne à 200% éjecte hors de l’arène', ev.some((e) => e.type === 'ko' && e.target === 'b') && b.stocks === 2, `stocks=${b.stocks}`);
  const w2 = makeWorld();
  const a2 = w2.fighter('a')!;
  const b2 = w2.fighter('b')!;
  b2.x = a2.x + 18;
  const ev2 = run(w2, 200, (t) => ({ a: tap(t, 0, Btn.Medium) }));
  check('moyenne à 0% ne tue pas', !ev2.some((e) => e.type === 'ko'));
}

// 6. Garde : blocage, puis garde parfaite.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  const b = w.fighter('b')!;
  b.x = a.x + 16;
  const ev = run(w, 40, (t) => ({ a: tap(t, 12, Btn.Medium), b: Btn.Guard }));
  check('garde bloque', ev.some((e) => e.type === 'block') && b.damage === 0 && b.guard < 100, `guard=${b.guard.toFixed(0)}`);
  const w2 = makeWorld();
  const a2 = w2.fighter('a')!;
  const b2 = w2.fighter('b')!;
  b2.x = a2.x + 16;
  // Moyenne : startup 8 → active au tick ~9, garde levée au tick 6.
  const ev2 = run(w2, 40, (t) => ({ a: tap(t, 0, Btn.Medium), b: t >= 6 ? Btn.Guard : 0 }));
  check('garde parfaite → parade', ev2.some((e) => e.type === 'parry'));
}

// 7. Grappin sur un ennemi : accroche + traction.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  const b = w.fighter('b')!;
  b.x = a.x + 110;
  const d0 = b.x - a.x;
  const ev = run(w, 30, (t) => ({ a: tap(t, 0, Btn.Grapple) }));
  check('kunai accroche l’ennemi', ev.some((e) => e.type === 'hook'));
  check('ennemi tiré vers le lanceur', Math.abs(b.x - a.x) < 30, `distance ${d0}→${Math.abs(b.x - a.x).toFixed(0)}`);
  check('dégâts d’accroche', b.damage === 3);
  const w2 = makeWorld();
  const a2 = w2.fighter('a')!;
  const b2 = w2.fighter('b')!;
  b2.x = a2.x + 200;
  const ev2 = run(w2, 40, (t) => ({ a: tap(t, 0, Btn.Grapple) }));
  check('portée limitée (200px → raté)', !ev2.some((e) => e.type === 'hook'));
}

// 8. Récupération : tombé à gauche de l’arène, grappin vers la plateforme.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  a.x = 80;
  a.y = 230;
  a.vy = 100;
  a.grounded = false;
  a.airJumpsLeft = 0;
  run(w, 100, (t) => ({ a: (t === 0 ? Btn.Grapple : 0) | Btn.Right | (t < 3 ? Btn.Up : 0) }));
  check('grappin vers plateforme = récupération', a.stocks === 3 && a.action !== 'dead' && a.y <= 186 + 0.1, `pos=${a.x.toFixed(0)},${a.y.toFixed(0)}`);
  check('temps de récupération du grappin', a.grappleCooldown >= 0);
}

// 9. Ancre : grappin diagonal vers l'anneau gauche.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  a.x = -23;
  a.y = 234;
  a.grounded = false;
  a.airJumpsLeft = 0;
  let zipped = false;
  for (let t = 0; t < 30; t++) {
    w.step({ a: t === 0 ? Btn.Grapple | Btn.Up | Btn.Right : 0 });
    if (a.action === 'zip') zipped = true;
  }
  check('accroche à un anneau', zipped);
}

// 10. Traverser une plateforme fine.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  a.x = 175;
  a.y = 140;
  run(w, 10);
  check('debout sur plateforme fine', a.grounded && a.onSoft);
  run(w, 30, (t) => ({ a: tap(t, 0, Btn.Down) }));
  check('descend au travers (S)', a.y === 186, `y=${a.y}`);
}

// 11. Fin de partie.
{
  const w = makeWorld();
  const b = w.fighter('b')!;
  b.stocks = 1;
  b.x = -200;
  run(w, 2);
  check('victoire quand il ne reste qu’une équipe', w.state.status === 'ended' && w.state.winnerTeam === 0);
}

// 12. Grappin visé à la souris : direction exacte, pas seulement 8 directions.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  w.step({ a: Btn.Grapple | encodeAim(-0.3) });
  const g = a.grapple!;
  check('grappin suit la visée souris', !!g && Math.abs(Math.atan2(g.vy, g.vx) - -0.3) < 0.03, g ? `angle=${Math.atan2(g.vy, g.vx).toFixed(2)}` : 'pas de kunai');
}

// 13. Espace pendant la traction : on lâche en gardant l'inertie.
{
  const w = makeWorld();
  const a = w.fighter('a')!;
  a.x = 80;
  a.y = 230;
  a.grounded = false;
  a.airJumpsLeft = 0;
  let t = 0;
  w.step({ a: Btn.Grapple | encodeAim(-Math.PI / 4) });
  while (a.action !== 'zip' && t++ < 20) w.step({});
  w.step({});
  w.step({});
  const v = { x: a.vx, y: a.vy };
  w.step({ a: Btn.Up });
  check('Espace lâche le grappin', a.action === 'free' && a.grapple?.phase !== 'attached');
  check('inertie conservée', Math.abs(a.vx - v.x) < 30 && Math.abs(a.vy - v.y) < 40 && a.airJumpsLeft === 0, `v=(${v.x.toFixed(0)},${v.y.toFixed(0)}) → (${a.vx.toFixed(0)},${a.vy.toFixed(0)})`);
}

// 14. Objets : apparition, ramassage (1 max), lancer sur l'adversaire.
{
  const w = makeWorld();
  const s = w.state;
  const a = w.fighter('a')!;
  const b = w.fighter('b')!;
  const ev = run(w, FIRST_SPAWN_TICKS);
  check('un shuriken apparaît', s.items.length === 1 && ev.some((e) => e.type === 'itemSpawn'));
  const item = s.items[0];
  run(w, 90); // il tombe sur une plateforme
  check('il retombe sur une plateforme', item.vy === 0 && w.arena.platforms.some((p) => p.y === item.y));
  a.x = item.x;
  a.y = item.y;
  run(w, 3);
  check('ramassé au contact', a.heldItem === 'shuriken' && s.items.length === 0);
  s.items.push({ ...item, uid: 99, phase: 'ground', x: a.x, y: a.y });
  run(w, 3);
  check('un seul objet à la fois', a.heldItem === 'shuriken' && s.items.length === 1);
  s.items = [];
  a.x = 170; a.y = 186; b.x = 300; b.y = 186; b.damage = 0;
  run(w, 5);
  const ev2 = run(w, 40, (t) => ({ a: t === 0 ? Btn.Throw | encodeAim(Math.atan2(-12 + 12, 130)) : 0 }));
  check('shuriken lancé touche l’adversaire', ev2.some((e) => e.type === 'hit' && e.slot === 'item') && b.damage === 8, `dmg=${b.damage}`);
  check('le shuriken retombe pour être repris', a.heldItem === null && s.items.length === 1 && s.items[0].phase === 'ground');
}

console.log(failed ? `\n${failed} échec(s)` : '\nTous les tests passent.');
process.exit(failed ? 1 : 0);
