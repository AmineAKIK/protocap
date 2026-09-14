import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  RESPONSIVE_VIEWPORTS,
  expectNoDocumentHorizontalOverflow,
  expectPrimaryActionUsable,
  useViewport,
} from './responsive-harness';

const PACKING_VIEWPORTS = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phoneLandscape,
  RESPONSIVE_VIEWPORTS.tabletLandscape,
  RESPONSIVE_VIEWPORTS.laptopCompact,
  RESPONSIVE_VIEWPORTS.laptop,
] as const;

async function configurePacking(page: Page) {
  await page.goto('/packing-calculator');
  await page.getByLabel('Quantité demandée en unités').fill('5120000000');
  await page.getByLabel('Unités par carton').fill('128');
  await page.getByLabel('Cartons par palette').fill('40');
  await page.getByRole('radio', { name: /Carton/i }).click();
  await expect(page.getByRole('heading', { name: 'Découpage final sélectionné' })).toBeVisible();
}

async function expectAtomicVisibleNumber(locator: Locator) {
  await expect(locator).toBeVisible();
  const state = await locator.evaluate((node) => {
    const element = node as HTMLElement;
    return {
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      whiteSpace: getComputedStyle(element).whiteSpace,
    };
  });

  expect(state.scrollWidth).toBeLessThanOrEqual(state.width + 1);
  expect(state.whiteSpace).toBe('nowrap');
}

// responsive-contract:packing-responsive-contract
test('Packing dense surface stays contained and changes composition only in the wide regime', async ({ page }) => {
  for (const viewport of PACKING_VIEWPORTS) {
    await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
      await useViewport(page, viewport);
      await configurePacking(page);

      await test.step('document containment and primary action', async () => {
        await expectNoDocumentHorizontalOverflow(page);
        await expectPrimaryActionUsable(
          page,
          page.getByRole('button', { name: 'Déclarer la prochaine charge expédiée' }),
        );
      });

      await test.step('business numbers remain readable and critical outputs stay atomic', async () => {
        const clippedNumbers = await page.locator('.tabular-nums:visible').evaluateAll((nodes) =>
          nodes
            .map((node) => {
              const element = node as HTMLElement;
              return {
                text: element.textContent?.trim() ?? '',
                width: element.clientWidth,
                scrollWidth: element.scrollWidth,
              };
            })
            .filter((entry) => entry.text && entry.scrollWidth > entry.width + 1),
        );
        expect(clippedNumbers).toEqual([]);

        const execution = page.getByRole('region', { name: 'Découpage final et suivi manuel' });
        const shipment = page.getByRole('region', { name: 'Charges à expédier' });
        await expectAtomicVisibleNumber(execution.locator('.tabular-nums').first());
        await expectAtomicVisibleNumber(shipment.locator('.tabular-nums').first());
      });

      await test.step('stacked and wide compositions switch at xl', async () => {
        const reference = page.getByRole('region', { name: 'Référence et résultat exact' });
        const execution = page.getByRole('region', { name: 'Découpage final et suivi manuel' });
        const referenceBox = await reference.boundingBox();
        const executionBox = await execution.boundingBox();

        expect(referenceBox).not.toBeNull();
        expect(executionBox).not.toBeNull();

        if (viewport.width >= 1280) {
          expect(executionBox!.x).toBeGreaterThan(referenceBox!.x + referenceBox!.width - 2);
          expect(Math.abs(executionBox!.y - referenceBox!.y)).toBeLessThan(8);
        } else {
          expect(Math.abs(executionBox!.x - referenceBox!.x)).toBeLessThan(8);
          expect(executionBox!.y).toBeGreaterThan(referenceBox!.y + referenceBox!.height - 2);
        }
      });
    });
  }
});
