import { expect, test } from '@playwright/test';
import {
  RESPONSIVE_VIEWPORTS,
  expectNoDocumentHorizontalOverflow,
  useViewport,
} from './responsive-harness';

const MOBILE_FORM_VIEWPORTS = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phone,
] as const;

const CONTROLS = [
  { name: 'line', label: 'Ligne de conditionnement' },
  { name: 'zone', label: 'Zone de ligne' },
  { name: 'palletCount', label: 'Palettes' },
  { name: 'priority', label: 'Priorité' },
  { name: 'nature', label: 'Nature' },
  { name: 'comment', label: 'Commentaire' },
] as const;

test.describe('Logistics Call mobile form contract', () => {
  test('shared fields stay block-level, full-width and touch-safe on narrow phones', async ({ page }) => {
    for (const viewport of MOBILE_FORM_VIEWPORTS) {
      await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/logistics-call');

        await expect(page.getByRole('heading', { name: 'Logistics Call' })).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);

        for (const { name, label } of CONTROLS) {
          const control = page.locator(`[name="${name}"]`);
          await expect(control).toBeVisible();
          await expect(control).toHaveClass(/\bfield\b/);
          await expect(control).toHaveCSS('display', 'block');

          const geometry = await control.evaluate((element) => {
            const controlRect = element.getBoundingClientRect();
            const labelElement = element.closest('label');
            const labelRect = labelElement?.getBoundingClientRect();
            const labelText = labelElement?.querySelector('.label');
            const labelTextRect = labelText?.getBoundingClientRect();
            return {
              width: controlRect.width,
              height: controlRect.height,
              parentWidth: labelRect?.width ?? 0,
              top: controlRect.top,
              labelBottom: labelTextRect?.bottom ?? 0,
              labelText: labelText?.textContent?.trim() ?? '',
            };
          });

          expect(geometry.labelText, `${name} must retain its visible field label`).toBe(label);
          expect(geometry.height, `${label} must preserve a 44px minimum touch target`).toBeGreaterThanOrEqual(44);
          expect(geometry.width, `${label} must fill its mobile field column`).toBeGreaterThanOrEqual(220);
          expect(Math.abs(geometry.parentWidth - geometry.width), `${label} must own the full available label width`).toBeLessThanOrEqual(1);
          expect(geometry.top, `${label} control must render below its block label`).toBeGreaterThanOrEqual(geometry.labelBottom);
        }
      });
    }
  });
});
