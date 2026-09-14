import { expect, test, type Page } from '@playwright/test';
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

test('Packing dense surface stays contained and changes composition only in the wide regime', async ({ page }) => {
  for (const viewport of PACKING_VIEWPORTS) {
    await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
      await useViewport(page, viewport);
      await configurePacking(page);

      await expectNoDocumentHorizontalOverflow(page);

      const primaryAction = page.getByRole('button', { name: 'Déclarer la prochaine charge expédiée' });
      await expectPrimaryActionUsable(page, primaryAction);

      const numbers = page.locator('.tabular-nums');
      const clippedNumbers = await numbers.evaluateAll((nodes) =>
        nodes
          .map((node) => {
            const element = node as HTMLElement;
            return {
              text: element.textContent?.trim() ?? '',
              width: element.clientWidth,
              scrollWidth: element.scrollWidth,
              whiteSpace: getComputedStyle(element).whiteSpace,
            };
          })
          .filter((entry) => entry.text && (entry.scrollWidth > entry.width + 1 || entry.whiteSpace !== 'nowrap')),
      );
      expect(clippedNumbers).toEqual([]);

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
  }
});
