import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const LINES_KEY = 'lineops.expiry.lines.v8';
const HISTORY_KEY = 'lineops.expiry.history.v8';
const AGGREGATE_KEY = 'lineops.expiry.aggregate.v1';
const NOW = '2026-09-17T12:00:30.000Z';
async function openExpiry(page: Page, now = NOW) {
  await page.clock.setFixedTime(new Date(now));
  await page.goto('/expiry-check');
  await expect(page.getByRole('heading', { name: 'Expiry Check', exact: true })).toBeVisible();
}
async function snapshot(page: Page) {
  return page.evaluate(([linesKey, historyKey, aggregateKey]) => {
    const aggregateRaw = localStorage.getItem(aggregateKey);
    if (aggregateRaw) {
      const aggregate = JSON.parse(aggregateRaw) as { lines: unknown; history: unknown };
      return [JSON.stringify(aggregate.lines), JSON.stringify(aggregate.history), aggregateRaw];
    }
    return [localStorage.getItem(linesKey), localStorage.getItem(historyKey), null];
  }, [LINES_KEY, HISTORY_KEY, AGGREGATE_KEY]);
}
async function sourceSnapshot(page: Page) {
  return page.evaluate(([linesKey, historyKey]) => [localStorage.getItem(linesKey), localStorage.getItem(historyKey)], [LINES_KEY, HISTORY_KEY]);
}
async function seedAt(page: Page, changedAt: string, expiresAt: string) {
  await page.addInitScript(({ changedAt, expiresAt }) => {
    localStorage.setItem('lineops.expiry.lines.v8', JSON.stringify([{ id: 'a', name: 'Ligne de conditionnement A', vat: 'Cuve 1', product: 'Fixture synthétique', conditioningStartedAt: changedAt, elements: [{ type: 'fillingBlock', label: 'Bloc', lastChangedAt: changedAt, expiresAt, validityDays: 5, operator: 'Fixture' }] }]));
    localStorage.setItem('lineops.expiry.history.v8', '[]');
  }, { changedAt, expiresAt });
}

