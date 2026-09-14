import { expect, test } from '@playwright/test';
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

test.describe('responsive principal surface coverage', () => {
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
      await expect(input).toBeVisible();

      await page.evaluate(() => {
        (window as Window & { __setResponsiveTestVisualViewportHeight: (height: number) => void })
          .__setResponsiveTestVisualViewportHeight(520);
      });

      const shellContent = page.locator('[data-shiftguide-shell] [data-shell-content]');
      await expect.poll(async () => Math.round((await shellContent.boundingBox())?.height ?? 0)).toBe(520);
      await expectLocatorInsideViewport(page, input);
      await expectLocatorInsideViewport(page, page.getByRole('button', { name: 'Envoyer' }));
      await expectNoDocumentHorizontalOverflow(page);
    } finally {
      await context.close();
    }
  });
});
