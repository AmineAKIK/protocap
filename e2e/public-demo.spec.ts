import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('PR-10 public ShiftGuide demo', () => {
  test('T24/T25/T36/T42/T43: anonymous reader enters the synthetic ShiftGuide demo without a secret', async ({ page }) => {
    await page.goto('/shiftguide');
    await expect(page.getByText('Accès restreint')).toBeVisible();

    const demoButton = page.getByRole('button', { name: 'Démarrer la démo sans code' });
    await expect(demoButton).toBeVisible();
    await demoButton.click();

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

  test('T29/T45: demo origin exposes no protected unlock route and publishes no provider secret', async ({ request, page }) => {
    const availability = await request.get('/api/public-demo');
    expect(availability.ok()).toBe(true);
    expect(await availability.json()).toEqual({
      available: true,
      selfServe: true,
      url: '/shiftguide',
    });

    const protectedUnlock = await request.post('/api/shiftguide/unlock', {
      data: { code: 'protocap-demo' },
    });
    expect(protectedUnlock.status()).toBe(404);

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Tester le parcours synthétique sans secret/i })).toBeVisible();
    expect(await page.content()).not.toContain('DEEPSEEK_API_KEY');
    expect(await page.content()).not.toContain('protocap-demo');
  });
});
