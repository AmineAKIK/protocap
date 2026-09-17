import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const LINES_KEY = 'lineops.expiry.lines.v8';
const HISTORY_KEY = 'lineops.expiry.history.v8';
const NOW = '2026-09-17T12:00:30.000Z';
async function openExpiry(page: Page, now = NOW) {
  await page.clock.setFixedTime(new Date(now));
  await page.goto('/expiry-check');
  await expect(page.getByRole('heading', { name: 'Expiry Check', exact: true })).toBeVisible();
}
async function snapshot(page: Page) {
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
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([]);
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
    await expect(page.getByText('État à vérifier').first()).toBeVisible();
    await expect(page.getByText(/état temporel incohérent ou incomplet/i)).toBeVisible();
    await expect(page.getByText(/Démarrage de la ligne autorisé/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Déclarer un remplacement', exact: true })).toBeDisabled();
    const lines = JSON.parse((await snapshot(page))[0]!) as { elements: { lastChangedAt: string }[] }[];
    expect(lines[0].elements[0].lastChangedAt).toBe('2026-09-18T12:00:00.000Z');
  });
});
