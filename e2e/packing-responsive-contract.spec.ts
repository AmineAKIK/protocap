import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  RESPONSIVE_VIEWPORTS,
  expectLocatorInsideViewport,
  expectNoDocumentHorizontalOverflow,
  expectNoDocumentVerticalOverflow,
  expectPrimaryActionUsable,
  useViewport,
} from './responsive-harness';

const PACKING_ACTIVE_RUN_STORAGE_KEY = 'lineops.packing.active-run.v1';

const PACKING_VIEWPORTS = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phoneLandscape,
  RESPONSIVE_VIEWPORTS.tabletLandscape,
  RESPONSIVE_VIEWPORTS.laptopSmall,
  RESPONSIVE_VIEWPORTS.laptopCompact,
  RESPONSIVE_VIEWPORTS.laptop,
] as const;

const PACKING_VIEWPORT_FIT_MATRIX = [
  RESPONSIVE_VIEWPORTS.tabletLandscape,
  RESPONSIVE_VIEWPORTS.laptopSmall,
  RESPONSIVE_VIEWPORTS.laptopCompact,
  RESPONSIVE_VIEWPORTS.laptop,
  RESPONSIVE_VIEWPORTS.desktop,
  RESPONSIVE_VIEWPORTS.desktopLarge,
] as const;

const PACKING_POLISH_VIEWPORTS = [RESPONSIVE_VIEWPORTS.laptop, RESPONSIVE_VIEWPORTS.desktopLarge] as const;

async function configurePacking(page: Page) {
  await page.goto('/packing-calculator');
  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), PACKING_ACTIVE_RUN_STORAGE_KEY);
  await page.reload();
  await page.getByLabel('Quantité demandée en unités').fill('5120000000');
  await page.getByLabel('Unités par carton').fill('128');
  await page.getByLabel('Cartons par palette').fill('40');
  await page.getByRole('radio', { name: /Carton/i }).click();
  await page.getByLabel('Cadence de référence en unités par minute').fill('60');
  await page.getByRole('button', { name: 'Activer ce run' }).click();
  await expect(page.getByRole('heading', { name: 'État de production' })).toBeVisible();
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
test('Packing dense surface stays contained and changes composition only in supported regimes', async ({ page }) => {
  for (const viewport of PACKING_VIEWPORTS) {
    await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
      await useViewport(page, viewport);
      await configurePacking(page);

      await test.step('document containment and primary action', async () => {
        await expectNoDocumentHorizontalOverflow(page);
        await expectPrimaryActionUsable(page, page.getByRole('button', { name: 'Déclarer une charge' }));
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

        const execution = page.getByRole('region', { name: 'Plan actif et déclarations de production' });
        const declarations = page.getByRole('region', { name: 'Déclarations de production', exact: true });
        await expectAtomicVisibleNumber(execution.locator('.tabular-nums').first());
        await expectAtomicVisibleNumber(declarations.locator('.tabular-nums').first());
      });

      await test.step('stacked and cockpit-fit compositions switch by available width and height', async () => {
        const reference = page.getByRole('region', { name: 'Référence et résultat exact' });
        const execution = page.getByRole('region', { name: 'Plan actif et déclarations de production' });
        const referenceBox = await reference.boundingBox();
        const executionBox = await execution.boundingBox();
        expect(referenceBox).not.toBeNull();
        expect(executionBox).not.toBeNull();

        const usesCockpitFit = viewport.width >= 1024 && viewport.height >= 700;
        if (usesCockpitFit) {
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

test('Packing active cockpit fits the target landscape and desktop viewport matrix without document scrolling', async ({ page }) => {
  for (const viewport of PACKING_VIEWPORT_FIT_MATRIX) {
    await test.step(`${viewport.name}: ${viewport.width}x${viewport.height}`, async () => {
      await useViewport(page, viewport);
      await configurePacking(page);

      const cockpit = page.getByRole('region', { name: 'État de production' });
      const primaryAction = page.getByRole('button', { name: 'Déclarer une charge' });

      await expectNoDocumentHorizontalOverflow(page);
      await expectNoDocumentVerticalOverflow(page);
      await expectLocatorInsideViewport(page, cockpit);
      await expectLocatorInsideViewport(page, primaryAction);

      const scrollState = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
      expect(scrollState).toEqual({ x: 0, y: 0 });
    });
  }
});

test('Packing visual hierarchy stays operational at the PR7 reference viewports and respects reduced motion', async ({ page }) => {
  for (const viewport of PACKING_POLISH_VIEWPORTS) {
    await test.step(`${viewport.name}: ${viewport.width}x${viewport.height}`, async () => {
      await useViewport(page, viewport);
      await configurePacking(page);

      const cockpit = page.getByRole('region', { name: 'État de production' });
      const actionPanel = page.locator('.packing-primary-action');
      const progressbar = page.getByRole('progressbar', { name: 'Avancement conditionné' });
      const progressFill = progressbar.locator('.packing-progress-fill');
      const action = page.getByRole('button', { name: 'Déclarer une charge' });

      await expect(cockpit).toBeVisible();
      await expect(actionPanel).toBeVisible();
      await expect(progressbar).toBeVisible();
      await expect(progressbar).toHaveAttribute('aria-valuenow', '0');
      await expect(progressFill).toHaveCount(1);
      await expect(action).toBeVisible();
      await expectNoDocumentHorizontalOverflow(page);
      await expectNoDocumentVerticalOverflow(page);

      const hierarchy = await page.evaluate(() => {
        const cockpitNode = document.querySelector('.packing-cockpit') as HTMLElement;
        const actionNode = document.querySelector('.packing-primary-action') as HTMLElement;
        const primaryMetric = document.querySelector('.packing-cockpit-metric-priority') as HTMLElement;
        return {
          cockpitBackground: getComputedStyle(cockpitNode).backgroundColor,
          actionBackground: getComputedStyle(actionNode).backgroundColor,
          primaryMetricBackground: getComputedStyle(primaryMetric).backgroundColor,
        };
      });
      expect(hierarchy.cockpitBackground).not.toBe(hierarchy.actionBackground);
      expect(hierarchy.primaryMetricBackground).not.toBe('rgba(0, 0, 0, 0)');
    });
  }

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await useViewport(page, RESPONSIVE_VIEWPORTS.laptop);
  await configurePacking(page);
  const transitionDurationMs = await page.locator('.packing-progress-fill').evaluate((node) => {
    const durations = getComputedStyle(node).transitionDuration.split(',').map((value) => value.trim());
    const toMilliseconds = (value: string) => {
      if (value.endsWith('ms')) return Number.parseFloat(value);
      if (value.endsWith('s')) return Number.parseFloat(value) * 1000;
      return Number.POSITIVE_INFINITY;
    };
    return Math.max(...durations.map(toMilliseconds));
  });
  expect(transitionDurationMs).toBeLessThanOrEqual(1);
});
