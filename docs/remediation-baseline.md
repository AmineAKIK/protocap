# PR-01 — baseline de remédiation

**Date d'exécution :** 17 septembre 2026  
**Branche :** `docs/remediation-baseline`  
**Parent relu :** `e5adec6d7c656a9dd63cea2a6db2509b23dbdf10`  
**Environnement :** Linux 6.18.44 x86_64, Node v24.19.0, npm 11.9.0  
**Nature de la PR :** documentation, garde-fous et harnais de test; aucun comportement métier ni format utilisateur modifié.

## État initial vérifié

Le 17 septembre 2026, `main` pointait encore exactement sur le commit de référence. Le checkout était propre avant `npm ci`. Le dépôt n'avait donc pas divergé entre l'audit et le début de PR-01.

Six PR étaient ouvertes. Aucune n'a été fusionnée, fermée ou absorbée :

| PR | Objet | Fichiers | Décision PR-01 |
|---|---|---|---|
| #115 | Groupe Dependabot de neuf mises à jour mineures/patch | `package.json`, `package-lock.json` | Examinée. Elle met notamment Playwright 1.62.1 à 1.63.0, mais ne corrige pas Vitest 4.1.10. À rebaser/comparer en PR-02; aucune dépendance modifiée ici. |
| #110 | Séparation des dépendances runtime (WS-08) | packaging, package, test packaging | Hors périmètre; aucun de ses fichiers n'est modifié ici. |
| #12 | `vite-plugin-pwa` 1.3.0 | package et lockfile | Mise à jour majeure hors périmètre. |
| #11 | Vite 8 | package et lockfile | Mise à jour majeure hors périmètre. |
| #10 | Tailwind 4 | package et lockfile | Mise à jour majeure hors périmètre. |
| #9 | React DOM/types 19 | package et lockfile | Mise à jour majeure hors périmètre. |

## Baseline du parent sous Node 24

Ces résultats ont été exécutés localement sur le parent, pas recopiés d'une CI antérieure.

| Commande | Résultat observé |
|---|---|
| `npm ci` | Succès, 643 paquets installés. Avertissements transitoires `source-map@0.8.0-beta.0`, `glob@11.1.0` et configuration npm `http-proxy`; aucune modification du lockfile. |
| `npm run audit:full` | Code 0 au seuil `high`, mais trois vulnérabilités **modérées** via Vitest/@vitest/mocker, GHSA-82fw-gwwq-j7x9. Ce résultat n'est pas « zéro vulnérabilité » et reste F15/PR-02. |
| `npm run audit:prod` | Succès, zéro vulnérabilité de production signalée. |
| Vérification des répertoires générés | Succès: `node_modules`, `dist` et `coverage` ne sont pas suivis. |
| `npm run check` | Succès: syntaxe serveur, 183 tests Node, 31 fichiers/183 tests Vitest, lint et build. Couverture ciblée: 68,82 % statements, 68,87 % branches, 67,66 % functions, 72,05 % lines. |
| `docker version` | Non exécutable: CLI Docker absente (code 127). La construction du conteneur reste à la CI. |
| `npx playwright install chromium webkit` | Échec après les retries: téléchargement Chrome depuis `cdn.playwright.dev` expiré après 30 s à chaque tentative. Aucun navigateur système n'était disponible. |
| Suites Playwright locales | Non exécutées faute de moteurs. Le blocage est environnemental et explicitement conservé; il n'est pas transformé en réussite. |

