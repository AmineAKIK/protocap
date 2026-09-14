import { expect, test, type Page } from '@playwright/test';

async function configurePacking(page: Page, quantity = '30880') {
  await page.goto('/packing-calculator');
  await page.getByLabel('Quantité demandée en unités').fill(quantity);
  await page.getByLabel('Unités par carton').fill('128');
  await page.getByLabel('Cartons par palette').fill('40');
  await page.getByRole('radio', { name: /Carton/i }).click();
  await page.getByLabel('Cadence de référence en unités par minute').fill('60');
  await page.getByRole('button', { name: 'Activer ce run' }).click();

  await expect(page.getByRole('heading', { name: 'Découpage final sélectionné' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Déclarations de production', exact: true })).toBeVisible();
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
  const businessNumbers = page.locator('.tabular-nums');
  expect(await businessNumbers.count()).toBeGreaterThan(0);
  const unreadable = await businessNumbers.evaluateAll((elements) =>
    elements
      .map((element) => {
        const node = element as HTMLElement;
        const style = getComputedStyle(node);
        return {
          text: node.textContent?.trim() ?? '',
          textOverflow: style.textOverflow,
          scrollWidth: node.scrollWidth,
          clientWidth: node.clientWidth,
        };
      })
      .filter((entry) => entry.text && (entry.textOverflow === 'ellipsis' || entry.scrollWidth > entry.clientWidth + 1)),
  );
  expect(unreadable).toEqual([]);
}

test.describe('Packing Calculator operator declaration flow', () => {
  test('declares full and partial production with exact history', async ({ page }) => {
    await configurePacking(page);
    const execution = page.getByRole('region', { name: 'Déclarations de production', exact: true });

    await execution.getByRole('button', { name: 'Déclarer une charge' }).click();
    await expect(execution).toContainText(/5\s120 unités déclarées produites/);

    await execution.getByLabel('Cartons complets à déclarer').fill('10');
    await execution.getByLabel('Unités du carton partiel à déclarer').fill('120');
    await expect(execution).toContainText(/1\s400 unités/);
    await execution.getByRole('button', { name: 'Déclarer ce volume' }).click();

    await expect(execution).toContainText('2 déclarations');
    await expect(execution.getByRole('list', { name: 'Historique des déclarations' })).toBeVisible();
  });

  test('supports correction and removal by declaration identity', async ({ page }) => {
    await configurePacking(page);
    const execution = page.getByRole('region', { name: 'Déclarations de production', exact: true });
    await execution.getByRole('button', { name: 'Déclarer une charge' }).click();

    await execution.getByRole('button', { name: 'Corriger la déclaration 1' }).click();
    await execution.getByLabel('Cartons complets à déclarer').fill('10');
    await execution.getByRole('button', { name: 'Enregistrer la correction' }).click();
    await expect(execution).toContainText(/1\s280 unités/);

    await execution.getByRole('button', { name: 'Supprimer la déclaration 1' }).click();
    await expect(execution).toContainText('0 déclaration');
  });

  test('keeps keyboard strategy selection usable before activation', async ({ page }) => {
    await page.goto('/packing-calculator');
    await page.getByLabel('Quantité demandée en unités').fill('30880');
    await page.getByLabel('Unités par carton').fill('128');
    await page.getByLabel('Cartons par palette').fill('40');

    const strategyGroup = page.getByRole('radiogroup', { name: 'Politique opérationnelle' });
    const exact = strategyGroup.getByRole('radio', { name: /Exact/i });
    await exact.focus();
    await page.keyboard.press('Space');
    await expect(exact).toHaveAttribute('aria-checked', 'true');
  });

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844, split: false },
    { name: 'tablet', width: 768, height: 1024, split: false },
    { name: 'small-desktop', width: 1024, height: 768, split: false },
    { name: 'workshop', width: 1366, height: 768, split: true },
    { name: 'large-workshop', width: 1920, height: 1080, split: true },
  ]) {
    test(`${viewport.name} ${viewport.width}x${viewport.height} stays readable and keeps the declaration action usable`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await configurePacking(page);

      await expectNoHorizontalOverflow(page);
      await expectBusinessNumbersReadable(page);

      const referenceBox = await page.getByRole('region', { name: 'Référence et résultat exact' }).boundingBox();
      const operationsBox = await page.getByRole('region', { name: 'Plan actif et déclarations de production' }).boundingBox();
      expect(referenceBox).not.toBeNull();
      expect(operationsBox).not.toBeNull();

      if (viewport.split) {
        expect(operationsBox!.x).toBeGreaterThan(referenceBox!.x + referenceBox!.width - 2);
        expect(Math.abs(operationsBox!.y - referenceBox!.y)).toBeLessThan(8);
      } else {
        expect(Math.abs(operationsBox!.x - referenceBox!.x)).toBeLessThan(8);
        expect(operationsBox!.y).toBeGreaterThan(referenceBox!.y + referenceBox!.height - 2);
      }

      const primaryAction = page.getByRole('button', { name: 'Déclarer une charge' });
      await primaryAction.scrollIntoViewIfNeeded();
      await expect(primaryAction).toBeVisible();
      const actionBox = await primaryAction.boundingBox();
      expect(actionBox).not.toBeNull();
      expect(actionBox!.height).toBeGreaterThanOrEqual(56);
    });
  }
});
