import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ACCESS_CODE = 'e2e-access-code';

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const blocking = results.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      targets: violation.nodes.map((node) => node.target),
    }));

  expect(blocking).toEqual([]);
}

async function unlock(page: Page, path: string) {
  await page.goto(path);
  await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.getByText('Accès restreint')).toBeHidden();
}

test.describe('critical accessibility smoke', () => {
  test('public landing page has no serious automated WCAG violations', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ProtoCap/);
    await expectNoSeriousA11yViolations(page);
  });

  test('ShiftGuide lock has no serious automated WCAG violations', async ({ page }) => {
    await page.goto('/shiftguide/module/module_standard');
    await expect(page.getByText('Accès restreint')).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });

  test('authenticated module and confirmation dialog have no serious automated WCAG violations', async ({ page }) => {
    await unlock(page, '/shiftguide/module/module_standard');
    await expect(page.getByText('Valider le contrôle E2E')).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole('button', {
      name: "Fermer le module et revenir à l'accueil ShiftGuide",
    }).click();
    await expect(page.getByRole('dialog', { name: 'Module non terminé' })).toBeVisible();
    await expectNoSeriousA11yViolations(page);
  });
});
