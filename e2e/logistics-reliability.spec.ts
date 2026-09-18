import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const KEY = 'lineops.logistics.requests.v8';

async function open(page: import('@playwright/test').Page) {
  await page.goto('/logistics-call');
  await expect(page.getByRole('heading', { name: 'Logistics Call' })).toBeVisible();
}

test.describe('PR-07 Logistics reliable persistence', () => {
  test('T11/T12/T42: failed creation preserves draft and retry confirms exactly one request', async ({ page }) => {
    await open(page);
    await page.getByLabel('Zone de ligne').fill('Zone retry');
    await page.getByLabel('Palettes').fill('3');
    await page.getByLabel('Commentaire').fill('Brouillon navigateur');
    const before = await page.evaluate((key) => localStorage.getItem(key), KEY);

    await page.evaluate((key) => {
      const original = Storage.prototype.setItem;
      Object.assign(window, { logisticsFailOnce: true });
      Storage.prototype.setItem = function (storedKey, value) {
        const target = window as unknown as { logisticsFailOnce: boolean };
        if (storedKey === key && target.logisticsFailOnce) {
          target.logisticsFailOnce = false;
          throw new DOMException('Full', 'QuotaExceededError');
        }
        return original.call(this, storedKey, value);
      };
    }, KEY);

    await page.getByRole('button', { name: "Enregistrer l'appel logistique" }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('quota');
    await expect(alert).toBeFocused();
    await expect(page.getByLabel('Zone de ligne')).toHaveValue('Zone retry');
    await expect(page.getByLabel('Palettes')).toHaveValue('3');
    await expect(page.getByLabel('Commentaire')).toHaveValue('Brouillon navigateur');
    expect(await page.evaluate((key) => localStorage.getItem(key), KEY)).toBe(before);
    await expect(page.getByText(/enregistré localement/)).toHaveCount(0);

    await page.getByRole('button', { name: "Enregistrer l'appel logistique" }).click();
    await expect(page.getByText(/enregistré localement/)).toBeVisible();
    const stored = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY))!) as { zone: string; comment?: string }[];
    expect(stored.filter((request) => request.zone === 'Zone retry' && request.comment === 'Brouillon navigateur')).toHaveLength(1);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });

  test('T20: missing historical closure stays unknown and causes no repair write', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify([{
        id: 'LOG-250', line: 'Ligne de conditionnement A', zone: 'Sortie', palletCount: 1,
        priority: 'normal', nature: 'Palette', createdAt: '2026-09-18T08:00:00.000Z', status: 'pickedUp',
      }]));
      const original = Storage.prototype.setItem;
      Object.assign(window, { logisticsWrites: 0 });
      Storage.prototype.setItem = function (storedKey, value) {
        if (storedKey === key) (window as unknown as { logisticsWrites: number }).logisticsWrites += 1;
        return original.call(this, storedKey, value);
      };
    }, KEY);
    await open(page);
    const boardTab = page.getByRole('button', { name: /Board logistique/ });
    if (await boardTab.isVisible()) await boardTab.click();
    await page.getByText(/Terminées \/ Annulées/).click();
    await expect(page.getByText('Clôture : heure inconnue')).toBeVisible();
    await expect(page.getByText('Durée inconnue')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { logisticsWrites: number }).logisticsWrites)).toBe(0);
  });

  test('T22/T42/T43: cancellation is confirmed and terminal without horizontal overflow', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, JSON.stringify([{
        id: 'LOG-251', line: 'Ligne de conditionnement A', zone: 'Sortie', palletCount: 1,
        priority: 'normal', nature: 'Palette', createdAt: '2026-09-18T08:00:00.000Z', status: 'waiting',
      }]));
    }, KEY);
    await open(page);
    const boardTab = page.getByRole('button', { name: /Board logistique/ });
    if (await boardTab.isVisible()) await boardTab.click();
    await page.getByRole('button', { name: 'Annuler' }).click();
    const dialog = page.getByRole('dialog', { name: 'Confirmer l’annulation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Confirmer l’annulation' })).toBeVisible();
    expect((await new AxeBuilder({ page }).include('dialog[open]').analyze()).violations).toEqual([]);
    await dialog.getByRole('button', { name: 'Confirmer l’annulation' }).click();
    const stored = JSON.parse((await page.evaluate((key) => localStorage.getItem(key), KEY))!) as { status: string; completedAt?: string }[];
    expect(stored[0].status).toBe('cancelled');
    expect(stored[0].completedAt).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });
});