La Quality Gate GitHub du parent a réussi le 16 septembre 2026 sur ce SHA, y compris les étapes navigateur et Docker ([run 35086164201](https://github.com/AmineAKIK/protocap/actions/runs/35086164201)). C'est une preuve historique distincte, pas un substitut présenté comme exécution locale nouvelle.

## Preuve rouge/verte du harnais

Le test de contrat a d'abord été ajouté sans modifier Playwright, puis exécuté avec une fausse clé fournisseur :

```text
DEEPSEEK_API_KEY=red-phase-sentinel node --test tests/e2eHarness.test.mjs tests/e2eSelection.test.mjs
3 succès, 1 échec — commande observée: node server.mjs; commande exigée: harnais synthétique.
```

Après correction :

```text
DEEPSEEK_API_KEY=green-phase-sentinel SG_SYSTEM_PROMPT=protected-host-value \
  node --test tests/e2eHarness.test.mjs tests/e2eSelection.test.mjs
4 succès, 0 échec.
```

Un démarrage réel du wrapper avec les mêmes valeurs sentinelles a journalisé `deepSeekConfigured: false`. `/api/health` a répondu 200; `/api/ready` a répondu 503 avec `celine: false`, comportement attendu puisque le fournisseur externe est volontairement absent. Le processus a reçu SIGTERM et s'est arrêté proprement.

Un serveur factice a ensuite occupé `127.0.0.1:4173`: Playwright a échoué avant le lancement des tests avec `already used` (code 1). Il n'a donc pas réutilisé silencieusement le processus étranger.

`DEEPSEEK_API_KEY=list-phase-sentinel npx playwright test --list` a découvert **135 tests dans 8 fichiers** sans démarrer de navigateur. Le garde-fou `tests/e2eSelection.test.mjs` échoue désormais si un fichier `e2e/**/*.spec.ts` n'est sélectionné par aucun script `test:e2e*`, ou si un de ces scripts n'est pas appelé par la Quality Gate.

Chaque étape navigateur de la Quality Gate injecte également `DEEPSEEK_API_KEY=e2e-sentinel-must-not-be-used` et une configuration hôte sentinelle. Le parcours Céline critique doit malgré cela observer un fournisseur non configuré; un retour accidentel à l'héritage d'environnement ferait échouer la CI avant toute fusion.

Le nouveau wrapper :

1. exige un marqueur réservé au harnais;
2. supprime toutes les variables héritées avant d'importer le bootstrap serveur;
3. installe une configuration synthétique fermée et une clé fournisseur vide;
4. fixe `TZ=UTC` pour les parcours E2E existants;
5. est toujours lancé comme nouveau processus (`reuseExistingServer: false`);
6. est arrêté explicitement par SIGTERM.

La configuration de production n'est pas modifiée.

## Validation locale du diff PR-01

La chaîne complète a ensuite été rejouée avec `DEEPSEEK_API_KEY=full-check-sentinel` et une configuration hôte sentinelle :

| Contrôle | Résultat |
|---|---|
| `npm run check` | Succès: 191 tests Node, 31 fichiers/183 tests frontend, mêmes seuils de couverture, lint et build de production. |
| `npm run audit:full` | Code 0 au seuil `high`; les trois avis modérés Vitest restent visibles et routés vers PR-02. |
| `npm run audit:prod` | Succès, zéro vulnérabilité signalée. |
| `node scripts/reproduce-temporal-baseline.mjs` | Code 0 et `reproduced: true`; il s'agit toujours d'une caractérisation documentaire. |
| `git diff --check` | Succès, aucune erreur d'espaces ou de patch. |

Le build Docker et les suites navigateur exécutées restent attendus de la Quality Gate GitHub, pour les limitations locales déjà consignées. Les résultats de cette CI devront être rattachés au SHA de la branche dans la PR; ils ne sont pas anticipés dans ce document.

## Inventaire des consommateurs temporels

Commande de recensement : recherche des usages `Date.now`, `new Date`, `Date.parse`, `toISOString`, `toLocale*`, `datetime-local`, `setDate` et timers dans `src`, `server`, `shared` et `scripts`, hors tests. Les données volumineuses purement décoratives de LinePulse ont été exclues de la commande, mais son consommateur UI reste listé.

| Zone | Fichiers consommateurs | Rôle et décision de suivi |
|---|---|---|
| Expiry critique | `src/pages/ExpiryCheckPage.tsx`, `src/utils/date.ts`, `src/utils/expiry.ts`, `src/data/expiryData.ts` | Saisie locale, conversion, jours calendaires, statut et historique. F01–F04/F24; PR-03/04/06. |
| Logistics critique | `src/pages/LogisticsCallPage.tsx`, `src/data/logisticsData.ts` | Création, durée et clôture. F09/F10; PR-07. |
| Packing | `src/pages/PackingCalculatorPage.tsx`, `src/features/packing/components/PackingPlanningRail.tsx`, `PackingRunExecution.tsx`, `packingRunExecutionModel.ts`, `usePackingNow.ts`, `src/features/packing/domain/packingRun.ts`, `src/features/packing/persistence/packingRunStorage.ts`, `src/features/packing/preparation/packingPreparationValidation.ts` | Instants de préparation/run et horloge dédiée déjà durcie. Non-régression T18; PR-03 inventorie, PR-08 vérifie. |
| ShiftGuide client | `src/context/ShiftGuideAuthContext.tsx`, `src/hooks/useShiftGuideAuth.ts`, `src/pages/shiftguide/CelinePage.tsx` | Expiration de session, IDs/horodatages Céline. Données protégées séparées; T19. |
| Serveur/Céline | `server/app.mjs`, `celineAuthority.mjs`, `celineCostGuard.mjs`, `celineOperationalState.mjs`, `celineSemanticIndex.mjs`, `observability.mjs`, `providers/deepSeekProvider.mjs`, `runtimeUtils.mjs` | Sessions, quotas, états opérationnels, télémétrie et délais. Hors correction métier Expiry; conserver les injections d'horloge existantes. |
| Horloges UI partagées | `src/hooks/useNow.ts`, `src/pages/shiftguide/LinePulsePage.tsx` | Rafraîchissement et affichage. `useNow` est concerné par PR-04; LinePulse reste une simulation visuelle. |
| Contrats/validation | `shared/shiftGuideContract.js`, `shared/shiftGuideProgress.js`, `src/utils/publicStorageValidation.ts` | Validation d'instants et métadonnées persistées. Rejouer lors des migrations, sans remplacement global de `toISOString`. |

La preuve temporelle reproductible est dans `scripts/reproduce-temporal-baseline.mjs`; son résultat Node 24 est archivé dans `docs/release-evidence/pr-01-temporal-baseline.json`. Elle montre les trois décalages hors UTC, les durées calendaires 119/121 h et le statut `ok` obtenu malgré une installation future. Ce script caractérise les expressions historiques et n'est pas un test CI qui impose de conserver le défaut.

## Inventaire de persistance

`useLocalStorage` suffixe ses clés en `.v8`. Les clés ci-dessous sont les propriétaires effectifs observés; les identifiants historiques ne doivent pas être renommés par simple correction de marque.

| Jeu de données / clés | Stockage et consommateurs | Écritures / risque | Suite propriétaire |
|---|---|---|---|
| `lineops.expiry.lines.v8`, `lineops.expiry.history.v8` | `localStorage`; `ExpiryCheckPage`, `useLocalStorage`, validation publique | Deux commits séparés; récupération pouvant réécrire l'initial. F06/F07. | PR-05/06 |
| `lineops.logistics.requests.v8` | `localStorage`; `LogisticsCallPage`, `useLocalStorage` | Résultat d'écriture ignoré; hydratation fabrique `completedAt`. F05/F09. | PR-05/07 |
| `lineops.packing.form.inputs.v8` | `localStorage`; `PackingCalculatorPage`, `useLocalStorage` | Le statut de persistance est déjà consommé; préserver les tests de mode dégradé. | PR-05/08 |
| `lineops.packing.active-run.v1`, `lineops.packing.workspace.v1`, sonde `lineops.packing.persistence-probe.v1` | Adaptateur Packing dédié | Révisions, conflits et consentement dégradé déjà spécialisés; ne pas uniformiser aveuglément. | PR-08/T18 |
| `shiftguide_config_revision`, `shiftguide_celine_authority_revision`, `shiftguide_celine_history`, `shiftguide_progress_v1` à `v4`, préfixe `shiftguide_module_`, `shiftguide_context` | Adaptateur persistant résilient ShiftGuide | Progression/configuration non sensible; fallback mémoire signalé. Garder namespaces et révisions. | PR-08/T19 |
| `shiftguide_auth_token`, `shiftguide_data`, `shiftguide_session_expires_at`, `shiftguide_session_config_revision`, `shiftguide_session_celine_authority_revision` | `sessionStorage`; auth ShiftGuide | Données protégées, écriture vérifiée et fail-closed. Exclues de toute récupération/export public. | Non-régression T19 |

Les consommateurs directs ou adaptateurs sont `src/hooks/useLocalStorage.ts`, `src/hooks/useModuleProgress.ts`, `src/hooks/useShiftGuideAuth.ts`, `src/context/ShiftGuideAuthContext.tsx`, `src/features/packing/persistence/packingRunStorage.ts`, `src/features/packing/usePackingActiveRun.ts`, `src/features/shiftguide/shiftGuideStorage.ts`, `src/features/shiftguide/useShiftGuideProgressOverview.ts`, `src/features/shiftguide/useShiftGuideStorageHealth.ts`, `src/features/shiftguide/celineClient.ts`, `src/pages/shiftguide/CelinePage.tsx`, `src/pages/shiftguide/ShiftGuideHome.tsx` et les helpers `shared/shiftGuidePersistence.js` / `shared/shiftGuideProgress.js`. `src/test/setup.ts` ne possède aucune donnée produit; il nettoie les stockages de test.

## Angles de tests existants et manquants

| Zone | Preuve existante au parent | Manque routé |
|---|---|---|
| Expiry | Tests purs de statut/date seulement | Formulaires, fuseaux, horloge vivante, panne atomique: PR-03/04/06. |
| Logistics | Contrat responsive mobile | Validation, transitions, panne, retry, clôture inconnue: PR-07. |
| Stockage public | Tests du hook et de validation; Packing spécialisé | Contrat non destructif, conflits, version future: PR-05/08. |
| ShiftGuide | Suites unitaires, intégration et E2E critiques riches | Conserver séparation et absence de fournisseur réel: PR-08/09/10. |
| Couverture | Rapport V8 ciblé explicitement documenté | Rapport global et seuils critiques: PR-11. |
| E2E | Huit fichiers explicitement sélectionnés | Garde anti-oubli ajoutée ici; stratégie stable à consolider PR-11. |

## État des scénarios obligatoires de PR-01

| Test | État PR-01 | Preuve |
|---|---|---|
| T29 | Vérifié au niveau contrat et démarrage serveur | Sentinelles supprimées; fournisseur absent; aucune requête métier externe. |
| T31 | Vérifié pour le harnais; politique adoptée pour les PR suivantes | Exécution rouge 3/4 puis verte 4/4 sur le même test. |
| T38 | Vérifié statiquement et par découverte Playwright | 8/8 fichiers sélectionnés; 135 tests listés; garde CI automatique. |
| T39 | Vérifié pour configuration, démarrage, refus de réutilisation et arrêt; exécution navigateur locale bloquée | Test de config + smoke serveur. Les moteurs seront exécutés par la Quality Gate de la PR. |

## Limites conservées

- Docker et les navigateurs ne sont pas disponibles dans cet environnement local; les étapes correspondantes doivent rester visibles dans la CI de la PR.
- PR-01 ne corrige ni les dates, ni la persistance métier, ni Vitest. Les constats restent ouverts selon `docs/remediation-plan.md`.
- La readiness Céline du profil E2E reste rouge sans fournisseur; le parcours critique teste précisément le fallback déterministe, pas une intégration externe.
- Aucun état utilisateur n'est migré. Le retour arrière de PR-01 consiste uniquement à revenir sur les documents, tests et harnais; cette preuve de baseline doit rester consultable.
