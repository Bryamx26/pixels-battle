import { approach } from '../math';
import { DT, RESPAWN_INVULN_TICKS } from '../constants';
import { Btn, has, inputDir } from '../input';
import type { ArenaDef } from '../arenas/types';
import { applyGravity, integrate } from '../physics/body';
import { feedBuffer, consume, buffered } from '../engine/buffer';
import { tryStartAttack, updateAttack } from '../combat/attack';
import { GUARD_MIN_TO_RAISE, regenGuard, startGuard, updateGuard } from '../combat/guard';
import { canThrow, endZip, throwGrapple, updateGrappleProjectile, updateZip } from '../grapple/grapple';
import { GUARD_MAX, type Fighter } from './fighter';
import type { CharacterDef } from './types';
import { getCharacter } from './index';

const DROP_THROUGH_TICKS = 12;
const DASH_INVULN_TICKS = 6;
const DASH_COOLDOWN = 22;
const HITSTUN_AIR_DRAG = 0.985;

/**
 * Avance un combattant d'un tick à partir de ses entrées.
 *
 * Cette fonction ne dépend que du combattant et de l'arène : c'est elle que le
 * client rejoue pour prédire son propre mouvement. Tout ce qui implique deux
 * combattants (coups, kunai sur un ennemi, KO) est résolu par World.
 */
export function stepFighter(f: Fighter, buttons: number, arena: ArenaDef): void {
  const ch = getCharacter(f.charId);
  const pressed = buttons & ~f.prevButtons;
  f.prevButtons = buttons;
  if (f.eliminated) return;

  if (f.action === 'dead') {
    if (--f.respawnTimer <= 0 && f.stocks > 0) respawn(f, arena);
    return;
  }

  feedBuffer(f, pressed);
  if (f.invuln > 0) f.invuln--;
  if (f.dashCooldown > 0) f.dashCooldown--;
  if (f.grappleCooldown > 0) f.grappleCooldown--;
  if (f.dropTimer > 0) f.dropTimer--;
  regenGuard(f);

  const { dx } = inputDir(buttons);
  let gravity = 1;

  switch (f.action) {
    case 'free':
      updateFree(f, ch, buttons, pressed, dx);
      break;
    case 'attack':
      updateAttack(f, ch, buttons, dx);
      break;
    case 'dash':
      gravity = updateDash(f, ch);
      break;
    case 'guard':
      updateGuard(f, ch, buttons);
      if (f.action === 'guard' && consume(f, Btn.Up)) jump(f, ch);
      else if (f.action === 'guard' && consume(f, Btn.Dash)) startDash(f, ch, dx);
      break;
    case 'hitstun':
    case 'guardbreak':
      if (--f.stun <= 0) f.action = 'free';
      if (f.grounded) f.vx = approach(f.vx, 0, ch.groundFriction * 0.5 * DT);
      else f.vx *= HITSTUN_AIR_DRAG;
      break;
    case 'hooked':
      gravity = 0; // vitesse imposée par la chaîne (hook.ts)
      break;
    case 'zip':
      updateZip(f, ch);
      if (f.action === 'zip') gravity = 0;
      break;
  }

  if (gravity > 0 && !f.grounded) applyGravity(f, ch, gravity);
  else if (gravity > 0 && f.grounded) f.vy = Math.max(f.vy, 1); // colle au sol

  const ox = f.x;
  const oy = f.y;
  integrate(f, ch, arena);

  if (f.grounded) {
    f.airJumpsLeft = ch.airJumps;
    f.airDashUsed = false;
    f.fastFalling = false;
  }
  // Zip bloqué contre un mur/plafond → on le termine.
  if (f.action === 'zip' && f.actionTicks > 4 && Math.hypot(f.x - ox, f.y - oy) < 0.5) endZip(f);

  updateGrappleProjectile(f, ch, arena);
  f.actionTicks++;
}

