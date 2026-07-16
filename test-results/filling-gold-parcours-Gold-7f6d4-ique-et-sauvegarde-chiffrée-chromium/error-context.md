# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: filling-gold.spec.ts >> parcours Gold shadow complet, historique et sauvegarde chiffrée
- Location: e2e/filling-gold.spec.ts:63:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('Résolution', { exact: true }).first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "Retour à ShiftGuide" [ref=e6] [cursor=pointer]:
          - /url: /shiftguide/modules
          - img [ref=e7]
        - generic [ref=e10]:
          - paragraph [ref=e11]: Assistant remplissage
          - generic [ref=e12]:
            - generic [ref=e13]: Gold personnelle
            - generic [ref=e14]: ·
            - generic [ref=e15]:
              - img [ref=e16]
              - text: connecté
        - button "Verrouiller" [ref=e20] [cursor=pointer]:
          - img [ref=e21]
          - generic [ref=e25]: Verrouiller
      - navigation [ref=e26]:
        - link "Réglage" [ref=e27] [cursor=pointer]:
          - /url: /shiftguide/remplissage
          - img [ref=e28]
          - text: Réglage
        - link "Profils" [ref=e31] [cursor=pointer]:
          - /url: /shiftguide/remplissage/profils
          - img [ref=e32]
          - text: Profils
        - link "Historique" [ref=e35] [cursor=pointer]:
          - /url: /shiftguide/remplissage/historique
          - img [ref=e36]
          - text: Historique
        - link "Sauvegarde" [ref=e39] [cursor=pointer]:
          - /url: /shiftguide/remplissage/sauvegarde
          - img [ref=e40]
          - text: Sauvegarde
    - main [ref=e44]:
      - generic [ref=e45]:
        - generic [ref=e47]:
          - paragraph [ref=e48]: Données de référence
          - heading "Créer un profil de réglage" [level=1] [ref=e49]
          - paragraph [ref=e50]: Chaque bloc conserve sa source. Un profil réel n’est activable que lorsqu’il est complet et vérifié par toi.
        - generic [ref=e51]:
          - generic [ref=e52]:
            - heading "Identification" [level=2] [ref=e53]
            - paragraph [ref=e54]: Ce libellé représente une combinaison machine–produit–tube–contrôle.
            - generic [ref=e55]:
              - generic [ref=e56]:
                - text: Nom du profil
                - textbox "Nom du profil" [ref=e57]: Produit A · Tube 5 mL · Machine 1
              - generic [ref=e58]:
                - text: Version
                - textbox "Version" [ref=e59]: "1"
              - generic [ref=e60]:
                - text: Statut
                - combobox "Statut" [ref=e61]:
                  - option "Brouillon / simulation"
                  - option "Vérifié par moi — réglage réel" [selected]
                  - option "Obsolète"
              - generic [ref=e62]: « Vérifié par moi » signifie que tu as contrôlé les valeurs dans tes sources. Ce n’est pas une approbation Qualité institutionnelle.
          - generic [ref=e63]:
            - heading "Machine" [level=2] [ref=e64]
            - paragraph [ref=e65]: Unité réellement saisie ou position réellement appliquée sur la remplisseuse.
            - generic [ref=e66]:
              - generic [ref=e67]:
                - text: Machine
                - textbox "Machine" [active] [ref=e68]: Remplisseuse 1
              - generic [ref=e69]:
                - text: Ligne
                - textbox "Ligne" [ref=e70]
              - generic [ref=e71]:
                - text: Type de consigne
                - combobox "Type de consigne" [ref=e72]:
                  - option "Volume"
                  - option "Masse NETTE" [selected]
                  - option "Masse BRUTE"
                  - option "Mécanique"
              - generic [ref=e73]:
                - text: Unité machine
                - combobox "Unité machine" [ref=e74]:
                  - option "mL"
                  - option "g" [selected]
                  - option "graduation"
                  - option "tour"
                  - option "mm"
                  - option "seconde"
              - generic [ref=e75]:
                - text: Résolution
                - generic [ref=e76]:
                  - textbox "Résolution g" [ref=e77]: "0.1"
                  - generic [ref=e78]: g
              - generic [ref=e79]:
                - text: Minimum
                - generic [ref=e80]:
                  - textbox "Minimum g" [ref=e81]: "0"
                  - generic [ref=e82]: g
              - generic [ref=e83]:
                - text: Maximum
                - generic [ref=e84]:
                  - textbox "Maximum g" [ref=e85]: "100"
                  - generic [ref=e86]: g
              - generic [ref=e87]:
                - text: Politique d’arrondi
                - combobox "Politique d’arrondi" [ref=e88]:
                  - option "Au plus proche, demi vers le haut" [selected]
                  - option "Au plus proche, demi pair"
                  - option "Vers +∞"
                  - option "Vers −∞"
                  - option "Vers zéro"
                  - option "À l’opposé de zéro"
              - generic [ref=e89]:
                - text: Sens d’augmentation
                - combobox "Sens d’augmentation" [ref=e90]:
                  - option "Valeur plus élevée"
                  - option "Valeur plus basse"
                  - option "Sens horaire" [selected]
                  - option "Sens antihoraire"
              - generic [ref=e91]:
                - text: Source machine
                - textbox "Source machine" [ref=e92]
          - generic [ref=e93]:
            - heading "Produit" [level=2] [ref=e94]
            - paragraph [ref=e95]: La valeur appelée densité doit être une masse volumique en g/mL.
            - generic [ref=e96]:
              - generic [ref=e97]:
                - text: Article / SKU
                - textbox "Article / SKU" [ref=e98]
              - generic [ref=e99]:
                - text: Désignation
                - textbox "Désignation" [ref=e100]
              - generic [ref=e101]:
                - text: Cible approuvée
                - generic [ref=e102]:
                  - textbox "Cible approuvée mL" [ref=e103]
                  - generic [ref=e104]: mL
              - generic [ref=e105]:
                - text: Masse volumique
                - generic [ref=e106]:
                  - 'textbox "Masse volumique g/mL Une saisie proche de 1019 doit être refusée : vérifier 1,019." [ref=e107]'
                  - generic [ref=e108]: g/mL
                - generic [ref=e109]: "Une saisie proche de 1019 doit être refusée : vérifier 1,019."
              - generic [ref=e110]:
                - text: Plage plausible minimale
                - generic [ref=e111]:
                  - textbox "Plage plausible minimale g/mL Barrière de saisie à confirmer pour cette famille de produit." [ref=e112]: "0.5"
                  - generic [ref=e113]: g/mL
                - generic [ref=e114]: Barrière de saisie à confirmer pour cette famille de produit.
              - generic [ref=e115]:
                - text: Plage plausible maximale
                - generic [ref=e116]:
                  - textbox "Plage plausible maximale g/mL" [ref=e117]: "2"
                  - generic [ref=e118]: g/mL
              - generic [ref=e119]:
                - text: Température de référence
                - generic [ref=e120]:
                  - textbox "Température de référence °C" [ref=e121]: "20"
                  - generic [ref=e122]: °C
              - generic [ref=e123]:
                - text: Source produit / densité
                - textbox "Source produit / densité" [ref=e124]
          - generic [ref=e125]:
            - heading "Tube et tare" [level=2] [ref=e126]
            - paragraph [ref=e127]: Décrire exactement les composants présents lors de la pesée.
            - generic [ref=e128]:
              - generic [ref=e129]:
                - text: Profil tube
                - textbox "Profil tube" [ref=e130]
              - generic [ref=e131]:
                - text: Code format
                - textbox "Code format" [ref=e132]
              - generic [ref=e133]:
                - text: Composants inclus
                - textbox "Composants inclus" [ref=e134]: tube, bouchon
              - generic [ref=e135]:
                - text: État à la pesée
                - textbox "État à la pesée" [ref=e136]: tube rempli complet
              - generic [ref=e137]:
                - text: Méthode de tare
                - combobox "Méthode de tare" [ref=e138]:
                  - option "Fixe / moyenne" [selected]
                  - option "Appariée par tube"
                  - option "Destructive"
              - generic [ref=e139]:
                - text: Tare moyenne
                - generic [ref=e140]:
                  - textbox "Tare moyenne g" [ref=e141]
                  - generic [ref=e142]: g
              - generic [ref=e143]:
                - text: Nombre de tubes tare
                - generic [ref=e144]:
                  - textbox "Nombre de tubes tare tubes" [ref=e145]: "20"
                  - generic [ref=e146]: tubes
              - generic [ref=e147]:
                - text: Écart-type tare
                - generic [ref=e148]:
                  - textbox "Écart-type tare g Facultatif mais recommandé." [ref=e149]
                  - generic [ref=e150]: g
                - generic [ref=e151]: Facultatif mais recommandé.
              - generic [ref=e152]:
                - text: Source tare
                - textbox "Source tare" [ref=e153]
          - generic [ref=e154]:
            - heading "Plan de démarrage" [level=2] [ref=e155]
            - paragraph [ref=e156]: Ces valeurs doivent venir de la procédure applicable, jamais du développeur.
            - generic [ref=e157]:
              - generic [ref=e158]:
                - text: Nom du plan
                - textbox "Nom du plan" [ref=e159]: Démarrage
              - generic [ref=e160]:
                - text: Taille échantillon
                - generic [ref=e161]:
                  - textbox "Taille échantillon tubes" [ref=e162]
                  - generic [ref=e163]: tubes
              - generic [ref=e164]:
                - text: Base du critère
                - combobox "Base du critère" [ref=e165]:
                  - option "Masse NETTE" [selected]
                  - option "Masse BRUTE"
                  - option "Volume estimé"
              - generic [ref=e166]:
                - text: Écart moyen inférieur admis
                - generic [ref=e167]:
                  - textbox "Écart moyen inférieur admis g" [ref=e168]
                  - generic [ref=e169]: g
              - generic [ref=e170]:
                - text: Écart moyen supérieur admis
                - generic [ref=e171]:
                  - textbox "Écart moyen supérieur admis g" [ref=e172]
                  - generic [ref=e173]: g
              - generic [ref=e174]:
                - text: Zone sans correction
                - generic [ref=e175]:
                  - textbox "Zone sans correction g" [ref=e176]: "0"
                  - generic [ref=e177]: g
              - generic [ref=e178]:
                - text: Écart-type maximal
                - generic [ref=e179]:
                  - textbox "Écart-type maximal g Vide si la procédure n’en définit pas." [ref=e180]
                  - generic [ref=e181]: g
                - generic [ref=e182]: Vide si la procédure n’en définit pas.
              - generic [ref=e183]:
                - text: Étendue maximale
                - generic [ref=e184]:
                  - textbox "Étendue maximale g Vide si non applicable." [ref=e185]
                  - generic [ref=e186]: g
                - generic [ref=e187]: Vide si non applicable.
              - generic [ref=e188]:
                - text: Limite individuelle basse
                - generic [ref=e189]:
                  - textbox "Limite individuelle basse g" [ref=e190]
                  - generic [ref=e191]: g
              - generic [ref=e192]:
                - text: Limite individuelle haute
                - generic [ref=e193]:
                  - textbox "Limite individuelle haute g" [ref=e194]
                  - generic [ref=e195]: g
              - generic [ref=e196]:
                - text: Nombre maximal hors limites
                - generic [ref=e197]:
                  - textbox "Nombre maximal hors limites tubes" [ref=e198]
                  - generic [ref=e199]: tubes
              - generic [ref=e200]:
                - text: Correction maximale
                - generic [ref=e201]:
                  - textbox "Correction maximale g net" [ref=e202]
                  - generic [ref=e203]: g net
              - generic [ref=e204]:
                - text: Itérations maximales
                - generic [ref=e205]:
                  - textbox "Itérations maximales cycles" [ref=e206]: "5"
                  - generic [ref=e207]: cycles
              - generic [ref=e208]:
                - text: Source du plan
                - textbox "Source du plan" [ref=e209]
          - generic [ref=e210]:
            - heading "Instrument" [level=2] [ref=e211]
            - paragraph [ref=e212]: La balance doit être identifiable et utilisable selon la procédure.
            - generic [ref=e213]:
              - generic [ref=e214]:
                - text: Balance
                - textbox "Balance" [ref=e215]
              - generic [ref=e216]:
                - text: Numéro / alias
                - textbox "Numéro / alias" [ref=e217]
              - generic [ref=e218]:
                - text: Résolution
                - generic [ref=e219]:
                  - textbox "Résolution g" [ref=e220]: "0.01"
                  - generic [ref=e221]: g
              - generic [ref=e222]:
                - text: Minimum
                - generic [ref=e223]:
                  - textbox "Minimum g" [ref=e224]: "0"
                  - generic [ref=e225]: g
              - generic [ref=e226]:
                - text: Maximum
                - generic [ref=e227]:
                  - textbox "Maximum g" [ref=e228]
                  - generic [ref=e229]: g
              - generic [ref=e230]:
                - text: Statut de vérification
                - combobox "Statut de vérification" [ref=e231]:
                  - option "Valide"
                  - option "À confirmer" [selected]
                  - option "Expirée"
                  - option "Échec / interdite"
              - generic [ref=e232]:
                - text: Valide jusqu’au
                - textbox "Valide jusqu’au" [ref=e233]
              - generic [ref=e234]:
                - text: Source instrument
                - textbox "Source instrument" [ref=e235]
          - generic [ref=e236]:
            - button "Annuler" [ref=e237] [cursor=pointer]:
              - img [ref=e238]
              - text: Annuler
            - button "Vérifier et enregistrer" [ref=e241] [cursor=pointer]:
              - img [ref=e242]
              - text: Vérifier et enregistrer
  - status [ref=e244]:
    - generic [ref=e245]:
      - img [ref=e247]
      - generic [ref=e254]:
        - paragraph [ref=e255]: Application disponible hors ligne
        - paragraph [ref=e256]: Les écrans déjà mis en cache restent accessibles sans réseau. L’ouverture ShiftGuide peut néanmoins demander une session serveur valide.
      - button "Fermer la notification" [ref=e257] [cursor=pointer]:
        - img [ref=e258]
