import { describe, expect, it } from 'vitest';
import { computeCelineViewportHeight } from './useShiftGuideShell';

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
