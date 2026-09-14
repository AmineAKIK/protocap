import { expect, type Locator, type Page } from '@playwright/test';

export type ResponsiveViewport = Readonly<{
  name: string;
  width: number;
  height: number;
  intent: string;
}>;

export const RESPONSIVE_VIEWPORTS = {
  phoneMin: { name: 'phone-min', width: 320, height: 568, intent: 'minimum supported phone' },
  phone: { name: 'phone', width: 390, height: 844, intent: 'modern phone portrait' },
  phoneLandscape: { name: 'phone-landscape', width: 844, height: 390, intent: 'phone landscape / low height' },
  tabletSmall: { name: 'tablet-small', width: 640, height: 800, intent: 'intermediate small tablet' },
  tabletPortrait: { name: 'tablet-portrait', width: 768, height: 1024, intent: 'tablet portrait' },
  tabletLandscape: { name: 'tablet-landscape', width: 1024, height: 768, intent: 'tablet landscape' },
  laptopSmall: { name: 'laptop-small', width: 1180, height: 820, intent: 'small laptop' },
  laptopCompact: { name: 'laptop-compact', width: 1280, height: 720, intent: 'compact laptop / short desktop' },
  laptop: { name: 'laptop', width: 1366, height: 768, intent: 'common laptop' },
  desktop: { name: 'desktop', width: 1440, height: 900, intent: 'desktop' },
  desktopLarge: { name: 'desktop-large', width: 1920, height: 1080, intent: 'large desktop' },
} as const satisfies Record<string, ResponsiveViewport>;

export const CORE_RESPONSIVE_MATRIX: readonly ResponsiveViewport[] = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phone,
  RESPONSIVE_VIEWPORTS.phoneLandscape,
  RESPONSIVE_VIEWPORTS.tabletSmall,
  RESPONSIVE_VIEWPORTS.tabletPortrait,
  RESPONSIVE_VIEWPORTS.tabletLandscape,
  RESPONSIVE_VIEWPORTS.laptopSmall,
  RESPONSIVE_VIEWPORTS.laptopCompact,
  RESPONSIVE_VIEWPORTS.laptop,
  RESPONSIVE_VIEWPORTS.desktop,
];

export const REPRESENTATIVE_RESPONSIVE_MATRIX: readonly ResponsiveViewport[] = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phone,
  RESPONSIVE_VIEWPORTS.phoneLandscape,
  RESPONSIVE_VIEWPORTS.tabletPortrait,
  RESPONSIVE_VIEWPORTS.tabletLandscape,
  RESPONSIVE_VIEWPORTS.laptopSmall,
  RESPONSIVE_VIEWPORTS.desktop,
];

export async function useViewport(page: Page, viewport: ResponsiveViewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
}

export async function expectNoDocumentHorizontalOverflow(page: Page, tolerancePx = 1) {
  const geometry = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    documentElementScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body?.scrollWidth ?? 0,
  }));

  const scrollWidth = Math.max(geometry.documentElementScrollWidth, geometry.bodyScrollWidth);
  expect(
    scrollWidth,
    `document horizontal overflow: scrollWidth=${scrollWidth}px, viewport=${geometry.innerWidth}px`,
  ).toBeLessThanOrEqual(geometry.innerWidth + tolerancePx);
}

export async function expectNoDocumentVerticalOverflow(page: Page, tolerancePx = 1) {
  const geometry = await page.evaluate(() => ({
    innerHeight: window.innerHeight,
    documentElementScrollHeight: document.documentElement.scrollHeight,
    bodyScrollHeight: document.body?.scrollHeight ?? 0,
  }));

  const scrollHeight = Math.max(geometry.documentElementScrollHeight, geometry.bodyScrollHeight);
  expect(
    scrollHeight,
    `document vertical overflow: scrollHeight=${scrollHeight}px, viewport=${geometry.innerHeight}px`,
  ).toBeLessThanOrEqual(geometry.innerHeight + tolerancePx);
}

export async function expectLocatorInsideViewport(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, 'expected visible locator to have a bounding box').not.toBeNull();

  const viewport = page.viewportSize();
  expect(viewport, 'viewport must be configured before asserting geometry').not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x + box.width, 'locator extends past the right viewport edge').toBeLessThanOrEqual(viewport.width + 1);
  expect(box.x, 'locator extends past the left viewport edge').toBeGreaterThanOrEqual(-1);
  expect(box.y + box.height, 'locator extends past the bottom viewport edge').toBeLessThanOrEqual(viewport.height + 1);
  expect(box.y, 'locator extends past the top viewport edge').toBeGreaterThanOrEqual(-1);
}

export async function expectReachable(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();
  await expectLocatorInsideViewport(page, locator);
}

export async function expectNotCoveredAtCenter(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator).toBeVisible();

  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
    const topElement = document.elementFromPoint(x, y);
    return {
      x,
      y,
      covered: topElement !== element && !element.contains(topElement),
      coveringTag: topElement?.tagName ?? null,
      coveringText: topElement?.textContent?.trim().slice(0, 120) ?? null,
    };
  });

  expect(
    result.covered,
    `locator center (${result.x}, ${result.y}) is covered by ${result.coveringTag ?? 'unknown'} ${result.coveringText ?? ''}`,
  ).toBe(false);
}

export async function expectPrimaryActionUsable(page: Page, locator: Locator) {
  await expectReachable(page, locator);
  await expectNotCoveredAtCenter(page, locator);
  await expect(locator).toBeEnabled();
}
