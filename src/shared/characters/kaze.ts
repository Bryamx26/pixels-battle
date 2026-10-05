import type { CharacterDef } from './types';

/** Kaze : ninja équilibré et mobile. */
export const kaze: CharacterDef = {
  id: 'kaze',
  name: 'Kaze',
  width: 12,
  height: 22,
  runSpeed: 150,
  groundAccel: 1400,
  groundFriction: 1600,
  airSpeed: 140,
  airAccel: 900,
  jumpVel: 400,
  doubleJumpVel: 360,
  gravity: 1250,
  maxFall: 380,
  fastFall: 620,
  airJumps: 1,
  dashSpeed: 340,
  dashTicks: 10,
  kbTaken: 1,
  attacks: {
    light: {
      slot: 'light', startup: 4, active: 3, recovery: 8,
      hitbox: { x: 3, y: -17, w: 17, h: 10 },
      damage: 4, baseKb: 110, kbGrowth: 1.4, angle: 35, guardDamage: 12, lunge: 40,
      cancelInto: ['light', 'medium'], cancelIntoGrapple: true,
    },
    medium: {
      slot: 'medium', startup: 8, active: 4, recovery: 13,
      hitbox: { x: 2, y: -21, w: 25, h: 15 },
      damage: 8, baseKb: 190, kbGrowth: 2.6, angle: 40, guardDamage: 25, lunge: 110,
      cancelInto: ['light'], cancelIntoGrapple: true,
    },
  },
  grapple: { speed: 720, range: 165, zipSpeed: 470, pullSpeed: 520, hookDamage: 3, cooldown: 66 },
  look: { body: '#2d2a3e', trim: '#e8e8f0', skin: '#f2c49b', scarf: '#ff4d4d' },
};
