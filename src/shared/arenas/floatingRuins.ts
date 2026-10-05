import type { ArenaDef } from './types';

export const floatingRuins: ArenaDef = {
  id: 'floating-ruins',
  name: 'Ruines Flottantes',
  blast: { left: -70, right: 550, top: -90, bottom: 320 },
  platforms: [
    { x: 150, y: 200, w: 180, h: 24, kind: 'solid', grapple: true },
    { x: 90, y: 160, w: 60, h: 5, kind: 'soft', grapple: true },
    { x: 330, y: 160, w: 60, h: 5, kind: 'soft', grapple: true },
    { x: 190, y: 125, w: 100, h: 5, kind: 'soft', grapple: true },
    { x: 120, y: 85, w: 50, h: 5, kind: 'soft', grapple: true },
    { x: 310, y: 85, w: 50, h: 5, kind: 'soft', grapple: true },
  ],
  anchors: [
    { x: 40, y: 110, r: 6 },
    { x: 440, y: 110, r: 6 },
    { x: 240, y: 45, r: 6 },
  ],
  spawns: [
    { x: 195, y: 200 },
    { x: 285, y: 200 },
    { x: 120, y: 160 },
    { x: 360, y: 160 },
  ],
  itemSpawns: [
    { x: 240, y: 90 },
    { x: 145, y: 50 },
    { x: 335, y: 50 },
    { x: 120, y: 125 },
    { x: 360, y: 125 },
    { x: 240, y: 170 },
  ],
  theme: {
    skyTop: '#0d2b45',
    skyBottom: '#5fb3b3',
    far: '#2c6e6a',
    near: '#1d4d4f',
    top: '#a7f070',
    body: '#9e9a85',
    dark: '#5e5a4c',
    soft: '#c9b48a',
    accent: '#7cf5ff',
  },
};
