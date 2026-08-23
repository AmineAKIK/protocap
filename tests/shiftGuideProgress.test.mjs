import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONFIG_REVISION_STORAGE_KEY,
  LEGACY_MODULE_PREFIX,
  LEGACY_PROGRESS_STORAGE_KEY,
  LEGACY_PROGRESS_V2_STORAGE_KEY,
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

const CONFIG_REVISION = 'sha256:test-config-revision';

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

function revisionStorage(entries = {}) {
  return new MemoryStorage({ [CONFIG_REVISION_STORAGE_KEY]: CONFIG_REVISION, ...entries });
}

function progressState(overrides = {}) {
  return {
    version: 3,
    configRevision: CONFIG_REVISION,
    actions: {},
    activeChoices: {},
    updatedAt: 0,
    ...overrides,
  };
}

const choiceModule = {
  id: 'changement_oc',
  type: 'choice',
  subModules: [
    { id: 'ch_lot', actions: [{ id: 'lot_1' }] },
    { id: 'ch_formule', actions: [{ id: 'form_1' }, { id: 'form_2' }] },
  ],
};

test('pre-revision progress is discarded instead of being attributed to the current procedure', () => {
  const storage = revisionStorage({
    [LEGACY_PROGRESS_STORAGE_KEY]: JSON.stringify({ actions: { a1: 'validated' } }),
    [LEGACY_PROGRESS_V2_STORAGE_KEY]: JSON.stringify({
      version: 2,
      actions: { a2: 'validated' },
      activeChoices: {},
      updatedAt: 30,
    }),
    [`${LEGACY_MODULE_PREFIX}module-a`]: JSON.stringify({ actions: { a3: 'na' } }),
  });

  const state = readProgressState(storage);

  assert.equal(state.version, 3);
  assert.equal(state.configRevision, CONFIG_REVISION);
  assert.deepEqual(state.actions, {});
  assert.equal(storage.getItem(LEGACY_PROGRESS_STORAGE_KEY), null);
  assert.equal(storage.getItem(LEGACY_PROGRESS_V2_STORAGE_KEY), null);
  assert.equal(storage.getItem(`${LEGACY_MODULE_PREFIX}module-a`), null);
});

test('a v3 state from another config revision is reset even when action ids still match', () => {
  const storage = revisionStorage({
    [PROGRESS_STORAGE_KEY]: JSON.stringify({
      version: 3,
      configRevision: 'sha256:old-config',
      actions: { a1: 'validated' },
      activeChoices: {},
      updatedAt: 30,
    }),
  });

  const state = readProgressState(storage);
  assert.equal(state.configRevision, CONFIG_REVISION);
  assert.deepEqual(state.actions, {});

  const persisted = JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY));
  assert.equal(persisted.configRevision, CONFIG_REVISION);
  assert.deepEqual(persisted.actions, {});
});

test('current revision-bound progress remains stable across reads', () => {
  const storage = revisionStorage({
    [PROGRESS_STORAGE_KEY]: JSON.stringify(progressState({
      actions: { a1: 'na' },
      updatedAt: 30,
    })),
  });

  const state = readProgressState(storage);
  assert.deepEqual(state.actions, { a1: 'na' });
  assert.deepEqual(readProgressState(storage), state);
});

test('choice summary follows only the explicitly selected scenario', () => {
  let state = progressState({
    actions: { lot_1: 'validated', form_1: 'validated' },
  });

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
  const state = progressState({
    actions: { lot_1: 'validated', form_1: 'validated', form_2: 'na' },
  });

  assert.equal(resolveActiveChoice(state, choiceModule), 'ch_formule');
  assert.equal(summarizeChoiceModule(state, choiceModule).isComplete, true);
});

test('switching active choice preserves historical actions but changes the parent meaning', () => {
  let state = progressState({
    actions: { lot_1: 'validated', form_1: 'validated' },
    activeChoices: { changement_oc: 'ch_lot' },
  });

  assert.equal(summarizeChoiceModule(state, choiceModule).isComplete, true);
  state = withActiveChoice(state, 'changement_oc', 'ch_formule');
  const summary = summarizeChoiceModule(state, choiceModule);

  assert.equal(state.actions.lot_1, 'validated');
  assert.equal(summary.treatedCount, 1);
  assert.equal(summary.totalActions, 2);
  assert.equal(summary.isComplete, false);
});

test('action updates and scoped reset keep unrelated progress intact within one revision', () => {
  const storage = revisionStorage();
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
