import type { ArenaDef } from './types';

export const twinForge: ArenaDef = {
  id: 'twin-forge',
  name: 'Forge Jumelle',
  blast: { left: -70, right: 550, top: -90, bottom: 320 },
  platforms: [
    { x: 60, y: 180, w: 140, h: 40, kind: 'solid', grapple: true },
    { x: 280, y: 180, w: 140, h: 40, kind: 'solid', grapple: true },
    { x: 200, y: 130, w: 80, h: 5, kind: 'soft', grapple: true },
    { x: 95, y: 105, w: 60, h: 5, kind: 'soft', grapple: true },
    { x: 325, y: 105, w: 60, h: 5, kind: 'soft', grapple: true },
  ],
  anchors: [
    { x: 240, y: 62, r: 6 },
    { x: 240, y: 232, r: 6 },
  ],
  spawns: [
    { x: 130, y: 180 },
    { x: 350, y: 180 },
    { x: 125, y: 105 },
    { x: 355, y: 105 },
  ],
  theme: {
    skyTop: '#1a0f0f',
    skyBottom: '#7a2e1a',
    far: '#4a1c14',
    near: '#2e1210',
    top: '#ffb347',
    body: '#5b5f6b',
    dark: '#33353d',
    soft: '#b86f3c',
    accent: '#ff6b35',
  },
};
