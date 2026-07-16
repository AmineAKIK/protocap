import { expect, test } from '@playwright/test';

const ACCESS_CODE = 'atelier-42';
const VAULT_PASSPHRASE = 'coffre-local-test-2026';

async function unlockShiftGuideAndVault(page: import('@playwright/test').Page) {
  await page.goto('/shiftguide/remplissage');
  await expect(page.getByRole('heading', { name: 'ShiftGuide' })).toBeVisible();
  await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
  await page.getByRole('button', { name: 'Déverrouiller' }).click();

  await expect(page.getByRole('heading', { name: 'Créer le coffre local' })).toBeVisible();
  await page.getByLabel('Phrase secrète locale').fill(VAULT_PASSPHRASE);
  await page.getByLabel('Confirmer la phrase').fill(VAULT_PASSPHRASE);
  await page.getByRole('button', { name: 'Créer et ouvrir le coffre' }).click();
  await expect(page.getByRole('heading', { name: 'Préparer et converger sans confusion' })).toBeVisible();
}

async function createVerifiedProfile(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Profils' }).click();
  await page.getByRole('button', { name: 'Nouveau profil' }).click();

  await page.getByLabel('Nom du profil').fill('Produit A · Tube 5 mL · Machine 1');
  await page.getByLabel('Statut', { exact: true }).selectOption('verified_by_me');

  await page.getByLabel('Machine', { exact: true }).fill('Remplisseuse 1');
  await page.getByLabel('Type de consigne').selectOption('net_mass');
  await page.getByLabel('Résolution', { exact: true }).first().fill('0,01');
  await page.getByLabel('Source machine').fill('Notice machine M1');

  await page.getByLabel('Article / SKU').fill('SKU-A');
  await page.getByLabel('Désignation').fill('Produit A');
  await page.getByLabel('Cible approuvée').fill('5,17');
  await page.getByLabel('Masse volumique').fill('1,019');
  await page.getByLabel('Source produit / densité').fill('Fiche produit A');

  await page.getByLabel('Profil tube').fill('Tube 5 mL');
  await page.getByLabel('Code format').fill('T5');
  await page.getByLabel('Tare moyenne').fill('5,00');
  await page.getByLabel('Source tare').fill('Étude tare T5');

  await page.getByLabel('Taille échantillon').fill('3');
  await page.getByLabel('Écart moyen inférieur admis').fill('0,05');
  await page.getByLabel('Écart moyen supérieur admis').fill('0,05');
  await page.getByLabel('Zone sans correction').fill('0,01');
  await page.getByLabel('Limite individuelle basse').fill('0,20');
  await page.getByLabel('Limite individuelle haute').fill('0,20');
  await page.getByLabel('Nombre maximal hors limites').fill('0');
  await page.getByLabel('Correction maximale').fill('0,50');
  await page.getByLabel('Source du plan').fill('Procédure démarrage A');

  await page.getByLabel('Balance').fill('Balance 1');
  await page.getByLabel('Numéro / alias').fill('BAL-001');
  await page.getByLabel('Maximum', { exact: true }).last().fill('500');
  await page.getByLabel('Statut de vérification').selectOption('valid');
  await page.getByLabel('Valide jusqu’au').fill('2027-12-31');
  await page.getByLabel('Source instrument').fill('Registre métrologie');

  await page.getByRole('button', { name: 'Vérifier et enregistrer' }).click();
  await expect(page.getByText('Réel activé')).toBeVisible();
}

test('parcours Gold shadow complet, historique et sauvegarde chiffrée', async ({ page }) => {
  await unlockShiftGuideAndVault(page);
  await createVerifiedProfile(page);

  await page.getByRole('link', { name: 'Réglage', exact: true }).click();
  await page.getByLabel('Profil').selectOption({ label: 'Produit A · Tube 5 mL · Machine 1' });
  await page.getByLabel('Ordre / OC (facultatif)').fill('OC-TEST-001');
  await page.getByLabel('Lot (facultatif)').fill('LOT-TEST-A');
  await page.getByRole('button', { name: 'Commencer' }).click();

  await expect(page.getByText('Contexte figé')).toBeVisible();
  await expect(page.getByText('5,27 g', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'J’ai appliqué ce réglage' }).click();

  const grossInput = page.getByLabel('Masse BRUTE du tube');
  for (let index = 0; index < 3; index += 1) {
    await grossInput.fill('10,27');
    await page.getByRole('button', { name: 'Enregistrer le tube' }).click();
  }
  await expect(page.getByText('3/3')).toBeVisible();
  await page.getByRole('button', { name: 'Analyser 3/3' }).click();

  await expect(page.getByRole('heading', { name: 'Proposition Gold figée et masquée' })).toBeVisible();
  await page.getByRole('button', { name: 'Critère atteint' }).click();
  await page.getByLabel('Réglage que tu appliquerais (facultatif)').fill('5,27');
  await page.getByRole('button', { name: 'Figer ma décision et révéler la Gold' }).click();

  await expect(page.getByRole('heading', { name: 'Critère de démarrage atteint' })).toBeVisible();
  await expect(page.getByText(/ne constitue ni une conformité ni une libération du lot/i)).toBeVisible();

  await page.getByRole('link', { name: 'Historique' }).click();
  await expect(page.getByRole('heading', { name: 'Historique des réglages' })).toBeVisible();
  await expect(page.getByText('Produit A · Remplisseuse 1')).toBeVisible();
  await expect(page.getByText('LOT-TEST-A', { exact: false })).toBeVisible();

  await page.getByRole('link', { name: 'Sauvegarde' }).click();
  const exportSection = page.getByRole('heading', { name: 'Créer une sauvegarde' }).locator('..').locator('..');
  await exportSection.getByLabel('Phrase du fichier').fill('export-gold-test-2026');
  await exportSection.getByLabel('Confirmation').fill('export-gold-test-2026');
  const downloadPromise = page.waitForEvent('download');
  await exportSection.getByRole('button', { name: 'Exporter le coffre' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^protocap-remplissage-.*\.json$/);
  await expect(page.getByText(/Sauvegarde chiffrée créée et contrôlée/i)).toBeVisible();
});
