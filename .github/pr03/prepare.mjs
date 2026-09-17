import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const parent = '375abcd08889ea485a41fd10b5ffdb8fd86e035d';
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), parent);
const work = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const changed = new Set();
function save(path, text) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); changed.add(path); }
function edit(path, operation) { save(path, operation(readFileSync(path, 'utf8'))); }
function once(text, from, to) {
  assert.equal(text.split(from).length - 1, 1, `Expected one replacement for ${from.slice(0, 110)}`);
  return text.replace(from, to);
}
function range(text, from, until, replacement) {
  const start = text.indexOf(from); const end = text.indexOf(until, start + from.length);
  assert.ok(start >= 0 && end > start, `Missing range ${from} / ${until}`);
  return text.slice(0, start) + replacement + text.slice(end);
}
for (const path of ['tests/temporalRegression.test.mjs', 'src/pages/ExpiryCheckPage.test.tsx', 'e2e/expiry-time.spec.ts', 'docs/release-evidence/pr-03-temporal-contract.md']) {
  mkdirSync(dirname(path), { recursive: true }); copyFileSync(resolve(work, path), path); changed.add(path);
}

edit('src/pages/ExpiryCheckPage.tsx', (text) => {
  text = once(text, "import { addDays, formatDateTime, hoursUntil } from '../utils/date';", "import { hoursUntil } from '../utils/date';\nimport { DeclarationForm } from '../features/expiry/DeclarationForm';\nimport { prepareDeclaration, type DeclarationDraft, type DeclarationError, type DeclarationKind } from '../features/expiry/declaration';\nimport { formatStoredTime as formatDateTime, instantMilliseconds } from '../features/expiry/time';");
  text = once(text, "import { getElementStatus, getLineStatus, statusLabel } from '../utils/expiry';", "import { getBlockStatus as getTemporalBlockStatus, getLineStatus, statusLabel, earliestExpiry, latestChange, remainingValidityPercent } from '../utils/expiry';");
  text = once(text, "  nonConform: 'red'", "  nonConform: 'red',\n  unknown: 'slate'");
  text = range(text, 'function getBlockStatus(', 'function remainingLabel(', `function getBlockStatus(line: ConditioningLine) {
  return getLineStatus(line) === 'unknown' ? 'unknown' : getTemporalBlockStatus(line);
}

function canGroupHistoryEntry(entry: ChangeHistoryEntry) {
  const changedAt = instantMilliseconds(entry.changedAt);
  const expiresAt = instantMilliseconds(entry.newExpiresAt);
  return changedAt !== null && expiresAt !== null && changedAt <= Date.now() && expiresAt > changedAt;
}

`);
  text = once(text, 'function remainingLabel(line: ConditioningLine) {', "function remainingLabel(line: ConditioningLine) {\n  if (getBlockStatus(line) === 'unknown') return 'État à vérifier';");
  for (const name of ['formatDateOnly', 'formatTimeOnly']) {
    text = once(text, `function ${name}(dateIso: string) {`, `function ${name}(dateIso: string) {\n  if (instantMilliseconds(dateIso) === null) return 'Date à vérifier';`);
  }
  text = once(text, "  const remaining = hoursUntil(expiresAt);\n  const pct = Math.min(100, Math.max(0, (remaining / (validityDays * 24)) * 100));", "  const pct = remainingValidityPercent(line);");
  text = once(text, "  const label = remainingLabel(line);\n\n  return (", "  const label = remainingLabel(line);\n\n  if (pct === null) return <p className=\"break-normal text-sm font-semibold text-slate-700\">Validité indéterminée — données à vérifier.</p>;\n\n  return (");
  text = once(text, 'Validité restante ({validityDays} j max)', 'Validité restante ({validityDays} jours calendaires)');
  text = once(text, "  const isBlocked = lineStatus === 'nonConform';", "  const isBlocked = lineStatus === 'nonConform';\n  const isUnknown = lineStatus === 'unknown';");
  text = once(text, "      blocked: statuses.filter((s) => s === 'nonConform').length", "      blocked: statuses.filter((s) => s === 'nonConform').length,\n      unknown: statuses.filter((s) => s === 'unknown').length");
  text = range(text, '  function handleVatSubmit(', '  function openDeclareFromBlockedModal()', `  function handleDeclaration(kind: DeclarationKind, draft: DeclarationDraft): DeclarationError | null {
    // All validation and date calculations finish before either legacy storage setter.
    // Atomic persistence and failed-write recovery remain PR-05/06, not a claim of this preflight.
    if (!selectedLine) return { field: 'form', message: 'La ligne sélectionnée n’existe plus.' };
    let id: string;
    try { id = crypto.randomUUID(); }
    catch { return { field: 'form', message: 'Identifiant indisponible. Aucune donnée n’a été modifiée.' }; }
    const result = prepareDeclaration(lines, selectedLine.id, kind, draft, new Date(), id);
    if (!result.ok) return result.error;
    setLines(result.lines);
    setHistory((current) => [result.entry, ...current]);
    if (kind === 'replacement') setDeclareModalOpen(false);
    else setVatModalOpen(false);
    return null;
  }

`);
  text = once(text, '  const blockStatus = getBlockStatus(selectedLine);', `  if (!selectedLine) return (
    <div className="mx-auto min-w-0 max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="break-normal text-xl font-bold">Expiry Check</h1>
      <p className="mt-4 break-normal">Aucune ligne exploitable. Les données existantes restent conservées ; aucune conformité ne peut être établie.</p>
    </div>
  );

  const blockStatus = getBlockStatus(selectedLine);`);
  text = once(text, '  const blockHistory = selectedLineHistory.filter(isBlockHistoryEntry);', '  const blockHistory = selectedLineHistory.filter(isBlockHistoryEntry).filter(canGroupHistoryEntry);');
  text = once(text, "    elementLabel: 'Bloc de remplissage',", "    elementLabel: 'État courant du bloc — sans déclaration enregistrée',");
  text = once(text, '  const blockInstances = (hasCurrentBlockHistory ? blockHistory : [currentBlockHistory, ...blockHistory])', "  const blockInstances = (hasCurrentBlockHistory || isUnknown ? blockHistory : [currentBlockHistory, ...blockHistory])");
  text = once(text, '    .filter(isVatHistoryEntry)', '    .filter(isVatHistoryEntry)\n    .filter(canGroupHistoryEntry)');
  text = once(text, '      isCurrent: index === 0,', '      isCurrent: !isUnknown && blockStartedAt === currentBlockChangedAt,');
  text = once(text, '  const washerBoard = lines;', `  const washerBoard = lines;
  const groupedIds = new Set(blockHistoryGroups.flatMap((group) => [group.block.id, ...group.vatEntries.map((entry) => entry.id)]));
  const unclassifiedEntries = selectedLineHistory.filter((entry) => !groupedIds.has(entry.id));`);
  text = once(text, '      <div\n        className="sticky', `      {unclassifiedEntries.length > 0 && <section className="mb-4 min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-3">
        <h2 className="break-normal font-bold">Traces non rattachables — à vérifier</h2>
        <p className="break-normal text-sm">Ces traces sont conservées sans inventer de date ni les attribuer à un bloc.</p>
        {unclassifiedEntries.map((entry, index) => <div key={index} className="mt-2 min-w-0 text-sm">
          <p className="break-normal">{entry.elementLabel} · {entry.operator}</p>
          <div className="max-w-full overflow-x-auto"><code>{entry.changedAt}</code></div>
          {entry.comment && <p className="break-normal">{entry.comment}</p>}
        </div>)}
      </section>}

      <div
        className="sticky`);
  text = once(text, "                  const selectorTone =\n                    status === 'nonConform'", "                  const selectorTone =\n                    status === 'unknown' ? 'border-slate-400 bg-slate-100 text-slate-900' :\n                    status === 'nonConform'");
  text = once(text, '            {isBlocked ? (', `            {isUnknown ? (
              <div className="min-w-0 rounded-xl border-2 border-slate-400 bg-slate-50 p-3 sm:p-4">
                <p className="break-normal font-bold">État à vérifier</p>
                <p className="break-normal text-sm">Bloc : état temporel incohérent ou incomplet. Aucune autorisation de démarrage ne peut être établie. Les données restent conservées pour vérification.</p>
              </div>
            ) : isBlocked ? (`);
  // Unknown data must not fall through to any green presentation, including tour cards.
  text = text.replaceAll("blockStatus === 'expired' ?", "(blockStatus === 'expired' || blockStatus === 'unknown') ?");
  text = text.replaceAll("status === 'expired' ?", "(status === 'expired' || status === 'unknown') ?");
  text = once(text, '<dd className="text-right font-medium text-slate-800">{selectedLine.elements[0]?.validityDays ?? 5} jours</dd>', '<dd className="text-right font-medium text-slate-800">{isUnknown ? \'À vérifier\' : `${selectedLine.elements[0].validityDays} jours calendaires`}</dd>');
  text = once(text, '                    onClick={() => setDeclareModalOpen(true)}', '                    disabled={isUnknown}\n                    onClick={() => setDeclareModalOpen(true)}');
  text = once(text, 'variant="secondary" icon={<RefreshCcw size={15} />} onClick={() => setVatModalOpen(true)}', 'variant="secondary" disabled={isUnknown} icon={<RefreshCcw size={15} />} onClick={() => setVatModalOpen(true)}');
  text = once(text, '          <div className="mb-3 grid grid-cols-3 gap-2 sm:mb-4 sm:gap-3">', '          <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:grid-cols-4 sm:gap-3">');
  text = once(text, '              <p className="mt-1 text-2xl font-bold text-slate-950">{stats.blocked}</p>\n            </div>', '              <p className="mt-1 text-2xl font-bold text-slate-950">{stats.blocked}</p>\n            </div>\n            <div className="min-w-0 rounded-xl border border-slate-300 bg-slate-50 p-2 text-center sm:p-4">\n              <p className="text-[10px] font-semibold text-slate-700 sm:text-xs">À vérifier</p>\n              <p className="mt-1 text-2xl font-bold text-slate-950">{stats.unknown}</p>\n            </div>');
  text = range(text, '      {vatModalOpen && (', '\n    </div>\n  );\n}', `      {vatModalOpen && (
        <Modal title="Tracer une recharge de cuve" onClose={() => setVatModalOpen(false)}>
          <DeclarationForm key={selectedLine.id} line={selectedLine} kind="refill" onCancel={() => setVatModalOpen(false)} onDeclare={(draft) => handleDeclaration('refill', draft)} />
        </Modal>
      )}
      {declareModalOpen && (
        <Modal title="Déclarer un remplacement" onClose={() => setDeclareModalOpen(false)}>
          <DeclarationForm key={selectedLine.id} line={selectedLine} kind="replacement" onCancel={() => setDeclareModalOpen(false)} onDeclare={(draft) => handleDeclaration('replacement', draft)} />
        </Modal>
      )}`);
  assert.ok(!text.includes('handleVatSubmit') && !text.includes('handleDeclareSubmit') && !text.includes('toISOString().slice'));
  return text;
});

