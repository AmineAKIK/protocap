import { describe, expect, it } from 'vitest';
import type { ConditioningLine } from '../../types/expiry';
import { prepareDeclaration, type DeclarationDraft } from './declaration';

const now = new Date('2026-09-17T12:00:30Z');
const line: ConditioningLine = {
  id: 'a', name: 'Ligne A', vat: 'Cuve 1', product: 'Fixture', conditioningStartedAt: '2026-09-15T12:00:00Z',
  elements: [{ type: 'fillingBlock', label: 'Bloc', operator: 'Fixture', validityDays: 5,
    lastChangedAt: '2026-09-15T12:00:00Z', expiresAt: '2026-09-20T12:00:00Z' }],
};
const draft: DeclarationDraft = { changedAt: '2026-09-17T12:00', timeZone: 'UTC', occurrence: '', operator: 'Fixture', vat: 'Cuve 2', comment: '' };

describe('declaration text controls', () => {
  it.each(['operator', 'vat', 'comment'] as const)('keeps the full ASCII policy for %s without weakening validation', (field) => {
    for (let code = 0; code < 128; code += 1) {
      const result = prepareDeclaration([line], 'a', 'refill', { ...draft, [field]: `A${String.fromCharCode(code)}B` }, now, 'id');
      const forbidden = (code < 32 && ![9, 10, 13].includes(code)) || code === 127;
      expect(result.ok, `${field}: character ${code}`).toBe(!forbidden);
      if (forbidden) expect(result).toMatchObject({ ok: false, error: { field } });
    }
  });
  it('preserves ordinary Unicode and multiline comments', () => {
    const result = prepareDeclaration([line], 'a', 'refill', { ...draft, operator: 'Éléonore', comment: 'Matière vérifiée\nRéférence Ω' }, now, 'id');
    expect(result).toMatchObject({ ok: true, entry: { operator: 'Éléonore', comment: 'Matière vérifiée\nRéférence Ω' } });
  });
});
