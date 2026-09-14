import { expect, test } from '@playwright/test';
import {
  CORE_RESPONSIVE_MATRIX,
  REPRESENTATIVE_RESPONSIVE_MATRIX,
  RESPONSIVE_VIEWPORTS,
  expectLocatorInsideViewport,
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
const EDITORIAL_VIEWPORTS = [
  RESPONSIVE_VIEWPORTS.phoneMin,
  RESPONSIVE_VIEWPORTS.phoneLandscape,
  RESPONSIVE_VIEWPORTS.laptopSmall,
  RESPONSIVE_VIEWPORTS.laptopCompact,
] as const;
const SHIFTGUIDE_VIEWPORTS = [
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

  test('editorial report and presentation remain readable across width and low-height regimes', async ({ page }) => {
    for (const viewport of EDITORIAL_VIEWPORTS) {
      await test.step(`Operational Report — ${viewport.name}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/rapport');

        await expect(page.getByRole('heading', { name: /Du terrain/ })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Synthèse opérationnelle' })).toBeVisible();
        await expectNoDocumentHorizontalOverflow(page);
      });

      await test.step(`Presentation Mode — ${viewport.name}`, async () => {
        await useViewport(page, viewport);
        await page.goto('/');
        await page.getByRole('button', { name: 'Lancer la présentation' }).click();

        const dialog = page.getByRole('dialog', { name: 'Présentation du rapport opérationnel' });
        const next = dialog.getByRole('button', { name: /Suivant|→/ });
        const close = dialog.getByRole('button', { name: 'Quitter la présentation' });

        await expect(dialog).toBeVisible();
        await expect(dialog.getByRole('heading', { name: 'Du terrain au prototype' })).toBeVisible();
        await expectLocatorInsideViewport(page, close);
        await expectLocatorInsideViewport(page, next);
        await expectNoDocumentHorizontalOverflow(page);

        for (let i = 0; i < 4; i += 1) await next.click();
        await expect(dialog.getByRole('heading', { name: 'Impact opérationnel attendu' })).toBeVisible();
        await expectLocatorInsideViewport(page, close);
        await expectLocatorInsideViewport(page, next);
      });
    }
  });

  test('ShiftGuide surfaces stay contained across mobile, landscape and desktop-rail onset', async ({ browser }) => {
    for (const viewport of SHIFTGUIDE_VIEWPORTS) {
      await test.step(`${viewport.name}: ${viewport.intent}`, async () => {
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

          await page.goto('/shiftguide/celine');
          const celineInput = page.getByPlaceholder('Décris ta situation…');
          await expect(celineInput).toBeVisible();
          await expectLocatorInsideViewport(page, celineInput);
          await expectLocatorInsideViewport(page, page.getByRole('button', { name: 'Envoyer' }));
          await expectNoDocumentHorizontalOverflow(page);

          await page.goto('/shiftguide/lexique');
          const lexiconSearch = page.getByPlaceholder('Rechercher un sigle ou une définition…');
          await expect(lexiconSearch).toBeVisible();
          await expectLocatorInsideViewport(page, lexiconSearch);
          await expectNoDocumentHorizontalOverflow(page);

          await page.goto('/shiftguide/urgences');
          await expect(page.getByRole('heading', { name: 'Urgences & Règles d’Or' })).toBeVisible();
          await expectNoDocumentHorizontalOverflow(page);

          await page.goto('/shiftguide/linepulse');
          await expect(page.getByRole('heading', { name: /Voir ou agir maintenant/ })).toBeVisible();
          await expectNoDocumentHorizontalOverflow(page);

          await page.goto('/shiftguide/analyse-ligne');
          await expect(page.getByRole('heading', { name: 'Du symptôme visible à la cause réelle.' })).toBeVisible();
          await expectNoDocumentHorizontalOverflow(page);
        } finally {
          await context.close();
        }
      });
    }
  });
});