edit('src/utils/publicStorageValidation.ts', (text) => range(text, 'function isContactElement(', 'function isPackingFormState(', `// Expiry parsing preserves structurally readable evidence. Semantic validity belongs to
// getLineStatus / prepareDeclaration; rejecting a timestamp here would replace it with demo data.
function isContactElement(value: unknown): value is ContactElement {
  if (!isRecord(value)) return false;
  return value.type === 'fillingBlock' && isString(value.label)
    && isString(value.lastChangedAt) && isString(value.expiresAt)
    && typeof value.validityDays === 'number' && Number.isFinite(value.validityDays)
    && isString(value.operator) && isOptionalString(value.comment)
    && isOptionalString(value.timeZone) && isOptionalString(value.validityRule);
}
function isConditioningLine(value: unknown): value is ConditioningLine {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.name) && isString(value.vat) && isString(value.product)
    && isString(value.conditioningStartedAt) && Array.isArray(value.elements) && value.elements.every(isContactElement);
}
function isConditioningLineList(value: unknown): value is ConditioningLine[] {
  return Array.isArray(value) && value.every(isConditioningLine);
}
function isChangeHistoryEntry(value: unknown): value is ChangeHistoryEntry {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.lineId) && isString(value.lineName) && isString(value.elementLabel)
    && isString(value.changedAt) && isString(value.operator) && isOptionalString(value.comment)
    && isOptionalString(value.previousExpiresAt) && isString(value.newExpiresAt)
    && isOptionalString(value.timeZone) && isOptionalString(value.validityRule);
}
function isChangeHistoryList(value: unknown): value is ChangeHistoryEntry[] {
  return Array.isArray(value) && value.every(isChangeHistoryEntry);
}

`));
edit('src/utils/publicStorageValidation.test.ts', (text) => {
  text = once(text, "  it('rejects partial, structurally invalid, retired, or unsafe persisted values', () => {", "  it('keeps empty Expiry records readable without weakening other schemas', () => {");
  text = once(text, "expect(isValidPublicStorageValue('lineops.expiry.lines', [])).toBe(false);", "expect(isValidPublicStorageValue('lineops.expiry.lines', [])).toBe(true);\n    expect(isValidPublicStorageValue('lineops.expiry.lines', [{ id: 'partial' }])).toBe(false);");
  text = once(text, '      elements: [],\n    }])).toBe(false);', '      elements: [],\n    }])).toBe(true);');
  return text;
});
edit('src/utils/expiry.test.ts', (text) => {
  text = once(text, "it('classifies an invalid expiry as expired instead of OK'", "it('classifies an invalid expiry as unknown, never OK or a falsely known expiration'");
  text = once(text, "getElementStatus(element('not-a-date'), now)).toBe('expired')", "getElementStatus(element('not-a-date'), now)).toBe('unknown')");
  return once(text, "getLineStatus(line('not-a-date'), now)).toBe('nonConform')", "getLineStatus(line('not-a-date'), now)).toBe('unknown')");
});
edit('src/utils/expiry.ts', (text) => once(text, "unknown: 'À vérifier'", "unknown: 'État à vérifier'"));
edit('src/features/expiry/time.ts', (text) => {
  text = once(text, "!['', 'earlier', 'later'].includes(String(occurrence))", "(typeof occurrence !== 'string' || !['', 'earlier', 'later'].includes(occurrence))");
  text = once(text, "    return { ok: true, instant: serialize(occurrence === 'later' ? later : earlier), timeZone };", "    const instant = serialize(occurrence === 'later' ? later : earlier);\n    if (instantMilliseconds(instant) === null) return fail('invalid', 'Instant hors plage. Aucune donnée n’a été modifiée.');\n    return { ok: true, instant, timeZone };");
  return once(text, "  return result.toInstant().toString({ smallestUnit: 'millisecond' });", "  const serialized = result.toInstant().toString({ smallestUnit: 'millisecond' });\n  if (instantMilliseconds(serialized) === null) throw new RangeError('Expiry instant outside the supported calendar.');\n  return serialized;");
});
edit('src/features/expiry/DeclarationForm.tsx', (text) => {
  text = once(text, '  const formRef = useRef<HTMLFormElement>(null);', '  const formRef = useRef<HTMLFormElement>(null);\n  const submittedRef = useRef(false);');
  text = once(text, '    setError(onDeclare(draft));', '    if (submittedRef.current) return;\n    const result = onDeclare(draft);\n    if (result === null) submittedRef.current = true;\n    setError(result);');
  return text;
});
edit('vitest.config.ts', (text) => once(text, "        'src/utils/expiry.ts',", "        'src/utils/expiry.ts',\n        'src/features/expiry/time.ts',\n        'src/features/expiry/declaration.ts',\n        'src/features/expiry/DeclarationForm.tsx',\n        'src/pages/ExpiryCheckPage.tsx',"));
edit('package.json', (text) => {
  const pkg = JSON.parse(text);
  pkg.scripts['test:e2e:expiry'] = 'playwright test e2e/expiry-time.spec.ts --project=chromium --project=chromium-mobile --project=webkit';
  return JSON.stringify(pkg, null, 2) + '\n';
});
edit('.github/workflows/ci.yml', (text) => text + `
      - name: Run Expiry temporal journeys across browsers
        run: npm run test:e2e:expiry
        env:
          DEEPSEEK_API_KEY: e2e-sentinel-must-not-be-used
          SG_SYSTEM_PROMPT: e2e-host-config-must-not-be-used
`);
writeFileSync('/tmp/pr03-changed-paths.json', JSON.stringify([...changed]));
console.log('PR03_SOURCE_CHANGES', JSON.stringify([...changed]));
