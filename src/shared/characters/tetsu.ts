import type { CharacterDef } from './types';

/** Tetsu : ninja lourd, plus lent mais plus résistant et plus puissant. */
export const tetsu: CharacterDef = {
  id: 'tetsu',
  name: 'Tetsu',
  width: 14,
  height: 22,
  runSpeed: 132,
  groundAccel: 1200,
  groundFriction: 1700,
  airSpeed: 125,
  airAccel: 800,
  jumpVel: 380,
  doubleJumpVel: 340,
  gravity: 1350,
  maxFall: 410,
  fastFall: 660,
  airJumps: 1,
  dashSpeed: 310,
  dashTicks: 10,
  kbTaken: 0.88,
  attacks: {
    light: {
      slot: 'light', startup: 5, active: 3, recovery: 9,
      hitbox: { x: 3, y: -17, w: 18, h: 11 },
      damage: 5, baseKb: 120, kbGrowth: 1.5, angle: 30, guardDamage: 14, lunge: 30,
      cancelInto: ['light', 'medium', 'heavy'], cancelIntoGrapple: true,
    },
    medium: {
      slot: 'medium', startup: 9, active: 4, recovery: 14,
      hitbox: { x: 2, y: -21, w: 26, h: 16 },
      damage: 9, baseKb: 200, kbGrowth: 2.8, angle: 38, guardDamage: 28, lunge: 90,
      cancelInto: ['heavy'], cancelIntoGrapple: true,
    },
    heavy: {
      slot: 'heavy', startup: 22, active: 5, recovery: 26,
      hitbox: { x: 2, y: -27, w: 32, h: 26 },
      damage: 17, baseKb: 310, kbGrowth: 4.9, angle: 40, guardDamage: 60, lunge: 150,
      cancelInto: [], cancelIntoGrapple: false,
    },
  },
  grapple: { speed: 680, range: 150, zipSpeed: 440, pullSpeed: 500, hookDamage: 4, cooldown: 72 },
  look: { body: '#3a2f22', trim: '#c9a227', skin: '#d9a07a', scarf: '#3fa7ff' },
};
