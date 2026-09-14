import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const report = fs.readFileSync(new URL('../src/pages/OperationalReportPage.tsx', import.meta.url), 'utf8');
const presentation = fs.readFileSync(new URL('../src/components/PresentationMode.tsx', import.meta.url), 'utf8');

test('Operational Report delays dense editorial splits until wide layouts', () => {
  assert.match(report, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.match(report, /xl:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.match(report, /xl:grid-cols-\[minmax\(0,1fr\)_280px\]/);
  assert.match(report, /xl:grid-cols-2/);

  assert.doesNotMatch(report, /lg:grid-cols-\[1fr_(?:280|300|320)px\]/);
  assert.doesNotMatch(report, /lg:grid-cols-2/);
});

test('Operational Report is intrinsically shrinkable without compatibility wrapping hacks', () => {
  assert.match(report, /<div className="min-w-0 bg-slate-50 text-slate-900">/);
  assert.match(report, /break-normal/);
  assert.match(report, /md:grid-cols-3/);
  assert.match(report, /md:grid-cols-2/);
});

test('Presentation Mode owns dynamic viewport height and isolates vertical scrolling to slide content', () => {
  assert.match(presentation, /h-\[100dvh\]/);
  assert.match(presentation, /grid-rows-\[auto_auto_minmax\(0,1fr\)_auto\]/);
  assert.match(presentation, /min-h-0 overflow-y-auto overscroll-contain/);
  assert.match(presentation, /role="dialog"/);
  assert.match(presentation, /aria-modal="true"/);

  assert.doesNotMatch(presentation, /flex flex-1 flex-col justify-center overflow-y-auto/);
});

test('Presentation slide grids collapse before phone content becomes cramped', () => {
  assert.match(presentation, /grid grid-cols-1 gap-1\.5 sm:grid-cols-2/);
  assert.match(presentation, /grid grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.match(presentation, /grid grid-cols-1 gap-1\.5 sm:grid-cols-3/);
});
