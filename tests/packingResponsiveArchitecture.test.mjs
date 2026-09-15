import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

test('Packing responsive and polish rules stay isolated from the global stylesheet', async () => {
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

test('Packing V3 uses semantic hooks and no positional CSS discovery', async () => {
  const css = stripCssComments(await read('src/packing-responsive.css'));
  const polishCss = stripCssComments(await read('src/packing-polish.css'));
  const page = await read('src/pages/PackingCalculatorPage.tsx');
  const planning = await read('src/features/packing/components/PackingPlanningRail.tsx');
  const execution = await read('src/features/packing/components/PackingRunExecution.tsx');

  assert.doesNotMatch(css, /:has\(/);
  assert.doesNotMatch(css, /:(?:first|last|nth|nth-last)-(?:child|of-type)/);
  assert.doesNotMatch(polishCss, /:has\(/);
  assert.doesNotMatch(polishCss, /:(?:first|last|nth|nth-last)-(?:child|of-type)/);
  assert.match(page, /packing-v3-is-running/);
  assert.match(page, /PackingConductWaiting/);
  assert.match(page, /PackingFrozenPreparation/);
  assert.match(page, /PackingRunExecution/);
  assert.doesNotMatch(page, /PackingCockpitSummary|PackingPlanCandidate|packing-columns/);
  assert.match(planning, /packing-v3-preparation/);
  assert.match(planning, /packing-v3-strategies/);
  assert.match(planning, /packing-v3-plan/);
  assert.match(execution, /packing-v3-production-grid/);
  assert.match(execution, /packing-v3-full-load-action/);
  assert.match(execution, /packing-v3-history-scroll/);
  assert.match(execution, /Déclarer une palette complète/);
  assert.match(execution, /Historique des déclarations/);
});

test('Packing preparation stays intrinsic while the active cockpit remains shell-owned and history-scroll-only', async () => {
  const css = stripCssComments(await read('src/packing-responsive.css'));
  const polishCss = stripCssComments(await read('src/packing-polish.css'));
  const shell = await read('src/responsive-shell.css');

  assert.match(css, /@media \(min-width: 1024px\) and \(min-height: 700px\)/);
  assert.match(css, /100dvh - var\(--app-header-height\) - var\(--packing-shell-bottom-reserve\)/);
  assert.match(css, /--packing-shell-bottom-reserve: var\(--app-mobile-nav-reserve\)/);
  assert.match(css, /--packing-shell-bottom-reserve: 0px/);
  assert.match(css, /\.packing-v3-is-preparing \.packing-v3-frame \{[\s\S]*?height:\s*auto;[\s\S]*?grid-template-rows:\s*auto auto;[\s\S]*?align-content:\s*start;[\s\S]*?\}/);
  assert.match(css, /\.packing-v3-is-running \.packing-v3-frame \{[\s\S]*?height:\s*100%;[\s\S]*?grid-template-rows:\s*minmax\(0,1fr\) auto;[\s\S]*?\}/);
  assert.match(css, /\.packing-v3-history-scroll \{[^}]*overflow-y:auto/s);
  assert.match(css, /overscroll-behavior:contain/);
  assert.doesNotMatch(css, /overflow-wrap:/);
  assert.doesNotMatch(css, /word-break:/);
  assert.match(polishCss, /view-transition-name: packing-preparation-stage/);
  assert.match(polishCss, /view-transition-name: packing-production-stage/);
  assert.match(polishCss, /::view-transition-group\(packing-preparation-stage\)/);
  assert.match(shell, /padding-bottom: calc\(var\(--app-mobile-nav-reserve\)/);
});

test('Packing V3 keeps declaration history authoritative and legacy shipment debt retired', async () => {
  const page = await read('src/pages/PackingCalculatorPage.tsx');
  const planning = await read('src/features/packing/components/PackingPlanningRail.tsx');
  const execution = await read('src/features/packing/components/PackingRunExecution.tsx');
  const packing = await read('src/utils/packing.ts');
  const runDomain = await read('src/features/packing/domain/packingRun.ts');
  const publicStorage = await read('src/utils/publicStorageValidation.ts');

  await assert.rejects(read('src/utils/packingShipment.ts'), /ENOENT/);
  await assert.rejects(read('src/utils/packingShipment.test.ts'), /ENOENT/);
  assert.doesNotMatch(page, /packingShipment|getPackingShipmentProgress|getPackingShipmentLoad/);
  assert.match(planning, /summarizePackingLoads/);
  assert.match(planning, /productionStartTime: string/);
  assert.match(planning, /referenceCadence: string/);
  const planningForm = planning.match(/export interface PackingPlanningFormState \{([\s\S]*?)\n\}/)?.[1] ?? '';
  assert.notEqual(planningForm, '');
  assert.doesNotMatch(planningForm, /\bpolicy\s*:/);
  assert.match(packing, /partialLoadCartons/);
  assert.match(packing, /totalCartons/);
  assert.match(runDomain, /productionStartedAt/);
  assert.match(runDomain, /getPackingRunTiming/);
  assert.match(execution, /addPackingDeclaration/);
  assert.match(execution, /replacePackingDeclaration/);
  assert.match(execution, /removePackingDeclaration/);
  assert.doesNotMatch(packing, /getPackingShipmentProgress|getPackingShipmentLoad|nextLoad|shippedLoads/);
  assert.doesNotMatch(publicStorage, /lineops\.packing\.shipment\.progress/);
  assert.doesNotMatch(publicStorage, /PersistedPackingTrackingState/);
});
