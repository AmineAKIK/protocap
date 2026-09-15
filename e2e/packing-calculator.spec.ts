import { expect, test, type Page } from '@playwright/test';

const productionStart = '2026-09-15T07:30';

async function fillPackingPreparation(page: Page, quantity = '30880') {
  await page.goto('/packing-calculator');
  await page.getByLabel('Quantité demandée').fill(quantity);
  await page.getByLabel('Unités par carton').fill('128');
  await page.getByLabel('Cartons par palette').fill('40');
  await page.getByRole('textbox', { name: 'Début OC' }).fill(productionStart);
  await page.getByLabel('Cadence réf.').fill('60');
}

async function configurePacking(page: Page, quantity = '30880') {
  await fillPackingPreparation(page, quantity);
  await page.getByRole('radiogroup', { name: 'Stratégie de conditionnement' }).getByRole('radio', { name: /Carton complet/i }).click();
  await page.getByRole('button', { name: 'Lancer le suivi de production' }).click();
  await expect(page.getByRole('heading', { name: 'Conduite de production' })).toBeVisible();
  await expect(page.getByLabel('Historique des déclarations')).toBeVisible();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
}

async function expectBusinessNumbersReadable(page: Page) {
  const businessNumbers = page.locator('.packing-v3-primary-kpis strong, .packing-v3-time-kpis strong, .packing-v3-history-total strong');
  expect(await businessNumbers.count()).toBeGreaterThan(0);
  const unreadable = await businessNumbers.evaluateAll((elements) => elements.map((element) => {
    const node = element as HTMLElement;
    const style = getComputedStyle(node);
    return { text: node.textContent?.trim() ?? '', textOverflow: style.textOverflow, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
  }).filter((entry) => entry.text && (entry.textOverflow === 'ellipsis' || entry.scrollWidth > entry.clientWidth + 1)));
  expect(unreadable).toEqual([]);
}

test.describe('Packing Calculator operator declaration flow', () => {
  test('waits for a launch attempt before exposing preparation errors and keeps fields aligned', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/packing-calculator');
    const launch = page.getByRole('button', { name: 'Lancer le suivi de production' });
    const quantity = page.getByLabel('Quantité demandée');

    await expect(launch).toBeEnabled();
    await expect(page.getByText(/À compléter :/)).toHaveCount(0);
    await expect(page.getByText('Valeur obligatoire.')).toHaveCount(0);

    await quantity.focus();
    await page.getByLabel('Unités par carton').focus();
    await expect(page.getByText('Valeur obligatoire.')).toHaveCount(0);
    await expect(quantity).toHaveAttribute('aria-invalid', 'false');

    const before = await page.locator('.packing-v3-field-control').evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    );

    await launch.click();

    await expect(page.getByText('Valeur obligatoire.')).toHaveCount(5);
    await expect(page.getByText(/À compléter : Quantité demandée/)).toBeVisible();
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
    await expect(quantity).toBeFocused();

    const after = await page.locator('.packing-v3-field-control').evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    );
    expect(after).toEqual(before);
  });

  test('does not silently rewrite invalid numeric input or surface it before launch', async ({ page }) => {
    await page.goto('/packing-calculator');
    const quantity = page.getByLabel('Quantité demandée');
    await quantity.fill('12.5');
    await page.getByLabel('Unités par carton').focus();
    await expect(quantity).toHaveValue('12.5');
    await expect(quantity).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByText('Saisissez un entier supérieur à 0.')).toHaveCount(0);

    await page.getByRole('button', { name: 'Lancer le suivi de production' }).click();
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Saisissez un entier supérieur à 0.')).toBeVisible();
  });

  test('protects reset and keeps cancellation non-destructive', async ({ page }) => {
    await fillPackingPreparation(page);
    await page.getByRole('radiogroup', { name: 'Stratégie de conditionnement' }).getByRole('radio', { name: /Carton complet/i }).click();

    const reset = page.getByRole('button', { name: 'Réinitialiser la préparation' });
    await reset.click();
    const dialog = page.getByRole('dialog', { name: 'Réinitialiser la préparation ?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Annuler' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Annuler' }).click();
    await expect(page.getByLabel('Quantité demandée')).toHaveValue('30880');
    await expect(reset).toBeFocused();

    await reset.click();
    await page.getByRole('dialog', { name: 'Réinitialiser la préparation ?' }).getByRole('button', { name: 'Réinitialiser' }).click();
    await expect(page.getByLabel('Quantité demandée')).toHaveValue('');
    await expect(reset).toBeDisabled();
  });

  test('declares full and partial production with exact history', async ({ page }) => {
    await configurePacking(page);
    const execution = page.locator('.packing-v3-production');
    await execution.getByRole('button', { name: /Déclarer une palette complète/i }).click();
    await expect(execution.getByRole('status')).toContainText(/5\s?120 unités déclarées/);
    await execution.getByLabel('Cartons complets', { exact: true }).fill('10');
    await execution.getByLabel('Unités dans le carton incomplet', { exact: true }).fill('120');
    await expect(execution.locator('.packing-v3-partial')).toContainText(/1\s?400 unités/);
    await execution.getByRole('button', { name: /Enregistrer la palette partielle/i }).click();
    const history = page.getByLabel('Historique des déclarations');
    await expect(history).toContainText('2 déclarations');
    await expect(history).toContainText('Palette complète');
    await expect(history).toContainText('Palette partielle');
  });

  test('supports correction and removal by declaration identity', async ({ page }) => {
    await configurePacking(page);
    const execution = page.locator('.packing-v3-production');
    const history = page.getByLabel('Historique des déclarations');
    await execution.getByRole('button', { name: /Déclarer une palette complète/i }).click();
    await history.getByRole('button', { name: /Corriger la déclaration/i }).click();
    await execution.getByLabel('Cartons complets', { exact: true }).fill('10');
    await execution.getByRole('button', { name: /Enregistrer la correction/i }).click();
    await expect(history).toContainText(/1\s?280 unités/);
    await history.getByRole('button', { name: /Supprimer la déclaration/i }).click();
    await expect(history).toContainText('Aucune production déclarée pour le moment.');
  });

  test('supports keyboard strategy selection and arrow navigation before activation', async ({ page }) => {
    await fillPackingPreparation(page);
    const group = page.getByRole('radiogroup', { name: 'Stratégie de conditionnement' });
    const exact = group.getByRole('radio', { name: /Sans dépassement/i });
    await exact.focus();
    await page.keyboard.press('Space');
    await expect(exact).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('ArrowRight');
    const carton = group.getByRole('radio', { name: /Carton complet/i });
    await expect(carton).toHaveAttribute('aria-checked', 'true');
    await expect(carton).toBeFocused();
  });

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844, split: false },
    { name: 'tablet', width: 768, height: 1024, split: false },
    { name: 'small-desktop', width: 1024, height: 768, split: true },
    { name: 'workshop', width: 1366, height: 768, split: true },
    { name: 'large-workshop', width: 1920, height: 1080, split: true },
  ]) {
    test(`${viewport.name} ${viewport.width}x${viewport.height} stays readable and keeps the declaration action usable`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await configurePacking(page);
      await expectNoHorizontalOverflow(page);
      await expectBusinessNumbersReadable(page);
      const operationsBox = await page.locator('.packing-v3-production-main').boundingBox();
      const historyBox = await page.locator('.packing-v3-history').boundingBox();
      expect(operationsBox).not.toBeNull();
      expect(historyBox).not.toBeNull();
      if (viewport.split) {
        expect(historyBox!.x).toBeGreaterThan(operationsBox!.x + operationsBox!.width - 2);
        expect(Math.abs(historyBox!.y - operationsBox!.y)).toBeLessThan(8);
      } else {
        expect(Math.abs(historyBox!.x - operationsBox!.x)).toBeLessThan(8);
        expect(historyBox!.y).toBeGreaterThan(operationsBox!.y + operationsBox!.height - 2);
      }
      const primaryAction = page.getByRole('button', { name: /Déclarer une palette complète/i });
      await primaryAction.scrollIntoViewIfNeeded();
      await expect(primaryAction).toBeVisible();
      const actionBox = await primaryAction.boundingBox();
      expect(actionBox).not.toBeNull();
      expect(actionBox!.height).toBeGreaterThanOrEqual(44);
    });
  }
});