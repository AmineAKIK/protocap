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
const productionStart = '2026-09-15T07:30';

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

  await page.getByLabel('Quantité demandée').fill('5120000000');
  await page.getByLabel('Unités par carton').fill('128');
  await page.getByLabel('Cartons par palette').fill('40');
  await page.getByLabel('Début OC').fill(productionStart);
  await page
    .getByRole('radiogroup', { name: 'Stratégie de conditionnement' })
    .getByRole('radio', { name: /Carton complet/i })
    .click();
  await page.getByLabel('Cadence réf.').fill('60');
  await page.getByRole('button', { name: 'Lancer le suivi de production' }).click();

  await expect(page.getByRole('heading', { name: 'Conduite de production' })).toBeVisible();
  await expect(page.getByLabel('Historique des déclarations')).toBeVisible();
}

async function expectVisibleNumberNotClipped(locator: Locator) {
  await expect(locator).toBeVisible();
  const state = await locator.evaluate((node) => {
    const element = node as HTMLElement;
    return {
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
    };
  });
  expect(state.scrollWidth).toBeLessThanOrEqual(state.width + 1);
}

test('Packing preparation fields stay separated at the 1024px cockpit-fit boundary', async ({ page }) => {
  await useViewport(page, RESPONSIVE_VIEWPORTS.tabletLandscape);
  await page.goto('/packing-calculator');
  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), PACKING_ACTIVE_RUN_STORAGE_KEY);
  await page.reload();

  await page.getByLabel('Début OC').fill(productionStart);
  await page.getByLabel('Cadence réf.').fill('60');

  const startField = page.getByLabel('Début OC').locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " packing-v3-field ")][1]');
  const cadenceField = page.getByLabel('Cadence réf.').locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " packing-v3-field ")][1]');
  const startBox = await startField.boundingBox();
  const cadenceBox = await cadenceField.boundingBox();

  expect(startBox).not.toBeNull();
  expect(cadenceBox).not.toBeNull();
  expect(startBox!.x + startBox!.width).toBeLessThanOrEqual(cadenceBox!.x + 1);

  const startInputFit = await page.getByLabel('Début OC').evaluate((node) => {
    const element = node as HTMLInputElement;
    return { width: element.clientWidth, scrollWidth: element.scrollWidth };
  });
  expect(startInputFit.scrollWidth).toBeLessThanOrEqual(startInputFit.width + 1);
  await expectNoDocumentHorizontalOverflow(page);
});

// responsive-contract:packing-responsive-contract
test('Packing dense surface stays contained and changes composition only in supported regimes', async ({ page }) => {
  for (const viewport of PACKING_VIEWPORTS) {
    await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
      await useViewport(page, viewport);
      await configurePacking(page);

      await test.step('document containment and primary action', async () => {
        await expectNoDocumentHorizontalOverflow(page);
        await expectPrimaryActionUsable(page, page.getByRole('button', { name: /Déclarer une palette complète/i }));
      });

      await test.step('business numbers remain readable and critical outputs are not clipped', async () => {
        const clippedNumbers = await page
          .locator(
            '.packing-v3-primary-kpis strong:visible, .packing-v3-time-kpis strong:visible, .packing-v3-history-total strong:visible',
          )
          .evaluateAll((nodes) =>
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

        await expectVisibleNumberNotClipped(page.locator('.packing-v3-primary-kpis strong').first());
        await expectVisibleNumberNotClipped(page.locator('.packing-v3-history-total strong'));
      });

      await test.step('stacked and cockpit-fit compositions switch by available width and height', async () => {
        const execution = page.locator('.packing-v3-production-main');
        const history = page.locator('.packing-v3-history');
        const executionBox = await execution.boundingBox();
        const historyBox = await history.boundingBox();
        expect(executionBox).not.toBeNull();
        expect(historyBox).not.toBeNull();

        const usesCockpitFit = viewport.width >= 1024 && viewport.height >= 700;
        if (usesCockpitFit) {
          expect(historyBox!.x).toBeGreaterThan(executionBox!.x + executionBox!.width - 2);
          expect(Math.abs(historyBox!.y - executionBox!.y)).toBeLessThan(8);
        } else {
          expect(Math.abs(historyBox!.x - executionBox!.x)).toBeLessThan(8);
          expect(historyBox!.y).toBeGreaterThan(executionBox!.y + executionBox!.height - 2);
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

      const cockpit = page.locator('.packing-v3-production');
      const primaryAction = page.getByRole('button', { name: /Déclarer une palette complète/i });

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

      const cockpit = page.locator('.packing-v3-production');
      const actionPanel = page.locator('.packing-v3-full-load-action');
      const progressbar = page.getByRole('progressbar', { name: 'Progression de l’ordre de conditionnement' });
      const progressFill = progressbar.locator('.packing-v3-progress-track > span');
      const action = page.getByRole('button', { name: /Déclarer une palette complète/i });

      await expect(cockpit).toBeVisible();
      await expect(actionPanel).toBeVisible();
      await expect(progressbar).toBeVisible();
      await expect(progressbar).toHaveAttribute('aria-valuenow', '0');
      await expect(progressFill).toHaveCount(1);
      await expect(action).toBeVisible();
      await expectNoDocumentHorizontalOverflow(page);
      await expectNoDocumentVerticalOverflow(page);

      const hierarchy = await page.evaluate(() => {
        const cockpitNode = document.querySelector('.packing-v3-production') as HTMLElement;
        const actionNode = document.querySelector('.packing-v3-full-load-action') as HTMLElement;
        const primaryMetric = document.querySelector('.packing-v3-remaining') as HTMLElement;
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
  const transitionDurationMs = await page.locator('.packing-v3-progress-track > span').evaluate((node) => {
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
