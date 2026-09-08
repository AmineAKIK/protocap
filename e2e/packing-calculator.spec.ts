import { expect, test, type Page } from '@playwright/test';

async function configurePacking(page: Page, quantity = '30880') {
  await page.goto('/packing-calculator');
  await page.getByLabel('Quantité demandée en unités').fill(quantity);
  await page.getByLabel('Unités par carton').fill('128');
  await page.getByLabel('Cartons par palette').fill('40');
  await page.getByRole('radio', { name: /Carton/i }).click();

  await expect(page.getByRole('heading', { name: 'Découpage final sélectionné' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Charges à expédier' })).toBeVisible();
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

test.describe('Packing Calculator premium workshop hardening', () => {
  test('keeps the core packing workflow operable and precise', async ({ page }) => {
    await configurePacking(page);

    const strategyGroup = page.getByRole('radiogroup', { name: 'Politique opérationnelle' });
    await expect(strategyGroup.getByRole('radio', { name: /Carton/i })).toHaveAttribute('aria-checked', 'true');
    await expect(strategyGroup).toContainText('+96 unités');

    const shipment = page.getByRole('region', { name: 'Charges à expédier' });
    await expect(shipment).toContainText('7');
    await expect(shipment).toContainText('0 / 7 charges expédiées');
    await expect(shipment.getByRole('progressbar', { name: 'Avancement des charges expédiées' })).toHaveAttribute('aria-valuenow', '0');
    await expect(shipment.getByRole('progressbar', { name: "Volume d'unités expédié" })).toHaveAttribute('aria-valuenow', '0');

    for (let load = 0; load < 6; load += 1) {
      await shipment.getByRole('button', { name: 'Déclarer la prochaine charge expédiée' }).click();
    }

    await expect(shipment).toContainText('6 / 7 charges expédiées');
    await expect(shipment).toContainText(/30\s720\s\/\s30\s976/);
    await expect(shipment).toContainText('99,2 %');
    await expect(shipment).toContainText('Charge reliquat');
    await expect(shipment).toContainText('2 cartons · 256 unités');
  });

  test('supports keyboard strategy selection without changing packing behavior', async ({ page }) => {
    await configurePacking(page);

    const strategyGroup = page.getByRole('radiogroup', { name: 'Politique opérationnelle' });
    const exact = strategyGroup.getByRole('radio', { name: /Exact/i });
    const carton = strategyGroup.getByRole('radio', { name: /Carton/i });

    await exact.focus();
    await page.keyboard.press('Space');

    await expect(exact).toHaveAttribute('aria-checked', 'true');
    await expect(carton).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByRole('heading', { name: 'Découpage final sélectionné' })).toBeVisible();
  });

  test('keeps million-scale operational numbers atomic at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await configurePacking(page, '5120000000');

    await expectNoHorizontalOverflow(page);
    await expectBusinessNumbersReadable(page);

    const million = page.getByText('1\u202f000\u202f000', { exact: true }).first();
    await expect(million).toBeVisible();
    expect(await million.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe('nowrap');

    const navLabels = page.locator('nav.fixed span');
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const boxes = await navLabels.evaluateAll((nodes) => nodes.map((node) => {
      const rect = (node as HTMLElement).getBoundingClientRect();
      return { text: node.textContent ?? '', left: rect.left, right: rect.right, overflow: getComputedStyle(node).textOverflow };
    }));
    expect(boxes.every((box) => box.left >= -1 && box.right <= viewportWidth + 1 && box.overflow !== 'ellipsis')).toBe(true);
  });

  test('keeps strategy labels on natural word boundaries at the 2xl transition', async ({ page }) => {
    await page.setViewportSize({ width: 1536, height: 864 });
    await configurePacking(page);

    const strategyGroup = page.getByRole('radiogroup', { name: 'Politique opérationnelle' });
    const labels = strategyGroup.locator('p');
    const wrapping = await labels.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return { text: node.textContent?.trim() ?? '', overflowWrap: style.overflowWrap, wordBreak: style.wordBreak };
    }));

    expect(wrapping.every((entry) => entry.overflowWrap !== 'anywhere' && entry.wordBreak !== 'break-all')).toBe(true);
  });

  for (const viewport of [
    { name: 'mobile', width: 390, height: 844, split: false },
    { name: 'tablet', width: 768, height: 1024, split: false },
    { name: 'small-desktop', width: 1024, height: 768, split: false },
    { name: 'workshop', width: 1366, height: 768, split: true },
    { name: 'large-workshop', width: 1920, height: 1080, split: true },
  ]) {
    test(`${viewport.name} ${viewport.width}x${viewport.height} stays readable and follows the intended composition`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await configurePacking(page);

      await expectNoHorizontalOverflow(page);
      await expectBusinessNumbersReadable(page);

      const referenceBox = await page.getByRole('region', { name: 'Référence et résultat exact' }).boundingBox();
      const operationsBox = await page.getByRole('region', { name: 'Découpage final et suivi manuel' }).boundingBox();
      expect(referenceBox).not.toBeNull();
      expect(operationsBox).not.toBeNull();

      if (viewport.split) {
        expect(operationsBox!.x).toBeGreaterThan(referenceBox!.x + referenceBox!.width - 2);
        expect(Math.abs(operationsBox!.y - referenceBox!.y)).toBeLessThan(8);
      } else {
        expect(Math.abs(operationsBox!.x - referenceBox!.x)).toBeLessThan(8);
        expect(operationsBox!.y).toBeGreaterThan(referenceBox!.y + referenceBox!.height - 2);
      }

      const primaryAction = page.getByRole('button', { name: 'Déclarer la prochaine charge expédiée' });
      await primaryAction.scrollIntoViewIfNeeded();
      await expect(primaryAction).toBeVisible();
      const actionBox = await primaryAction.boundingBox();
      expect(actionBox).not.toBeNull();
      expect(actionBox!.height).toBeGreaterThanOrEqual(56);
    });
  }
});