function updateFree(f: Fighter, ch: CharacterDef, buttons: number, pressed: number, dx: number): void {
  if (dx) f.facing = dx > 0 ? 1 : -1;

  if (f.grounded) {
    f.vx = approach(f.vx, dx * ch.runSpeed, (dx ? ch.groundAccel : ch.groundFriction) * DT);
  } else if (dx) {
    // Contrôle aérien, sans casser un élan supérieur à la vitesse max (après zip/dash).
    if (Math.sign(f.vx) === dx && Math.abs(f.vx) > ch.airSpeed) f.vx = approach(f.vx, dx * ch.airSpeed, ch.airAccel * 0.25 * DT);
    else f.vx = approach(f.vx, dx * ch.airSpeed, ch.airAccel * DT);
  } else {
    f.vx = approach(f.vx, 0, ch.airAccel * 0.3 * DT);
  }

  // Traverser une plateforme fine par le bas.
  if (has(pressed, Btn.Down) && f.grounded && f.onSoft) {
    f.dropTimer = DROP_THROUGH_TICKS;
    f.grounded = false;
    f.y += 1;
    f.vy = 60;
  } else if (has(pressed, Btn.Down) && !f.grounded && f.vy > -80) {
    f.fastFalling = true;
  }

  if (buffered(f, Btn.Up) && (f.grounded || f.airJumpsLeft > 0)) {
    consume(f, Btn.Up);
    jump(f, ch);
  }

  if (canThrow(f) && consume(f, Btn.Grapple)) {
    throwGrapple(f, ch, buttons);
    return;
  }
  if (tryStartAttack(f)) return;
  if (f.dashCooldown === 0 && (f.grounded || !f.airDashUsed) && consume(f, Btn.Dash)) {
    startDash(f, ch, dx);
    return;
  }
  if (f.grounded && has(buttons, Btn.Guard) && f.guard >= GUARD_MIN_TO_RAISE) {
    startGuard(f, has(pressed, Btn.Guard));
  }
}

function jump(f: Fighter, ch: CharacterDef): void {
  if (f.grounded) {
    f.vy = -ch.jumpVel;
  } else {
    f.airJumpsLeft--;
    f.vy = -ch.doubleJumpVel;
  }
  f.grounded = false;
  f.fastFalling = false;
  f.action = 'free';
}

function startDash(f: Fighter, ch: CharacterDef, dx: number): void {
  const dir = dx || f.facing;
  f.facing = dir > 0 ? 1 : -1;
  f.action = 'dash';
  f.actionTicks = 0;
  f.vx = dir * ch.dashSpeed;
  if (!f.grounded) {
    f.vy = 0;
    f.airDashUsed = true;
  }
  f.invuln = Math.max(f.invuln, DASH_INVULN_TICKS);
  f.dashCooldown = ch.dashTicks + DASH_COOLDOWN;
  f.fastFalling = false;
}

/** Retourne le facteur de gravité à appliquer. */
function updateDash(f: Fighter, ch: CharacterDef): number {
  f.vx = f.facing * ch.dashSpeed;
  if (buffered(f, Btn.Up) && (f.grounded || f.airJumpsLeft > 0)) {
    consume(f, Btn.Up);
    f.vx = f.facing * Math.max(ch.runSpeed, ch.airSpeed) * 1.2;
    jump(f, ch);
    return 1;
  }
  if (f.actionTicks >= ch.dashTicks) {
    f.action = 'free';
    f.vx = f.facing * ch.runSpeed;
  }
  if (!f.grounded) {
    f.vy = 0;
    return 0;
  }
  return 1;
}

export function respawn(f: Fighter, arena: ArenaDef): void {
  const s = arena.spawns[f.slot % arena.spawns.length];
  const ch = getCharacter(f.charId);
  f.x = s.x;
  f.y = s.y - 30;
  f.vx = 0;
  f.vy = 0;
  f.damage = 0;
  f.combo = 0;
  f.action = 'free';
  f.actionTicks = 0;
  f.attack = null;
  f.invuln = RESPAWN_INVULN_TICKS;
  f.airJumpsLeft = ch.airJumps;
  f.airDashUsed = false;
  f.guard = GUARD_MAX;
  f.grapple = null;
  f.grappleCooldown = 0;
  f.lastHitBy = null;
  f.hookedBy = null;
  f.stun = 0;
}
