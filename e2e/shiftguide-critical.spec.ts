import { expect, test, type Page } from '@playwright/test';

const ACCESS_CODE = 'e2e-access-code';

async function unlock(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByText('Accès restreint')).toBeVisible();
  await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();
  await expect(page.getByText('Accès restreint')).toBeHidden();
}

test.describe('ShiftGuide critical journeys', () => {
  test('protects deep links, rejects a bad code, creates a real session and revokes it on logout', async ({ page }) => {
    await page.goto('/shiftguide/module/module_standard');

    await expect(page.getByText('Accès restreint')).toBeVisible();
    await page.getByLabel("Code d'accès").fill('wrong-code');
    await page.getByRole('button', { name: 'Déverrouiller' }).click();
    await expect(page.getByRole('alert')).toContainText('Code incorrect.');

    await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
    await page.getByRole('button', { name: 'Déverrouiller' }).click();
    await expect(page.getByText('Valider le contrôle E2E')).toBeVisible();

    const token = await page.evaluate(() => sessionStorage.getItem('shiftguide_auth_token'));
    expect(token).toBeTruthy();

    await page.locator('aside').getByRole('button', { name: 'Quitter' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/shiftguide/module/module_standard');
    await expect(page.getByText('Accès restreint')).toBeVisible();
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('shiftguide_auth_token'))).toBeNull();
  });

  test('persists standard-module progress across a full reload', async ({ page }) => {
    await unlock(page, '/shiftguide/module/module_standard');
    await expect(page.getByText('Valider le contrôle E2E')).toBeVisible();

    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByText('1 / 1 actions traitées')).toBeVisible();
    await expect(page.getByText('Terminé')).toBeVisible();

    const storedBeforeReload = await page.evaluate(() => localStorage.getItem('shiftguide_progress_v2'));
    expect(storedBeforeReload).toContain('action_standard_1');
    expect(storedBeforeReload).toContain('validated');

    await page.reload();
    await expect(page.getByText('1 / 1 actions traitées')).toBeVisible();
    await expect(page.getByText('Terminé')).toBeVisible();
  });

  test('treats a choice module as the active scenario instead of requiring every alternative', async ({ page }) => {
    await unlock(page, '/shiftguide/module/module_choice');

    await page.getByRole('button', { name: /Scénario A/ }).click();
    await expect(page.getByText('Traiter le scénario A')).toBeVisible();
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByText('Terminé')).toBeVisible();

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('shiftguide_progress_v2') ?? '{}'));
    expect(state.activeChoices?.module_choice).toBe('scenario_a');
    expect(state.actions?.choice_action_a).toBe('validated');
    expect(state.actions?.choice_action_b).toBeUndefined();

    await page.goto('/shiftguide');
    const moduleCard = page.locator('a[href="/shiftguide/module/module_choice"]').filter({ hasText: 'Module à choix' }).first();
    await expect(moduleCard).toContainText('Terminé');
  });

  test('keeps the Celine server boundary deterministic when the AI provider is not configured', async ({ page }) => {
    await unlock(page, '/shiftguide/celine');

    const input = page.getByPlaceholder('Décris ta situation…');
    await expect(input).toBeVisible();

    const responsePromise = page.waitForResponse((response) =>
      response.url().endsWith('/api/celine/chat') && response.request().method() === 'POST'
    );

    await input.fill('Je commence mon poste');
    await input.press('Enter');

    const response = await responsePromise;
    expect(response.status()).toBe(503);
    await expect(page.getByText('Service IA non configuré.')).toBeVisible();
  });
});
