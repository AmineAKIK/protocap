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

const CONTROL_LABELS = [
  'Ligne de conditionnement',
  'Zone de ligne',
  'Palettes',
  'Priorité',
  'Nature',
  'Commentaire',
] as const;

test.describe('Logistics Call mobile form contract', () => {
  test('shared fields stay block-level, full-width and touch-safe on narrow phones', async ({ page }) => {
    for (const viewport of MOBILE_FORM_VIEWPORTS) {
      await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/logistics-call');

        await expect(page.getByRole('heading', { name: 'Logistics Call' })).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);

        for (const label of CONTROL_LABELS) {
          const control = page.getByLabel(label, { exact: true });
          await expect(control).toBeVisible();
          await expect(control).toHaveCSS('display', 'block');

          const geometry = await control.evaluate((element) => {
            const controlRect = element.getBoundingClientRect();
            const labelRect = element.parentElement?.getBoundingClientRect();
            const labelText = element.parentElement?.querySelector('.label')?.getBoundingClientRect();
            return {
              width: controlRect.width,
              height: controlRect.height,
              parentWidth: labelRect?.width ?? 0,
              top: controlRect.top,
              labelBottom: labelText?.bottom ?? 0,
            };
          });

          expect(geometry.height, `${label} must preserve a 44px minimum touch target`).toBeGreaterThanOrEqual(44);
          expect(geometry.width, `${label} must fill its mobile field column`).toBeGreaterThanOrEqual(220);
          expect(Math.abs(geometry.parentWidth - geometry.width), `${label} must own the full available label width`).toBeLessThanOrEqual(1);
          expect(geometry.top, `${label} control must render below its block label`).toBeGreaterThanOrEqual(geometry.labelBottom);
        }
      });
    }
  });
});
