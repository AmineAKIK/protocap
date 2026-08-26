import { expect, test } from '@playwright/test';

const ACCESS_CODE = 'e2e-access-code';

test.describe('browser and responsive smoke', () => {
  test('renders the public shell with installable PWA metadata and no horizontal overflow', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/ProtoCap/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest/i);
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /width=device-width/);

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();
    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(href!);
      return { ok: response.ok, body: await response.json() };
    }, manifestHref);
    expect(manifest.ok).toBe(true);
    expect(manifest.body.name).toBe('ProtoCap');
    expect(manifest.body.short_name).toBe('ProtoCap');

    const viewport = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
  });

  test('unlocks a protected ShiftGuide deep link and keeps the primary action usable', async ({ page }) => {
    await page.goto('/shiftguide/module/module_standard');
    await expect(page.getByText('Accès restreint')).toBeVisible();

    await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
    await page.getByRole('button', { name: 'Déverrouiller' }).click();

    await expect(page.getByText('Valider le contrôle E2E')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Valider' })).toBeVisible();

    const viewport = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth + 1);
  });
});
