import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LEGACY_MODULE_PREFIX,
  LEGACY_PROGRESS_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
  readProgressState,
  resolveActiveChoice,
  summarizeActions,
  summarizeChoiceModule,
  withActionStatus,
  withActiveChoice,
  withoutActions,
  writeProgressState,
} from '../shared/shiftGuideProgress.js';

class MemoryStorage {
  constructor(entries = {}) {
    this.map = new Map(Object.entries(entries));
  }
  get length() {
    return this.map.size;
  }
  key(index) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}

const choiceModule = {
  id: 'changement_oc',
  type: 'choice',
  subModules: [
    { id: 'ch_lot', actions: [{ id: 'lot_1' }] },
    { id: 'ch_formule', actions: [{ id: 'form_1' }, { id: 'form_2' }] },
  ],
};

test('progress migration merges v1 and module keys once then removes legacy storage', () => {
  const storage = new MemoryStorage({
    [LEGACY_PROGRESS_STORAGE_KEY]: JSON.stringify({
      actions: { a1: 'validated', a2: 'pending', bad: 'unknown' },
      updatedAt: 10,
    }),
    [`${LEGACY_MODULE_PREFIX}module-a`]: JSON.stringify({
      actions: { a1: 'na', a3: 'na' },
      updatedAt: 20,
    }),
  });

  const state = readProgressState(storage);

  assert.deepEqual(state.actions, { a1: 'validated', a3: 'na' });
  assert.equal(storage.getItem(LEGACY_PROGRESS_STORAGE_KEY), null);
  assert.equal(storage.getItem(`${LEGACY_MODULE_PREFIX}module-a`), null);
  assert.ok(storage.getItem(PROGRESS_STORAGE_KEY));

  const secondRead = readProgressState(storage);
  assert.deepEqual(secondRead.actions, state.actions);
});

test('current v2 state wins over stale legacy values during final migration', () => {
  const storage = new MemoryStorage({
    [PROGRESS_STORAGE_KEY]: JSON.stringify({
      version: 2,
      actions: { a1: 'na' },
      activeChoices: {},
      updatedAt: 30,
    }),
    [`${LEGACY_MODULE_PREFIX}module-a`]: JSON.stringify({ actions: { a1: 'validated', a2: 'validated' } }),
  });

  const state = readProgressState(storage);
  assert.deepEqual(state.actions, { a1: 'na', a2: 'validated' });
});

test('choice summary follows only the explicitly selected scenario', () => {
  let state = {
    version: 2,
    actions: { lot_1: 'validated', form_1: 'validated' },
    activeChoices: {},
    updatedAt: 0,
  };

  state = withActiveChoice(state, 'changement_oc', 'ch_formule');
  const summary = summarizeChoiceModule(state, choiceModule);

  assert.deepEqual(summary, {
    treatedCount: 1,
    totalActions: 2,
    isComplete: false,
    activeSubModuleId: 'ch_formule',
  });
});

test('choice summary infers the most advanced legacy scenario when no selection exists', () => {
  const state = {
    version: 2,
    actions: { lot_1: 'validated', form_1: 'validated', form_2: 'na' },
    activeChoices: {},
    updatedAt: 0,
  };

  assert.equal(resolveActiveChoice(state, choiceModule), 'ch_formule');
  assert.equal(summarizeChoiceModule(state, choiceModule).isComplete, true);
});

test('switching active choice preserves historical actions but changes the parent meaning', () => {
  let state = {
    version: 2,
    actions: { lot_1: 'validated', form_1: 'validated' },
    activeChoices: { changement_oc: 'ch_lot' },
    updatedAt: 0,
  };

  assert.equal(summarizeChoiceModule(state, choiceModule).isComplete, true);
  state = withActiveChoice(state, 'changement_oc', 'ch_formule');
  const summary = summarizeChoiceModule(state, choiceModule);

  assert.equal(state.actions.lot_1, 'validated');
  assert.equal(summary.treatedCount, 1);
  assert.equal(summary.totalActions, 2);
  assert.equal(summary.isComplete, false);
});

test('action updates and scoped reset keep unrelated progress intact', () => {
  const storage = new MemoryStorage();
  let state = readProgressState(storage);
  state = withActionStatus(state, 'a1', 'validated');
  state = withActionStatus(state, 'a2', 'na');
  state = withActionStatus(state, 'other', 'validated');
  writeProgressState(storage, state);

  state = withoutActions(readProgressState(storage), ['a1', 'a2']);
  writeProgressState(storage, state);

  assert.deepEqual(summarizeActions(readProgressState(storage), ['a1', 'a2']), {
    treatedCount: 0,
    totalActions: 2,
    isComplete: false,
  });
  assert.equal(readProgressState(storage).actions.other, 'validated');
});
