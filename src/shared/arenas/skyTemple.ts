import type { ArenaDef } from './types';

export const skyTemple: ArenaDef = {
  id: 'sky-temple',
  name: 'Temple Céleste',
  blast: { left: -70, right: 550, top: -90, bottom: 320 },
  platforms: [
    { x: 110, y: 186, w: 260, h: 30, kind: 'solid', grapple: true },
    { x: 140, y: 140, w: 70, h: 5, kind: 'soft', grapple: true },
    { x: 270, y: 140, w: 70, h: 5, kind: 'soft', grapple: true },
    { x: 205, y: 98, w: 70, h: 5, kind: 'soft', grapple: true },
  ],
  anchors: [
    { x: 52, y: 150, r: 6 },
    { x: 428, y: 150, r: 6 },
  ],
  spawns: [
    { x: 170, y: 186 },
    { x: 310, y: 186 },
    { x: 175, y: 140 },
    { x: 305, y: 140 },
  ],
  theme: {
    skyTop: '#2b1f5c',
    skyBottom: '#f08a5d',
    far: '#7a4b8c',
    near: '#4a2f6b',
    top: '#8ce06e',
    body: '#8a7f9e',
    dark: '#4f4662',
    soft: '#d9a066',
    accent: '#ffe66d',
  },
};
