import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('Packing responsive rules are isolated from the global stylesheet', async () => {
  const globalCss = await read('src/index.css');
  const packingCss = await read('src/packing-responsive.css');
  const main = await read('src/main.tsx');

  assert.doesNotMatch(globalCss, /packing-calculator-page/);
  assert.match(main, /import '\.\/packing-responsive\.css';/);
  assert.match(packingCss, /\.packing-calculator-page/);
});

test('Packing density targets semantic hooks instead of DOM position discovery', async () => {
  const css = stripCssComments(await read('src/packing-responsive.css'));
  const page = await read('src/pages/PackingCalculatorPage.tsx');
  const execution = await read('src/features/packing/components/PackingRunExecution.tsx');

  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /:(?:first|last|nth|nth-last)-(?:child|of-type)/);
  assert.match(css, /section\[aria-label='Référence et résultat exact'\]/);
  assert.match(css, /section\[aria-label='Plan actif et déclarations de production'\]/);
  assert.match(css, /section\[aria-labelledby='packing-run-execution-title'\]/);
  assert.match(css, /\.packing-plan(?:-metric)?/);
  assert.match(page, /packing-plan-metrics/);
  assert.match(page, /packing-primary-input/);
  assert.match(execution, /packing-run-execution-title/);
  assert.match(execution, /Déclarer une charge/);
  assert.match(execution, /Historique des déclarations/);
});

test('Packing keeps content-driven wide composition and local intrinsic safeguards', async () => {
  const page = await read('src/pages/PackingCalculatorPage.tsx');
  const css = await read('src/packing-responsive.css');

  assert.match(page, /xl:grid-cols-\[minmax\(22rem,0\.78fr\)_minmax\(0,1\.22fr\)\]/);
  assert.match(page, /sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3/);
  assert.match(page, /className="min-w-0 space-y-5"/);
  assert.match(css, /\.packing-calculator-page \.tabular-nums \{\s*white-space: nowrap;/s);
  assert.doesNotMatch(css, /overflow-wrap:/);
  assert.doesNotMatch(css, /word-break:/);
  assert.match(css, /@media \(max-width: 479px\)/);
  assert.match(css, /@media \(min-width: 1280px\)/);
});
