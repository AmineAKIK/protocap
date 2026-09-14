import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

const lexicon = read('src/pages/shiftguide/LexiquePage.tsx');
const celine = read('src/pages/shiftguide/CelinePage.tsx');
const emergencies = read('src/pages/shiftguide/UrgencesPage.tsx');
const linePulse = read('src/pages/shiftguide/LinePulsePage.tsx');
const analysis = read('src/pages/shiftguide/LineAnalysisReportPage.tsx');
const shell = read('src/components/ShiftGuideLayout.tsx');

test('standard ShiftGuide pages use document scroll while Celine keeps the explicit chat scroll exception', () => {
  assert.match(lexicon, /min-h-screen min-w-0/);
  assert.doesNotMatch(lexicon, /h-\[100dvh\]/);
  assert.doesNotMatch(lexicon, /flex-1 overflow-y-auto/);

  assert.match(celine, /flex h-\[100dvh\] flex-col/);
  assert.match(celine, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(shell, /shiftguide-celine-content/);
  assert.match(shell, /shiftguide-standard-content/);
});

test('ShiftGuide emergency major secondary columns wait until after the desktop rail onset', () => {
  assert.match(emergencies, /xl:grid-cols-\[minmax\(0,1fr\)_24rem\]/);
  assert.match(emergencies, /xl:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(20rem,0\.85fr\)\]/);

  assert.doesNotMatch(emergencies, /lg:grid-cols-\[minmax\(0,1fr\)_24rem\]/);
  assert.doesNotMatch(emergencies, /lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(20rem,0\.85fr\)\]/);
});

test('ShiftGuide dense surfaces keep their major rails and sidebars in the wide regime', () => {
  assert.match(linePulse, /xl:grid-cols-\[minmax\(0,1fr\)_34rem\]/);
  assert.match(linePulse, /xl:grid-cols-\[minmax\(0,1fr\)_22rem\]/);
  assert.match(linePulse, /xl:grid-cols-\[minmax\(0,1fr\)_24rem\]/);

  assert.match(analysis, /hidden xl:block/);
  assert.match(analysis, /xl:grid-cols-\[17rem_minmax\(0,1fr\)\]/);
  assert.match(analysis, /xl:hidden/);
});

test('ShiftGuide migrated surfaces declare intrinsic shrinkability instead of relying on root clipping', () => {
  assert.match(lexicon, /min-w-0/);
  assert.match(lexicon, /break-normal/);
  assert.match(emergencies, /min-w-0/);
  assert.match(emergencies, /break-normal/);
});
