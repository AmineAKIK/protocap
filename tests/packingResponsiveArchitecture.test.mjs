import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('Packing responsive and polish rules are isolated from the global stylesheet', async () => {
  const globalCss = await read('src/index.css');
  const packingCss = await read('src/packing-responsive.css');
  const polishCss = await read('src/packing-polish.css');
  const main = await read('src/main.tsx');

  assert.doesNotMatch(globalCss, /packing-calculator-page/);
  assert.match(main, /import '\.\/packing-responsive\.css';/);
  assert.match(main, /import '\.\/packing-polish\.css';/);
  assert.match(packingCss, /\.packing-calculator-page/);
  assert.match(polishCss, /\.packing-calculator-page/);
  assert.match(polishCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test('Packing density targets semantic hooks instead of DOM position discovery', async () => {
  const css = stripCssComments(await read('src/packing-responsive.css'));
  const page = await read('src/pages/PackingCalculatorPage.tsx');
  const planning = await read('src/features/packing/components/PackingPlanningRail.tsx');
  const cockpit = await read('src/features/packing/components/PackingCockpitSummary.tsx');
  const candidate = await read('src/features/packing/components/PackingPlanCandidate.tsx');
  const execution = await read('src/features/packing/components/PackingRunExecution.tsx');

  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /:(?:first|last|nth|nth-last)-(?:child|of-type)/);
  assert.match(css, /section\[aria-label='Référence et résultat exact'\]/);
  assert.match(css, /section\[aria-label='Plan actif et déclarations de production'\]/);
  assert.match(css, /section\[aria-labelledby='packing-run-execution-title'\]/);
  assert.match(css, /\.packing-plan(?:-metric)?/);
  assert.match(page, /PackingPlanningRail/);
  assert.match(page, /PackingCockpitSummary/);
  assert.match(page, /PackingRunExecution/);
  assert.match(planning, /packing-primary-input/);
  assert.match(candidate, /packing-plan-metrics/);
  assert.match(cockpit, /packing-cockpit-primary/);
  assert.match(cockpit, /packing-cockpit-secondary/);
  assert.match(cockpit, /packing-progress-fill/);
  assert.match(execution, /packing-primary-action/);
  assert.match(execution, /packing-run-execution-title/);
  assert.match(execution, /Déclarer une charge/);
  assert.match(execution, /Historique des déclarations/);
});

test('Packing viewport fit is height-aware, shell-owned and locally scrollable', async () => {
  const page = await read('src/pages/PackingCalculatorPage.tsx');
  const planning = await read('src/features/packing/components/PackingPlanningRail.tsx');
  const css = stripCssComments(await read('src/packing-responsive.css'));
  const polishCss = stripCssComments(await read('src/packing-polish.css'));
  const shell = await read('src/responsive-shell.css');

  assert.match(page, /xl:grid-cols-\[minmax\(22rem,0\.78fr\)_minmax\(0,1\.22fr\)\]/);
  assert.match(planning, /sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3/);
  assert.match(css, /\.packing-calculator-page \.tabular-nums \{\s*white-space: nowrap;/s);
  assert.doesNotMatch(css, /overflow-wrap:/);
  assert.doesNotMatch(css, /word-break:/);
  assert.match(css, /@media \(max-width: 479px\)/);
  assert.match(css, /@media \(min-width: 1024px\) and \(min-height: 700px\)/);
  assert.match(css, /100dvh - var\(--app-header-height\) - var\(--packing-shell-bottom-reserve\)/);
  assert.match(css, /--packing-shell-bottom-reserve: var\(--app-mobile-nav-reserve\)/);
  assert.match(css, /--packing-shell-bottom-reserve: 0px/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /overscroll-behavior: contain/);
  assert.match(polishCss, /@media \(min-width: 1024px\) and \(min-height: 700px\)/);
  assert.match(polishCss, /\.packing-progress/);
  assert.match(shell, /padding-bottom: calc\(var\(--app-mobile-nav-reserve\)/);
});
