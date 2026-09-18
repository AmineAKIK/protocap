import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const protectedOrigin = 'http://127.0.0.1:4176';
const demoOrigin = 'http://127.0.0.1:4175';

test.describe('PR-10b direct public ShiftGuide demo entry', () => {
  test('T24/T25/T36/T42/T43: protected CTA opens the demo cockpit in one click with no lock screen', async ({ page }) => {
    await page.goto(`${protectedOrigin}/`);
    await expect(page.getByRole('heading', { name: /ProtoCap/ })).toBeVisible();
    await expect(page.getByText('ShiftGuide · démo publique')).toHaveCount(0);

    await page.goto(`${protectedOrigin}/shiftguide`);
    await expect(page.getByText('Accès restreint')).toBeVisible();

    const demoLink = page.getByRole('link', { name: 'Essayer ShiftGuide en démo' });
    await expect(demoLink).toHaveAttribute('href', `${demoOrigin}/demo`);

    await Promise.all([
      page.waitForURL(`${demoOrigin}/shiftguide`),
      demoLink.click(),
    ]);

    await expect(page.getByText('Accès restreint')).toHaveCount(0);
    await expect(page.getByLabel('Code d\'accès')).toHaveCount(0);
    await expect(page.getByText(/Démo publique · données fictives · réponses scénarisées/)).toBeVisible();
    await expect(page.getByText('Démarrage synthétique')).toBeVisible();

    const profile = await page.evaluate(() => sessionStorage.getItem('shiftguide_session_profile'));
    expect(profile).toBe('demo');

    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(a11y.violations.filter((violation) =>
      violation.impact === 'critical' || violation.impact === 'serious'
    )).toEqual([]);

    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);
  });


  test('T45: demo origin serves ShiftGuide only and sends ProtoCap routes back to the real app', async ({ page }) => {
    for (const path of ['/', '/rapport', '/expiry-check']) {
      await page.goto(`${demoOrigin}${path}`);
      await page.waitForURL(`${protectedOrigin}${path}`);
      await expect(page.getByText(/Démo publique · données fictives · réponses scénarisées/)).toHaveCount(0);
    }
  });

  test('T45: leaving ShiftGuide demo returns to the real ProtoCap origin', async ({ page }) => {
    await page.goto(`${demoOrigin}/shiftguide`);
    await expect(page.getByText(/Démo publique · données fictives · réponses scénarisées/)).toBeVisible();

    await page.getByRole('button', { name: 'Quitter' }).first().click();

    await page.waitForURL(`${protectedOrigin}/`);
    await expect(page.getByRole('heading', { name: /ProtoCap/ })).toBeVisible();
    await expect(page.getByText(/Démo publique · données fictives · réponses scénarisées/)).toHaveCount(0);
  });

  test('T29/T45: API contract exposes a direct entry and demo origin never exposes protected unlock', async ({ request, page }) => {
    const protectedAvailability = await request.get(`${protectedOrigin}/api/public-demo`);
    expect(protectedAvailability.ok()).toBe(true);
    expect(await protectedAvailability.json()).toEqual({
      available: true,
      selfServe: false,
      entryUrl: `${demoOrigin}/demo`,
    });

    const demoAvailability = await request.get(`${demoOrigin}/api/public-demo`);
    expect(demoAvailability.ok()).toBe(true);
    expect(await demoAvailability.json()).toEqual({
      available: true,
      selfServe: true,
      entryUrl: '/demo',
    });

    const protectedUnlock = await request.post(`${demoOrigin}/api/shiftguide/unlock`, {
      data: { code: 'protocap-demo' },
    });
    expect(protectedUnlock.status()).toBe(404);

    await page.goto(`${demoOrigin}/shiftguide`);
    await expect(page.getByText('Accès restreint')).toHaveCount(0);
    await expect(page.getByText('Démarrage synthétique')).toBeVisible();
    expect(await page.content()).not.toContain('DEEPSEEK_API_KEY');
    expect(await page.content()).not.toContain('protocap-demo');
  });
});