for (const [zone, now, local] of [
  ['UTC', NOW, '2026-09-17T12:00'],
  ['Europe/Paris', NOW, '2026-09-17T14:00'],
  ['Europe/Paris', '2026-01-17T12:00:30.000Z', '2026-01-17T13:00'],
  ['America/New_York', NOW, '2026-09-17T08:00'],
]) test.describe(`round trip ${zone} ${now}`, () => {
  test.use({ timezoneId: zone });
  test('T01: real replacement and refill retain the exact instant after reload', async ({ page }) => {
    await openExpiry(page, now);
    await page.getByRole('button', { name: 'Déclarer un remplacement', exact: true }).click();
    await expect(page.getByLabel('Date / heure du remplacement')).toHaveValue(local);
    await page.getByLabel('Opérateur', { exact: true }).fill('Fixture');
    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Ajouter une recharge de cuve' }).click();
    await expect(page.getByLabel('Date / heure', { exact: true })).toHaveValue(local);
    await page.getByLabel('Opérateur', { exact: true }).fill('Fixture');
    await page.getByLabel('Cuve rechargée').fill('Cuve 2');
    await page.getByRole('button', { name: 'Tracer la recharge', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const values = await snapshot(page);
    const lines = JSON.parse(values[0]!) as { vat: string; elements: { lastChangedAt: string; expiresAt: string; timeZone: string }[] }[];
    const history = JSON.parse(values[1]!) as { changedAt: string; newExpiresAt: string; timeZone: string }[];
    expect(history[0].changedAt).toBe(now.replace(':30.000Z', ':00.000Z'));
    expect(history[1].changedAt).toBe(history[0].changedAt);
    expect(history[1].newExpiresAt).toBe(lines[0].elements[0].expiresAt);
    expect(lines[0].elements[0].lastChangedAt).toBe(history[0].changedAt);
    expect(lines[0].elements[0].timeZone).toBe(zone);
    expect(lines[0].vat).toBe('Cuve 2');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Expiry Check', exact: true })).toBeVisible();
    expect(await snapshot(page)).toEqual(values);
  });
});

test.describe('Expiry temporal rejection and recovery boundary', () => {
  test.use({ timezoneId: 'Europe/Paris' });
  for (const kind of ['replacement', 'refill'] as const) test(`T04: future ${kind} causes zero writes and keeps its draft`, async ({ page }) => {
    await openExpiry(page);
    await page.getByRole('button', { name: kind === 'replacement' ? 'Déclarer un remplacement' : 'Ajouter une recharge de cuve', exact: true }).click();
    const input = page.getByLabel(kind === 'replacement' ? 'Date / heure du remplacement' : 'Date / heure', { exact: true });
    await expect(input).toHaveValue('2026-09-17T14:00');
    const before = await snapshot(page);
    await page.evaluate(() => {
      const original = Storage.prototype.setItem;
      Object.assign(window, { expiryWrites: 0 });
      Storage.prototype.setItem = function (key, value) {
        if (key.startsWith('lineops.expiry.')) {
          const target = window as unknown as { expiryWrites: number }; target.expiryWrites++;
        }
        original.call(this, key, value);
      };
    });
    await input.fill('2026-09-17T16:00');
    await page.getByLabel('Opérateur', { exact: true }).fill('Fixture');
    await page.getByLabel('Commentaire', { exact: true }).fill('Brouillon conservé');
    await page.getByRole('button', { name: kind === 'replacement' ? 'Valider le remplacement' : 'Tracer la recharge', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('future');
    await expect(input).toHaveValue('2026-09-17T16:00');
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Commentaire', { exact: true })).toHaveValue('Brouillon conservé');
    expect(await snapshot(page)).toEqual(before);
    expect(await page.evaluate(() => (window as unknown as { expiryWrites: number }).expiryWrites)).toBe(0);
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(page.getByRole('dialog')).toBeVisible();
    expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });

  test('T02: nonexistent wall time is rejected; repeated time needs an explicit occurrence', async ({ page }) => {
    await seedAt(page, '2026-10-23T00:00:00.000Z', '2026-10-28T00:00:00.000Z');
    await openExpiry(page, '2026-10-25T02:00:30.000Z');
    await page.getByRole('button', { name: 'Déclarer un remplacement', exact: true }).click();
    const input = page.getByLabel('Date / heure du remplacement');
    const before = await snapshot(page);
    await input.fill('2026-03-29T02:30');
    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(page.getByRole('alert')).toContainText('n’existe pas');
    expect(await snapshot(page)).toEqual(before);
    await input.fill('2026-10-25T02:30');
    const occurrence = page.getByLabel('Occurrence de l’heure répétée');
    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(occurrence).toBeFocused();
    await expect(occurrence).toHaveValue('');
    expect(await snapshot(page)).toEqual(before);
    await expect(page.getByText(/Fuseau de saisie/)).toContainText('Europe/Paris');
    await occurrence.selectOption('later');
    await page.getByLabel('Opérateur', { exact: true }).fill('Fixture');
    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const values = await snapshot(page);
    const history = JSON.parse(values[1]!) as { changedAt: string }[];
    expect(history[0].changedAt).toBe('2026-10-25T01:30:00.000Z');
  });

  test('T05/T16: future legacy installation remains visible and unmodified', async ({ page }) => {
    await seedAt(page, '2026-09-18T12:00:00.000Z', '2026-09-23T12:00:00.000Z');
    await openExpiry(page);
    await expect(page.getByText(/état temporel incohérent ou incomplet/i)).toBeVisible();
    await expect(page.getByText(/Démarrage de la ligne autorisé/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Déclarer un remplacement', exact: true })).toBeDisabled();
    const lines = JSON.parse((await snapshot(page))[0]!) as { elements: { lastChangedAt: string }[] }[];
    expect(lines[0].elements[0].lastChangedAt).toBe('2026-09-18T12:00:00.000Z');
  });
});

test.describe('Unknown Expiry states stay readable and conservative', () => {
  test.use({ timezoneId: 'Europe/Paris' });
  for (const state of ['future', 'invalid-calendar', 'missing-block'] as const) {
    test(`T05/T42/T43: ${state} preserves data and accessible layout`, async ({ page }) => {
      await page.addInitScript(({ state, now }) => {
        const block = { type: 'fillingBlock', label: 'Bloc', validityDays: 5, operator: 'Fixture',
          lastChangedAt: state === 'future' ? '2026-09-18T12:00:00.000Z' : '2026-09-15T12:00:00.000Z',
          expiresAt: state === 'invalid-calendar' ? '2026-02-30T12:00:00.000Z' : '2026-09-23T12:00:00.000Z' };
        localStorage.setItem('lineops.expiry.lines.v8', JSON.stringify([{ id: 'a', name: 'Ligne de conditionnement A',
          vat: 'Cuve 1', product: 'Fixture', conditioningStartedAt: now, elements: state === 'missing-block' ? [] : [block] }]));
        localStorage.setItem('lineops.expiry.history.v8', JSON.stringify([
          { id: 'old-block', lineId: 'a', lineName: 'Ligne de conditionnement A', elementLabel: 'Bloc de remplissage',
            changedAt: '2026-09-01T12:00:00.000Z', newExpiresAt: '2026-09-06T12:00:00.000Z', operator: 'Fixture' },
          { id: 'old-refill', lineId: 'a', lineName: 'Ligne de conditionnement A', elementLabel: 'Recharge de cuve',
            changedAt: '2026-09-02T12:00:00.000Z', newExpiresAt: '2026-09-06T12:00:00.000Z', operator: 'Fixture' },
        ]));
      }, { state, now: NOW });
      await openExpiry(page);
      const before = await snapshot(page);
      await expect(page.getByText('Aucune recharge tracée sur ce bloc.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Déclarer un remplacement', exact: true })).toBeDisabled();
      await expect(page.getByText(/Démarrage de la ligne autorisé/)).toHaveCount(0);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
      expect(await snapshot(page)).toEqual(before);
    });
  }
});

test('T42: keyboard reaches every declaration control and scrolls the dialog without a mutation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await openExpiry(page);
  const before = await snapshot(page);
  const trigger = page.getByRole('button', { name: 'Déclarer un remplacement', exact: true });
  // Start this keyboard journey on its invoking control. A pointer click does
  // not establish the same preceding focus across engines, notably WebKit.
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Déclarer un remplacement', exact: true });
  const close = dialog.getByRole('button', { name: 'Fermer', exact: true });
  const region = dialog.getByRole('region', { name: 'Déclarer un remplacement', exact: true });
  const cancel = dialog.getByRole('button', { name: 'Annuler', exact: true });
  await expect(close).toBeFocused();
  await expect(region).toHaveAttribute('tabindex', '0');
  expect(await region.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  // ACT 0ssw9k permits the scroller OR its descendant in sequential navigation.
  // Native datetime controls have engine-specific internal tab stops, and some
  // engines reach the fields before the container. Exercise actual keys only:
  // no element.focus(), clicks, synthetic key events or programmatic scrolling.
  const visited = new Set<string>();
  for (let step = 0; step < 24; step += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    const name = await page.evaluate(() => document.activeElement?.getAttribute('name'));
    if (name) visited.add(name);
    if (await cancel.evaluate((element) => element === document.activeElement)) break;
  }
  expect([...visited]).toEqual(expect.arrayContaining(['changedAt', 'operator', 'comment']));
  await expect(cancel).toBeFocused();
  await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const beforePageUp = await region.evaluate((element) => element.scrollTop);
  await page.keyboard.press('PageUp');
  await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeLessThan(beforePageUp);
  const afterPageUp = await region.evaluate((element) => element.scrollTop);
  await page.keyboard.press('PageDown');
  await expect.poll(() => region.evaluate((element) => element.scrollTop)).toBeGreaterThan(afterPageUp);
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Valider le remplacement', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await snapshot(page)).toEqual(before);
});


test.describe('PR-04 live Expiry refresh', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('T07: visibility and focus refresh all time-derived indicators without rewriting storage', async ({ page }) => {
    await seedAt(page, '2026-09-15T12:00:00.000Z', '2026-09-19T13:00:30.000Z');
    await openExpiry(page, '2026-09-17T12:00:30.000Z');
    const before = await snapshot(page);
    await expect(page.getByText(/Démarrage de la ligne autorisé/)).toBeVisible();

    await page.clock.setFixedTime(new Date('2026-09-17T13:00:30.000Z'));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(page.getByText(/Vigilance — bloc de remplissage/)).toBeVisible();
    await expect(page.getByText('Bientôt expiré').first()).toBeVisible();

    await page.clock.setFixedTime(new Date('2026-09-19T13:00:30.000Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByText(/démarrage non conforme/i)).toBeVisible();
    await expect(page.getByText('Expiré').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ajouter une recharge de cuve' })).toBeDisabled();
    expect(await snapshot(page)).toEqual(before);
  });
});

test.describe('PR-06 Expiry aggregate migration and atomic write', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('T14: v8 migration is idempotent and preserves both source keys', async ({ page }) => {
    await seedAt(page, '2026-09-15T12:00:00.000Z', '2026-09-20T12:00:00.000Z');
    await openExpiry(page);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), AGGREGATE_KEY)).not.toBeNull();
    const sources = await sourceSnapshot(page);
    const aggregate = await page.evaluate((key) => localStorage.getItem(key), AGGREGATE_KEY);
    const parsed = JSON.parse(aggregate!) as { schemaVersion: number; lines: unknown; history: unknown };
    expect(parsed.schemaVersion).toBe(1);
    expect(JSON.stringify(parsed.lines)).toBe(sources[0]);
    expect(JSON.stringify(parsed.history)).toBe(sources[1]);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Expiry Check', exact: true })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), AGGREGATE_KEY)).toBe(aggregate);
    expect(await sourceSnapshot(page)).toEqual(sources);
  });

  test('T13/T21/T42: failed declaration writes neither state nor trace; retry commits the same operation once', async ({ page }) => {
    await seedAt(page, '2026-09-15T12:00:00.000Z', '2026-09-20T12:00:00.000Z');
    await openExpiry(page);
    await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), AGGREGATE_KEY)).not.toBeNull();
    const before = await snapshot(page);
    const sources = await sourceSnapshot(page);

    await page.getByRole('button', { name: 'Déclarer un remplacement', exact: true }).click();
    await page.getByLabel('Opérateur', { exact: true }).fill('Fixture retry');
    await page.getByLabel('Commentaire', { exact: true }).fill('Brouillon atomique');
    await page.evaluate((aggregateKey) => {
      const original = Storage.prototype.setItem;
      let fail = true;
      Storage.prototype.setItem = function (key, value) {
        if (key === aggregateKey && fail) {
          fail = false;
          throw new DOMException('Full', 'QuotaExceededError');
        }
        return original.call(this, key, value);
      };
    }, AGGREGATE_KEY);

    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(page.getByRole('alert')).toContainText(/quota/i);
    await expect(page.getByLabel('Commentaire', { exact: true })).toHaveValue('Brouillon atomique');
    expect(await snapshot(page)).toEqual(before);
    expect(await sourceSnapshot(page)).toEqual(sources);

    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const after = await snapshot(page);
    const lines = JSON.parse(after[0]!) as { elements: { operator: string }[] }[];
    const history = JSON.parse(after[1]!) as { operator: string; id: string }[];
    expect(lines[0].elements[0].operator).toBe('Fixture retry');
    expect(history.filter((entry) => entry.operator === 'Fixture retry')).toHaveLength(1);
    expect(await sourceSnapshot(page)).toEqual(sources);
  });

  test('T15/T16/T42: future versions are read-only and orphan evidence remains raw and accessible', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lineops.expiry.lines.v8', JSON.stringify([{
        id: 'a', name: 'Ligne A', vat: 'Cuve 1', product: 'Fixture',
        conditioningStartedAt: '2026-09-15T12:00:00.000Z',
        elements: [{ type: 'fillingBlock', label: 'Bloc', lastChangedAt: '2026-09-15T12:00:00.000Z',
          expiresAt: '2026-09-20T12:00:00.000Z', validityDays: 5, operator: 'Fixture' }],
      }]));
      localStorage.setItem('lineops.expiry.history.v8', JSON.stringify([{
        id: 'orphan', lineId: 'missing-line', lineName: 'Ligne disparue', elementLabel: 'Bloc de remplissage',
        changedAt: 'date-inconnue', newExpiresAt: 'date-inconnue', operator: 'Archive',
      }]));
      localStorage.setItem('lineops.expiry.aggregate.v2', JSON.stringify({ schemaVersion: 2, future: true }));
    });
    await openExpiry(page);
    await expect(page.getByRole('alert')).toContainText(/lecture seule/i);
    await expect(page.getByText(/Traces orphelines/)).toBeVisible();
    await expect(page.getByText('date-inconnue')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Déclarer un remplacement', exact: true })).toBeDisabled();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => localStorage.getItem('lineops.expiry.aggregate.v1'))).toBeNull();
  });
});
