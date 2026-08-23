import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearRevisionBoundShiftGuideData,
  reconcileCelineAuthorityRevision,
  reconcileShiftGuideConfigRevision,
} from '../shared/shiftGuidePersistence.js';
import {
  readProgressState,
  writeProgressState,
} from '../shared/shiftGuideProgress.js';

class FaultyStorage {
  get length() {
    throw new Error('storage unavailable');
  }
  key() {
    throw new Error('storage unavailable');
  }
  getItem() {
    throw new Error('storage unavailable');
  }
  setItem() {
    throw new Error('storage unavailable');
  }
  removeItem() {
    throw new Error('storage unavailable');
  }
}

test('shared ShiftGuide revision persistence never throws when browser storage is unavailable', () => {
  const storage = new FaultyStorage();

  assert.doesNotThrow(() => clearRevisionBoundShiftGuideData(storage));
  assert.equal(reconcileShiftGuideConfigRevision(storage, 'sha256:config'), true);
  assert.equal(reconcileCelineAuthorityRevision(storage, 'sha256:authority'), true);
});

test('shared ShiftGuide progress returns a safe empty state when storage reads fail', () => {
  const storage = new FaultyStorage();
  assert.deepEqual(readProgressState(storage), {
    version: 3,
    configRevision: '',
    actions: {},
    activeChoices: {},
    updatedAt: 0,
  });
});

test('shared ShiftGuide progress writes degrade without throwing when persistence fails', () => {
  const storage = {
    get length() { return 1; },
    key() { return 'shiftguide_config_revision'; },
    getItem(key) {
      if (key === 'shiftguide_config_revision') return 'sha256:config';
      return null;
    },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };

  assert.doesNotThrow(() => writeProgressState(storage, {
    version: 3,
    configRevision: 'sha256:config',
    actions: { a1: 'validated' },
    activeChoices: {},
    updatedAt: 0,
  }));
  assert.equal(writeProgressState(storage, {
    version: 3,
    configRevision: 'sha256:config',
    actions: { a1: 'validated' },
    activeChoices: {},
    updatedAt: 0,
  }).actions.a1, 'validated');
});
