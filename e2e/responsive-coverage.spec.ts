import { expect, test, type Locator } from '@playwright/test';
import {
  RESPONSIVE_VIEWPORTS,
  expectLocatorInsideViewport,
  expectNoDocumentHorizontalOverflow,
  expectPrimaryActionUsable,
  useViewport,
} from './responsive-harness';

const ACCESS_CODE = 'e2e-access-code';
const COVERAGE_VIEWPORTS = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phoneLandscape,
  RESPONSIVE_VIEWPORTS.tabletPortrait,
  RESPONSIVE_VIEWPORTS.laptopSmall,
] as const;

async function unlockShiftGuide(page: import('@playwright/test').Page, path: string) {
  await page.goto(path);
  await expect(page.getByText('Accès restreint')).toBeVisible();
  await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
}

async function expectInsideVisualViewport(locator: Locator) {
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const viewport = window.visualViewport;
    return {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: viewport?.width ?? window.innerWidth,
      viewportHeight: viewport?.height ?? window.innerHeight,
    };
  });

  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth + 1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
}

test.describe('responsive principal surface coverage', () => {
  // responsive-contract:home
  test('Home keeps its primary content and module actions usable', async ({ page }) => {
    for (const viewport of COVERAGE_VIEWPORTS) {
      await test.step(viewport.name, async () => {
        await useViewport(page, viewport);
        await page.goto('/');
        await expect(page.getByRole('heading', { name: /ProtoCap/ })).toBeVisible();
        await expectPrimaryActionUsable(page, page.getByRole('button', { name: 'Lancer la présentation' }));
        await expect(page.getByRole('link', { name: /Ouvrir le module/ }).first()).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);
      });
    }
  });

  // responsive-contract:knowledge-base
  test('Knowledge Base list and detail remain contained and reachable', async ({ page }) => {
    for (const viewport of COVERAGE_VIEWPORTS) {
      await test.step(viewport.name, async () => {
        await useViewport(page, viewport);
        await page.goto('/knowledge-base');
        const search = page.getByPlaceholder('Rechercher par code, titre, zone...');
        await expect(search).toBeVisible();
        await expectLocatorInsideViewport(page, search);
        await expectNoDocumentHorizontalOverflow(page);

        const firstDocument = page.locator('ul button').first();
        await expect(firstDocument).toBeVisible();
        await firstDocument.click();
        await expect(page.getByRole('link', { name: 'Standards terrain' })).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);
      });
    }
  });

  // responsive-contract:shiftguide-home
  test('ShiftGuide home is explicitly covered after unlock', async ({ page }) => {
    for (const viewport of COVERAGE_VIEWPORTS) {
      await test.step(viewport.name, async () => {
        await useViewport(page, viewport);
        await unlockShiftGuide(page, '/shiftguide');
        const celineHomeLink = page.locator('[data-shell-content] a[href="/shiftguide/celine"]').first();
        await expect(celineHomeLink).toBeVisible();
        await expectLocatorInsideViewport(page, celineHomeLink);
        await expectNoDocumentHorizontalOverflow(page);
      });
    }
  });

  // responsive-contract:shiftguide-celine
  test('Céline reacts to a reduced visual viewport without hiding the composer', async ({ browser, baseURL }) => {
    const viewport = RESPONSIVE_VIEWPORTS.phone;
    const context = await browser.newContext({ baseURL, viewport: { width: viewport.width, height: viewport.height } });
    await context.addInitScript(() => {
      const events = new EventTarget();
      let visibleHeight = window.innerHeight;
      const mockViewport = {
        get height() { return visibleHeight; },
        get width() { return window.innerWidth; },
        offsetLeft: 0,
        offsetTop: 0,
        pageLeft: 0,
        pageTop: 0,
        scale: 1,
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
      };
      Object.defineProperty(window, 'visualViewport', { configurable: true, value: mockViewport });
      Object.defineProperty(window, '__setResponsiveTestVisualViewportHeight', {
        configurable: true,
        value: (height: number) => {
          visibleHeight = height;
          events.dispatchEvent(new Event('resize'));
        },
      });
    });

    const page = await context.newPage();
    try {
      await unlockShiftGuide(page, '/shiftguide/celine');
      const input = page.getByPlaceholder('Décris ta situation…');
      const send = page.getByRole('button', { name: 'Envoyer' });
      await expect(input).toBeVisible();

      await page.evaluate(() => {
        (window as Window & { __setResponsiveTestVisualViewportHeight: (height: number) => void })
          .__setResponsiveTestVisualViewportHeight(520);
      });

      const shellContent = page.locator('[data-shiftguide-shell] [data-shell-content]');
      await expect.poll(async () => Math.round((await shellContent.boundingBox())?.height ?? 0)).toBe(520);
      await expectInsideVisualViewport(input);
      await expectInsideVisualViewport(send);
      await expectNoDocumentHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
});