```

# Test source

```ts
  1   | import { expect, test } from '@playwright/test';
  2   | 
  3   | const ACCESS_CODE = 'atelier-42';
  4   | const VAULT_PASSPHRASE = 'coffre-local-test-2026';
  5   | 
  6   | async function unlockShiftGuideAndVault(page: import('@playwright/test').Page) {
  7   |   await page.goto('/shiftguide/remplissage');
  8   |   await expect(page.getByRole('heading', { name: 'ShiftGuide' })).toBeVisible();
  9   |   await page.getByLabel("Code d'accès").fill(ACCESS_CODE);
  10  |   await page.getByRole('button', { name: 'Déverrouiller' }).click();
  11  | 
  12  |   await expect(page.getByRole('heading', { name: 'Créer le coffre local' })).toBeVisible();
  13  |   await page.getByLabel('Phrase secrète locale').fill(VAULT_PASSPHRASE);
  14  |   await page.getByLabel('Confirmer la phrase').fill(VAULT_PASSPHRASE);
  15  |   await page.getByRole('button', { name: 'Créer et ouvrir le coffre' }).click();
  16  |   await expect(page.getByRole('heading', { name: 'Préparer et converger sans confusion' })).toBeVisible();
  17  | }
  18  | 
  19  | async function createVerifiedProfile(page: import('@playwright/test').Page) {
  20  |   await page.getByRole('link', { name: 'Profils' }).click();
  21  |   await page.getByRole('button', { name: 'Nouveau profil' }).click();
  22  | 
  23  |   await page.getByLabel('Nom du profil').fill('Produit A · Tube 5 mL · Machine 1');
  24  |   await page.getByLabel('Statut', { exact: true }).selectOption('verified_by_me');
  25  | 
  26  |   await page.getByLabel('Machine', { exact: true }).fill('Remplisseuse 1');
  27  |   await page.getByLabel('Type de consigne').selectOption('net_mass');
> 28  |   await page.getByLabel('Résolution', { exact: true }).first().fill('0,01');
      |                                                                ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  29  |   await page.getByLabel('Source machine').fill('Notice machine M1');
  30  | 
  31  |   await page.getByLabel('Article / SKU').fill('SKU-A');
  32  |   await page.getByLabel('Désignation').fill('Produit A');
  33  |   await page.getByLabel('Cible approuvée').fill('5,17');
  34  |   await page.getByLabel('Masse volumique').fill('1,019');
  35  |   await page.getByLabel('Source produit / densité').fill('Fiche produit A');
  36  | 
  37  |   await page.getByLabel('Profil tube').fill('Tube 5 mL');
  38  |   await page.getByLabel('Code format').fill('T5');
  39  |   await page.getByLabel('Tare moyenne').fill('5,00');
  40  |   await page.getByLabel('Source tare').fill('Étude tare T5');
  41  | 
  42  |   await page.getByLabel('Taille échantillon').fill('3');
  43  |   await page.getByLabel('Écart moyen inférieur admis').fill('0,05');
  44  |   await page.getByLabel('Écart moyen supérieur admis').fill('0,05');
  45  |   await page.getByLabel('Zone sans correction').fill('0,01');
  46  |   await page.getByLabel('Limite individuelle basse').fill('0,20');
  47  |   await page.getByLabel('Limite individuelle haute').fill('0,20');
  48  |   await page.getByLabel('Nombre maximal hors limites').fill('0');
  49  |   await page.getByLabel('Correction maximale').fill('0,50');
  50  |   await page.getByLabel('Source du plan').fill('Procédure démarrage A');
  51  | 
  52  |   await page.getByLabel('Balance').fill('Balance 1');
  53  |   await page.getByLabel('Numéro / alias').fill('BAL-001');
  54  |   await page.getByLabel('Maximum', { exact: true }).last().fill('500');
  55  |   await page.getByLabel('Statut de vérification').selectOption('valid');
  56  |   await page.getByLabel('Valide jusqu’au').fill('2027-12-31');
  57  |   await page.getByLabel('Source instrument').fill('Registre métrologie');
  58  | 
  59  |   await page.getByRole('button', { name: 'Vérifier et enregistrer' }).click();
  60  |   await expect(page.getByText('Réel activé')).toBeVisible();
  61  | }
  62  | 
  63  | test('parcours Gold shadow complet, historique et sauvegarde chiffrée', async ({ page }) => {
  64  |   await unlockShiftGuideAndVault(page);
  65  |   await createVerifiedProfile(page);
  66  | 
  67  |   await page.getByRole('link', { name: 'Réglage', exact: true }).click();
  68  |   await page.getByLabel('Profil').selectOption({ label: 'Produit A · Tube 5 mL · Machine 1' });
  69  |   await page.getByLabel('Ordre / OC (facultatif)').fill('OC-TEST-001');
  70  |   await page.getByLabel('Lot (facultatif)').fill('LOT-TEST-A');
  71  |   await page.getByRole('button', { name: 'Commencer' }).click();
  72  | 
  73  |   await expect(page.getByText('Contexte figé')).toBeVisible();
  74  |   await expect(page.getByText('5,27 g', { exact: false }).first()).toBeVisible();
  75  |   await page.getByRole('button', { name: 'J’ai appliqué ce réglage' }).click();
  76  | 
  77  |   const grossInput = page.getByLabel('Masse BRUTE du tube');
  78  |   for (let index = 0; index < 3; index += 1) {
  79  |     await grossInput.fill('10,27');
  80  |     await page.getByRole('button', { name: 'Enregistrer le tube' }).click();
  81  |   }
  82  |   await expect(page.getByText('3/3')).toBeVisible();
  83  |   await page.getByRole('button', { name: 'Analyser 3/3' }).click();
  84  | 
  85  |   await expect(page.getByRole('heading', { name: 'Proposition Gold figée et masquée' })).toBeVisible();
  86  |   await page.getByRole('button', { name: 'Critère atteint' }).click();
  87  |   await page.getByLabel('Réglage que tu appliquerais (facultatif)').fill('5,27');
  88  |   await page.getByRole('button', { name: 'Figer ma décision et révéler la Gold' }).click();
  89  | 
  90  |   await expect(page.getByRole('heading', { name: 'Critère de démarrage atteint' })).toBeVisible();
  91  |   await expect(page.getByText(/ne constitue ni une conformité ni une libération du lot/i)).toBeVisible();
  92  | 
  93  |   await page.getByRole('link', { name: 'Historique' }).click();
  94  |   await expect(page.getByRole('heading', { name: 'Historique des réglages' })).toBeVisible();
  95  |   await expect(page.getByText('Produit A · Remplisseuse 1')).toBeVisible();
  96  |   await expect(page.getByText('LOT-TEST-A', { exact: false })).toBeVisible();
  97  | 
  98  |   await page.getByRole('link', { name: 'Sauvegarde' }).click();
  99  |   const exportSection = page.getByRole('heading', { name: 'Créer une sauvegarde' }).locator('..').locator('..');
  100 |   await exportSection.getByLabel('Phrase du fichier').fill('export-gold-test-2026');
  101 |   await exportSection.getByLabel('Confirmation').fill('export-gold-test-2026');
  102 |   const downloadPromise = page.waitForEvent('download');
  103 |   await exportSection.getByRole('button', { name: 'Exporter le coffre' }).click();
  104 |   const download = await downloadPromise;
  105 |   expect(download.suggestedFilename()).toMatch(/^protocap-remplissage-.*\.json$/);
  106 |   await expect(page.getByText(/Sauvegarde chiffrée créée et contrôlée/i)).toBeVisible();
  107 | });
  108 | 
```