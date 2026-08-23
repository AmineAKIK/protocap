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

    const session = await page.evaluate(() => ({
      token: sessionStorage.getItem('shiftguide_auth_token'),
      configRevision: sessionStorage.getItem('shiftguide_session_config_revision'),
      persistedRevision: localStorage.getItem('shiftguide_config_revision'),
    }));
    expect(session.token).toBeTruthy();
    expect(session.configRevision).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(session.persistedRevision).toBe(session.configRevision);

    await page.locator('aside').getByRole('button', { name: 'Quitter' }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/shiftguide/module/module_standard');
    await expect(page.getByText('Accès restreint')).toBeVisible();
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('shiftguide_auth_token'))).toBeNull();
  });

  test('persists standard-module progress across a full reload for the same config revision', async ({ page }) => {
    await unlock(page, '/shiftguide/module/module_standard');
    await expect(page.getByText('Valider le contrôle E2E')).toBeVisible();

    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByText('1 / 1 actions traitées')).toBeVisible();
    await expect(page.getByText('Terminé')).toBeVisible();

    const storedBeforeReload = await page.evaluate(() => JSON.parse(
      localStorage.getItem('shiftguide_progress_v3') ?? '{}'
    ));
    expect(storedBeforeReload.version).toBe(3);
    expect(storedBeforeReload.configRevision).toBe(
      await page.evaluate(() => localStorage.getItem('shiftguide_config_revision'))
    );
    expect(storedBeforeReload.actions?.action_standard_1).toBe('validated');

    await page.reload();
    await expect(page.getByText('1 / 1 actions traitées')).toBeVisible();
    await expect(page.getByText('Terminé')).toBeVisible();
  });

  test('serializes progress mutations behind the same-origin Web Lock', async ({ page, context }) => {
    await unlock(page, '/shiftguide/module/module_standard');
    const secondPage = await context.newPage();
    await unlock(secondPage, '/shiftguide/module/module_standard');

    expect(await page.evaluate(() => 'locks' in navigator)).toBe(true);

    await page.evaluate(async () => {
      await new Promise<void>((resolveReady) => {
        void navigator.locks.request('protocap:shiftguide:progress', async () => {
          await new Promise<void>((resolveRelease) => {
            const target = window as typeof window & {
              __releaseShiftGuideProgressLock?: () => void;
            };
            target.__releaseShiftGuideProgressLock = resolveRelease;
            resolveReady();
          });
        });
      });
    });

    await secondPage.getByRole('button', { name: 'Valider' }).click();
    await secondPage.waitForTimeout(150);

    expect(await secondPage.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('shiftguide_progress_v3') ?? '{}');
      return state.actions?.action_standard_1;
    })).toBeUndefined();

    await page.evaluate(() => {
      const target = window as typeof window & {
        __releaseShiftGuideProgressLock?: () => void;
      };
      target.__releaseShiftGuideProgressLock?.();
      delete target.__releaseShiftGuideProgressLock;
    });

    await expect.poll(() => secondPage.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('shiftguide_progress_v3') ?? '{}');
      return state.actions?.action_standard_1;
    })).toBe('validated');
    await expect(secondPage.getByText('1 / 1 actions traitées')).toBeVisible();
    await secondPage.close();
  });

  test('keeps incomplete-module confirmation keyboard safe and restores focus', async ({ page }) => {
    await unlock(page, '/shiftguide/module/module_standard');

    const closeButton = page.getByRole('button', {
      name: "Fermer le module et revenir à l'accueil ShiftGuide",
    });
    await closeButton.click();

    const dialog = page.getByRole('dialog', { name: 'Module non terminé' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuer' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(closeButton).toBeFocused();
    await expect(page).toHaveURL(/\/shiftguide\/module\/module_standard$/);
  });

  test('treats a choice module as the active scenario instead of requiring every alternative', async ({ page }) => {
    await unlock(page, '/shiftguide/module/module_choice');

    await page.getByRole('button', { name: /Scénario A/ }).click();
    await expect(page.getByText('Traiter le scénario A')).toBeVisible();
    await page.getByRole('button', { name: 'Valider' }).click();
    await expect(page.getByText('Terminé')).toBeVisible();

    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('shiftguide_progress_v3') ?? '{}'));
    expect(state.activeChoices?.module_choice).toBe('scenario_a');
    expect(state.actions?.choice_action_a).toBe('validated');
    expect(state.actions?.choice_action_b).toBeUndefined();
    expect(state.configRevision).toBe(
      await page.evaluate(() => localStorage.getItem('shiftguide_config_revision'))
    );

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