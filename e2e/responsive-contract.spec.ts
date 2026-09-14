import { expect, test } from '@playwright/test';
import {
  CORE_RESPONSIVE_MATRIX,
  REPRESENTATIVE_RESPONSIVE_MATRIX,
  RESPONSIVE_VIEWPORTS,
  expectNoDocumentHorizontalOverflow,
  expectPrimaryActionUsable,
  useViewport,
} from './responsive-harness';

const ACCESS_CODE = 'e2e-access-code';
const OPERATIONAL_VIEWPORTS = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phoneLandscape,
  RESPONSIVE_VIEWPORTS.tabletLandscape,
  RESPONSIVE_VIEWPORTS.laptopSmall,
] as const;

test.describe('responsive architecture contract', () => {
  test('public shell keeps the root document contained across the core viewport matrix', async ({ page }) => {
    for (const viewport of CORE_RESPONSIVE_MATRIX) {
      await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/');
        await expect(page).toHaveTitle(/ProtoCap/);
        await expectNoDocumentHorizontalOverflow(page);
      });
    }
  });

  test('pilot reference keeps critical content contained across representative width and height regimes', async ({ page }) => {
    for (const viewport of REPRESENTATIVE_RESPONSIVE_MATRIX) {
      await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/proposition-pilote');

        await expect(page.getByRole('heading', { name: 'Assistant de rappel des prélèvements en production' })).toBeVisible();
        await expect(page.getByText('Interprétation de la règle')).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);
      });
    }
  });

  test('operational surfaces keep primary workflows reachable without root overflow', async ({ page }) => {
    for (const viewport of OPERATIONAL_VIEWPORTS) {
      await test.step(`Expiry Check — ${viewport.name}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/expiry-check');

        await expect(page.getByRole('heading', { name: 'Expiry Check' })).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);
        await expectPrimaryActionUsable(page, page.getByRole('button', { name: 'Déclarer un remplacement' }));

        if (viewport.width < 1024) {
          await page.getByRole('button', { name: 'Tournée' }).click();
          await expect(page.getByRole('heading', { name: 'Board de tournée' })).toBeVisible();
          await expectNoDocumentHorizontalOverflow(page);
        }
      });

      await test.step(`Logistics Call — ${viewport.name}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/logistics-call');

        await expect(page.getByRole('heading', { name: 'Logistics Call' })).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);
        await expectPrimaryActionUsable(page, page.getByRole('button', { name: "Envoyer l'appel logistique" }));

        if (viewport.width < 1280) {
          await page.getByRole('button', { name: /Board logistique/ }).click();
          await expect(page.getByRole('heading', { name: 'Board de traitement' })).toBeVisible();
          await expectNoDocumentHorizontalOverflow(page);
        }
      });
    }
  });

  test('protected ShiftGuide primary action stays reachable on minimum phone and phone landscape', async ({ browser }) => {
    for (const viewport of [RESPONSIVE_VIEWPORTS.phoneMin, RESPONSIVE_VIEWPORTS.phoneLandscape]) {
      await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
        // Protected-route scenarios must be isolated at browser-context level.
        // This prevents cookies, local/session storage or other auth state from
        // leaking between viewport cases and obscuring responsive regressions.
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();

        try {
          await page.goto('/shiftguide/module/module_standard');

          await expect(page.getByText('Accès restreint')).toBeVisible();
          await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
          await page.getByRole('button', { name: 'Déverrouiller' }).click();

          const primaryAction = page.getByRole('button', { name: 'Valider' });
          await expect(page.getByText('Valider le contrôle E2E')).toBeVisible();
          await expectPrimaryActionUsable(page, primaryAction);
          await expectNoDocumentHorizontalOverflow(page);
        } finally {
          await context.close();
        }
      });
    }
  });
});
