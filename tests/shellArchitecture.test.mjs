import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('public AppShell stays route-agnostic and exposes one shell content region', async () => {
  const shell = await read('src/components/AppShell.tsx');
  const app = await read('src/App.tsx');

  assert.doesNotMatch(shell, /useLocation/);
  assert.doesNotMatch(shell, /packing-calculator-page/);
  assert.doesNotMatch(shell, /pilot-proposal-page/);
  assert.match(shell, /data-app-shell/);
  assert.match(shell, /data-shell-content/);
  assert.match(shell, /aria-label="Navigation principale"/);

  assert.match(app, /PageScope className="pilot-proposal-page"/);
  assert.match(app, /PageScope className="packing-calculator-page"/);
});

test('ShiftGuide shell behavior targets its owned content boundary instead of scanning the whole shell', async () => {
  const layout = await read('src/components/ShiftGuideLayout.tsx');
  const hook = await read('src/hooks/useShiftGuideShell.ts');

  assert.match(layout, /data-shiftguide-shell/);
  assert.match(layout, /data-shell-content/);
  assert.match(hook, /SHIFTGUIDE_CONTENT_SELECTOR/);
  assert.match(hook, /\[data-shiftguide-shell\] \[data-shell-content\]/);
  assert.doesNotMatch(hook, /querySelectorAll<HTMLElement>\('\.shiftguide-shell \*'\)/);
});
