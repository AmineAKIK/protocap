import { describe, expect, it } from 'vitest';
import {
  computeCelineViewportGeometry,
  computeCelineViewportHeight,
} from './useShiftGuideShell';

describe('computeCelineViewportHeight', () => {
  it('reserves the mobile navigation height when the keyboard is closed', () => {
    expect(computeCelineViewportHeight(800, 800)).toBe(720);
  });

  it('reclaims the navigation reserve when the virtual keyboard is open', () => {
    expect(computeCelineViewportHeight(800, 600)).toBe(600);
  });

  it('enforces a usable minimum height on very small viewports', () => {
    expect(computeCelineViewportHeight(500, 200)).toBe(240);
  });
});

describe('computeCelineViewportGeometry', () => {
  it('tracks the visual viewport origin when mobile Chrome pans for the keyboard', () => {
    expect(computeCelineViewportGeometry(844, 520, 168)).toEqual({
      height: 520,
      offsetTop: 168,
    });
  });

  it('never propagates a negative viewport origin into layout geometry', () => {
    expect(computeCelineViewportGeometry(844, 520, -12)).toEqual({
      height: 520,
      offsetTop: 0,
    });
  });
});
