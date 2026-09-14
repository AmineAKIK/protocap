import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('public shell delegates persistent geometry and safe-area compensation to shared infrastructure', async () => {
  const shell = await read('src/components/AppShell.tsx');
  const css = await read('src/responsive-shell.css');
  const geometry = await read('src/layout/responsiveGeometry.ts');

  assert.match(shell, /app-shell-header-inner/);
  assert.match(shell, /app-shell-content/);
  assert.match(shell, /app-shell-mobile-nav/);
  assert.doesNotMatch(shell, /pb-\[calc\(8\.5rem/);
  assert.doesNotMatch(shell, /height:\s*'56px'/);
  assert.match(css, /\.app-shell-content/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(geometry, /APP_HEADER_HEIGHT_PX = 56/);
});

test('ShiftGuide shares one navigation geometry contract across CSS and keyboard-aware viewport code', async () => {
  const layout = await read('src/components/ShiftGuideLayout.tsx');
  const navigation = await read('src/components/shiftguide/ShiftGuideNavigation.tsx');
  const hook = await read('src/hooks/useShiftGuideShell.ts');
  const css = await read('src/responsive-shell.css');
  const geometry = await read('src/layout/responsiveGeometry.ts');

  assert.match(layout, /shiftguide-standard-content/);
  assert.match(layout, /shiftguide-celine-content/);
  assert.doesNotMatch(layout, /5rem/);
  assert.doesNotMatch(layout, /pl-24/);
  assert.match(navigation, /--shiftguide-desktop-nav-width/);
  assert.match(navigation, /shiftguide-mobile-nav/);
  assert.match(hook, /SHIFTGUIDE_MOBILE_NAV_RESERVE_PX/);
  assert.match(hook, /SHIFTGUIDE_MOBILE_MEDIA_QUERY/);
  assert.match(css, /var\(--shiftguide-mobile-nav-reserve\)/);
  assert.match(css, /var\(--shiftguide-desktop-nav-width\)/);
  assert.match(geometry, /SHIFTGUIDE_MOBILE_NAV_RESERVE_PX = 80/);
  assert.match(geometry, /SHIFTGUIDE_DESKTOP_NAV_WIDTH_PX = 96/);
});

test('shell geometry numeric values have a single runtime source of truth', async () => {
  const css = await read('src/responsive-shell.css');
  const geometry = await read('src/layout/responsiveGeometry.ts');

  assert.doesNotMatch(css, /--app-header-height:\s*56px/);
  assert.doesNotMatch(css, /--shiftguide-mobile-nav-reserve:\s*80px/);
  assert.doesNotMatch(css, /--shiftguide-desktop-nav-width:\s*96px/);
  assert.match(geometry, /APP_HEADER_HEIGHT_PX = 56/);
  assert.match(geometry, /SHIFTGUIDE_MOBILE_NAV_RESERVE_PX = 80/);
  assert.match(geometry, /SHIFTGUIDE_DESKTOP_NAV_WIDTH_PX = 96/);
});

test('global stylesheet cannot hide responsive defects or force arbitrary wrapping', async () => {
  const globalCss = await read('src/index.css');

  assert.doesNotMatch(globalCss, /overflow-x:\s*hidden/);
  assert.doesNotMatch(globalCss, /overflow-wrap:\s*anywhere/);
});
