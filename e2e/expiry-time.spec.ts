import { expect, test } from '@playwright/test';

const LINES_KEY = 'lineops.expiry.lines.v8';
const HISTORY_KEY = 'lineops.expiry.history.v8';

async function openExpiry(page: import('@playwright/test').Page) {
  await page.goto('/expiry-check');
  await expect(page.getByRole('heading', { name: 'Expiry Check' })).toBeVisible();
}

test.describe('Expiry temporal contract', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test('T01/T04: local prefill is not UTC and a future replacement preserves state and draft', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('lineops.expiry.lines.v8');
      localStorage.removeItem('lineops.expiry.history.v8');
    });
    await openExpiry(page);
    const before = await page.evaluate(([linesKey, historyKey]) => [localStorage.getItem(linesKey), localStorage.getItem(historyKey)], [LINES_KEY, HISTORY_KEY]);
    await page.getByRole('button', { name: /Déclarer un remplacement|Remplacer le bloc/ }).first().click();
    const input = page.getByLabel('Date / heure du remplacement');
    const localNow = await input.inputValue();
    const observed = await page.evaluate(() => {
      const date = new Date();
      const pad = (value: number) => String(value).padStart(2, '0');
      return { local: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`, utc: date.toISOString().slice(0, 16) };
    });
    expect(localNow).toBe(observed.local);
    expect(localNow).not.toBe(observed.utc);
    const future = await page.evaluate(() => {
      const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const pad = (value: number) => String(value).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    });
    await input.fill(future);
    await page.getByLabel('Commentaire').fill('Brouillon futur conservé');
    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(page.getByRole('alert')).toContainText('futur');
    expect(await input.inputValue()).toBe(future);
    expect(await page.getByLabel('Commentaire').inputValue()).toBe('Brouillon futur conservé');
    expect(await page.evaluate(([linesKey, historyKey]) => [localStorage.getItem(linesKey), localStorage.getItem(historyKey)], [LINES_KEY, HISTORY_KEY])).toEqual(before);
  });

  test('T02/T42: nonexistent and repeated wall times are explicit', async ({ page }) => {
    await openExpiry(page);
    await page.getByRole('button', { name: /Déclarer un remplacement|Remplacer le bloc/ }).first().click();
    const input = page.getByLabel('Date / heure du remplacement');
    await input.fill('2026-03-29T02:30');
    await page.getByRole('button', { name: 'Valider le remplacement' }).click();
    await expect(page.getByRole('alert')).toContainText('n’existe pas');
    await input.fill('2026-10-25T02:30');
    const occurrence = page.getByLabel('Occurrence de l’heure répétée');
    await expect(occurrence).toBeVisible();
    await expect(occurrence).toHaveValue('');
    await expect(page.getByText(/Fuseau : Europe\/Paris/)).toBeVisible();
  });

  test('T05/T16: future legacy installation is visible and never green', async ({ page }) => {
    await page.addInitScript(({ key }) => {
      const now = Date.now();
      localStorage.setItem(key, JSON.stringify([{ id: 'future', name: 'Ligne future', vat: 'Cuve X', product: 'Fixture synthétique', conditioningStartedAt: new Date(now).toISOString(), elements: [{ type: 'fillingBlock', label: 'Bloc', lastChangedAt: new Date(now + 3_600_000).toISOString(), expiresAt: new Date(now + 5 * 86_400_000).toISOString(), validityDays: 5, operator: 'Fixture' }] }]));
    }, { key: LINES_KEY });
    await openExpiry(page);
    await expect(page.getByText('État à vérifier').first()).toBeVisible();
    await expect(page.getByText(/état temporel incohérent ou incomplet/i).first()).toBeVisible();
    await expect(page.getByText('Démarrage de la ligne autorisé')).toHaveCount(0);
  });
});
