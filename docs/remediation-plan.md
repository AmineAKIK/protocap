# ProtoCap — contrat de remédiation

**Version canonique :** 1.0 — 17 septembre 2026  
**Dépôt :** `AmineAKIK/protocap`  
**Référence initiale :** `e5adec6d7c656a9dd63cea2a6db2509b23dbdf10`  
**Programme :** 13 PR, 24 constats ou risques, 45 scénarios d'acceptation  
**Règle de base :** chaque PR repart du nouveau `main`; le SHA ci-dessus est une référence d'audit, pas une base supposée immuable.

Ce document est le contrat d'exécution du programme. Une ligne n'est close qu'avec une correction ou une limite explicite, un test exécuté et une preuve rattachée au bon SHA. Une compilation, un badge vert ou une reformulation ne suffisent pas à clore un défaut métier.

## Décisions invariantes

- **D01 — Jours calendaires.** Conserver la règle existante d'ajout de jours calendaires, la nommer et fixer son fuseau lors de la déclaration. Cinq jours peuvent représenter 119 ou 121 heures autour d'un changement d'heure. Une règle de 120 heures exigerait une décision métier distincte.
- **D02 — Heure locale et instant.** Séparer la valeur `datetime-local`, son fuseau et l'instant UTC enregistré. Rejeter les calendriers impossibles et ne jamais deviner une heure répétée ou inexistante.
- **D03 — Niveau réel de sauvegarde.** Une confirmation décrit exactement une écriture réussie dans ce navigateur. Une copie temporaire, un conflit ou un échec restent visibles et le brouillon est conservé.
- **D04 — Histoire honnête.** Migrer sans inventer d'heure, d'opérateur ou d'intervention et sans effacer les sources. Une clôture inconnue reste inconnue; aucune correction globale `+2 h` n'est autorisée.
- **D05 — Coordination locale bornée.** Les écritures compatibles utilisent relecture, validation, révision et Web Lock. Cela coordonne une même origine, pas plusieurs appareils. Sans coordination fiable, les données durables passent en lecture seule.
- **D06 — Test, démo et protégé séparés.** Les tests et la démo n'utilisent que des fixtures synthétiques et un fournisseur scénarisé. Aucun secret réel n'est requis, hérité ou publié.
- **D07 — Démo distincte.** La démonstration publique utilise une origine isolée; elle ne contourne pas le verrou existant et ne prétend pas mesurer un modèle réel.
- **D08 — Preuve versionnée.** Chaque correction apporte ses tests dans la même PR. Toute preuve mentionne SHA, environnement, date et méthode; historique, simulation et production restent distincts.

## Ordre de livraison

| PR | Objet | Dépendances minimales |
|---|---|---|
| PR-01 | Périmètre, invariants, baseline Node 24 et harnais hermétique | Aucune |
| PR-02 | Avis Vitest et politique de dépendances | PR-01 |
| PR-03 | Contrat temporel et validation avant mutation | PR-01 |
| PR-04 | Actualisation Expiry et indicateurs cohérents | PR-03 |
| PR-05 | Contrat de persistance explicite | PR-01 |
| PR-06 | Agrégat Expiry, historique et migration | PR-03, PR-04, PR-05 |
| PR-07 | Parcours Logistics fiable | PR-05 |
| PR-08 | Consommateurs transverses et concurrence locale | PR-05, PR-06, PR-07 |
| PR-09 | Lancements locaux reproductibles | PR-01, PR-02 |
| PR-10 | Démonstration ShiftGuide publique et isolée | PR-09 |
| PR-11 | Contrôles CI centrés sur les risques | PR-02 à PR-10 |
| PR-12 | Portfolio, noms et preuves exactes | PR-10, PR-11 |
| PR-13 | Recette finale et preuve de publication | PR-01 à PR-12 |

Une PR ne fusionne pas automatiquement une PR existante, ne pousse pas directement sur `main` et ne modifie pas un environnement externe sans étape explicitement autorisée. Les corrections métier, migrations de données et mises à jour générales de dépendances sont exclues de PR-01.

## Traçabilité F01–F24

La colonne « preuve initiale » distingue un défaut observé d'un risque ou d'un jugement de présentation. Aucun constat n'est déclaré corrigé dans cette baseline.

| ID | Constat ou risque | Preuve initiale | PR propriétaires | Tests | Statut après PR-01 |
|---|---|---|---|---|---|
| F01 | Préremplissage UTC utilisé comme heure locale | Code et reproduction isolée | PR-03 | T01, T02 | Vérifié — T01/T02 rejoués dans Quality Gate #818 sur `6c04083b831e97a774f4f2f94a366f45ca07bb93` |
| F02 | Intervention future ou date invalide acceptée; statut insuffisamment prudent | Code et reproduction partielle | PR-03, PR-06 | T03, T04, T05 | Vérifié — T03/T04/T05 rejoués dans Quality Gate #818 |
| F03 | Statuts et compteurs Expiry dépendants du temps sans horloge commune | Code; navigateur à reproduire | PR-04 | T06, T07, T08 | Vérifié — T06/T07/T08 rejoués dans Quality Gate #818 |
| F04 | Sens des jours de validité et cohérence aux changements d'heure | Décision; 119/121 h reproduits, pas une faute prouvée | PR-01, PR-03, PR-04 | T02, T09 | Vérifié — D01/D02 conservées; T02/T09 rejoués dans Quality Gate #818 |
| F05 | Succès et remise à zéro Logistics malgré une écriture dégradée | Code; panne navigateur à injecter | PR-05, PR-07 | T10, T11, T12 | Vérifié — T10/T11/T12 rejoués dans Quality Gate #818 |
| F06 | État Expiry et historique écrits séparément | Code; incohérence possible sous panne | PR-05, PR-06 | T13, T14 | Vérifié — T13/T14 rejoués dans Quality Gate #818 |
| F07 | Récupération corrompue pouvant réécrire les valeurs initiales | Code du hook | PR-05, PR-06, PR-08 | T15, T16 | Vérifié — T15/T16 rejoués dans Quality Gate #818 |
| F08 | Autres consommateurs du stockage partagé et cycles React | Vérification transverse, pas défaut universel affirmé | PR-05, PR-08 | T17, T18, T19 | Vérifié — T17/T18/T19 rejoués dans Quality Gate #818 |
| F09 | Heure de clôture ancienne fabriquée par Logistics | Code | PR-07 | T20 | Vérifié — T20 rejoué dans Quality Gate #818 |
| F10 | Doubles soumissions, identités et transitions | Risques à formaliser | PR-01, PR-06, PR-07, PR-08 | T21, T22, T23 | Vérifié — T21/T22/T23 rejoués dans Quality Gate #818 |
| F11 | Fonctionnalité phare difficile à évaluer sans code | Parcours public à revalider | PR-09, PR-10, PR-12 | T24, T25 | Vérifié — T24/T25 rejoués; démo ShiftGuide isolée validée dans Quality Gate #818 et Live smoke #31 |
| F12 | Démarrage local incomplet et absence de script `start` | Absence revérifiée | PR-09 | T26, T27, T28 | Vérifié — T26/T27/T28 revalidés dans Quality Gate #818 |
| F13 | Chargement d'environnement, proxy et séparation preview/serveur | Contrat incomplet | PR-09 | T27, T28, T29 | Vérifié — T27/T28/T29 revalidés dans Quality Gate #818 |
| F14 | Couverture front limitée à une sélection de fichiers | Configuration constatée; pas absence totale de tests | PR-03 à PR-08, PR-11 | T30, T31 | Vérifié — T30/T31 revalidés; rapports couverture et mutation smoke dans Quality Gate #818 |
| F15 | Avis Vitest GHSA-82fw-gwwq-j7x9 et seuil d'audit | Graphe installé concerné | PR-02, PR-11 | T32, T33 | Vérifié — T32/T33 revalidés; audits full/prod verts dans Quality Gate #818 |
| F16 | Contribution personnelle et preuves peu immédiates | Jugement de présentation | PR-12 | T34 | Vérifié — T34 revalidé dans Quality Gate #818 |
| F17 | Ancien nom visible LineOps Toolkit | Premier audit; balayage à faire | PR-12 | T35 | Vérifié — T35 revalidé dans Quality Gate #818; clés historiques préservées |
| F18 | Promesses d'interface et preuves historiques à aligner | Logistics constaté; audit transverse | PR-04, PR-07, PR-10, PR-12 | T36, T37 | Vérifié — T36/T37 revalidés dans Quality Gate #818 |
| F19 | Nouveaux E2E potentiellement oubliés par les scripts explicites | Risque déduit, pas oubli reproduit | PR-01, PR-11 | T38 | Vérifié — T38 revalidé; manifeste E2E et zéro-test fail-closed dans Quality Gate #818 |
| F20 | E2E héritant de l'environnement et réutilisant un serveur | Configuration constatée | PR-01, PR-09, PR-11 | T29, T39 | Vérifié — T29/T39 revalidés; harnais E2E hermétique dans Quality Gate #818 |
| F21 | Concurrence locale, versions et ancien onglet | Durcissement préventif | PR-05, PR-06, PR-08, PR-13 | T23, T40, T41 | Vérifié — T23/T40/T41 rejoués; concurrence, migration/reload et PWA couverts dans Quality Gate #818 |
| F22 | Accessibilité des futures erreurs et modes dégradés | Exigence de non-régression | PR-03, PR-04, PR-06, PR-07, PR-10, PR-11 | T42, T43 | Vérifié — T42/T43 rejoués sur Chromium/mobile/WebKit et axe dans Quality Gate #818 |
| F23 | Commit déployé distinct de la réussite CI | Exigence de clôture | PR-13 | T44, T45 | En cours — pré-merge validé par Quality Gate #818, CodeQL #517 et Live smoke #31; corrélation du SHA de merge Railway requise après fusion |
| F24 | Dates historiques non réparables par décalage global fiable | Limite de récupérabilité | PR-03, PR-06, PR-12 | T14, T16, T37 | Vérifié — T14/T16/T37 confirment la limite: aucune correction globale arbitraire; sources historiques conservées |

## Catalogue d'acceptation T01–T45

| Test | Résultat attendu |
|---|---|
| T01 | Aller-retour à la minute sans décalage en UTC, Europe/Paris été/hiver et America/New_York. |
| T02 | Heure DST inexistante rejetée; heure répétée désambiguïsée; fuseau visible. |
| T03 | Date vide, calendrier invalide, valeur hors plage ou manipulée rejetés avant mutation. |
| T04 | Intervention future refusée sans changer état ni historique; brouillon conservé. |
| T05 | Donnée incohérente, élément absent ou installation future jamais conforme par défaut. |
| T06 | Passage de 48 h puis expiration sans interaction; tous les indicateurs concordent. |
| T07 | Retour de visibilité, focus et réveil recalculent; écouteurs et timers nettoyés. |
| T08 | Formulaire ancien ou mise à jour concurrente revalidés sur l'état et l'heure courants. |
| T09 | Jours calendaires explicites et barre fondée sur les instants réels, dont 119 h et 121 h. |
| T10 | Pannes `getItem`, `setItem`, quota, sérialisation et accès donnent un résultat typé sans faux succès. |
| T11 | Échec Logistics: champs conservés, erreur accessible, aucune confirmation. |
| T12 | Reprise et double clic sur Réessayer ne confirment qu'une mutation. |
| T13 | Remplacement/recharge Expiry change état et trace ensemble, ou aucun. |
| T14 | Migration des deux clés Expiry v8 idempotente, reprenable et avec sources préservées. |
| T15 | JSON invalide, schéma inconnu ou version future sans réécriture destructive ni faux historique. |
| T16 | Dates suspectes et événements orphelins visibles sans correction globale `+2 h`. |
| T17 | StrictMode, montage/démontage et changement de clé sans écriture initiale parasite. |
| T18 | Parcours Packing et consentement dégradé préservés. |
| T19 | Session, logout, révisions, progression et mémoire Céline séparés des données publiques. |
| T20 | Demande clôturée sans `completedAt` conserve une heure inconnue et ne produit aucun KPI inventé. |
| T21 | Double soumission, horodatages identiques et retry gardent des identités stables sans doublon. |
| T22 | Transitions Logistics autorisées/interdites couvertes; terminaux stables; annulation confirmée. |
| T23 | Deux onglets compatibles préservent leurs opérations; verrou annulable; absence de Web Locks explicite. |
| T24 | Démo découvrable depuis README et verrou sans demander de secret. |
| T25 | Succès, clarification, inconnue et indisponibilité scénarisés et annoncés comme simulation. |
| T26 | Checkout neuf, Node 24, `npm ci` et démo complète sans clé privée. |
| T27 | Développement complet, port occupé, `Ctrl+C` et liaison loopback vérifiés. |
| T28 | `npm start`, variables, erreurs de configuration et absence de fuite vérifiés après PR-09. |
| T29 | Environnement empoisonné par une sentinelle sans appel à un fournisseur réel. |
| T30 | Rapport front réellement global, périmètre et exclusions documentés. |
| T31 | Tests métier dans chaque PR et preuve rouge/verte sur le parent. |
| T32 | Avis connu absent du graphe installé; production auditée séparément. |
| T33 | Exception éventuelle spécifique, attribuée, motivée et expirante. |
| T34 | Rôle, arbitrages, démo et mesures sourcés sans statistique inventée. |
| T35 | Noms, liens, titres et métadonnées canoniques sans renommer les clés historiques. |
| T36 | Libellés exacts: local, non sauvegardé, simulation, validité estimée. |
| T37 | Documentation courante distincte des anciennes preuves et rattachée au bon SHA. |
| T38 | Chaque nouveau E2E est sélectionné et exécuté; zéro test inattendu échoue. |
| T39 | Serveur E2E identifiable, jamais réutilisé, processus et stockage isolés, aucun accès métier externe. |
| T40 | Migration, reload et mise à jour PWA sans reset ni prolongation silencieuse. |
| T41 | Retour arrière de schéma exécuté ou interdit avec récupération/forward fix documenté. |
| T42 | Clavier, focus, `aria-invalid`, descriptions et annonces accessibles, non répétitives. |
| T43 | Chromium desktop/mobile et WebKit ciblés sans débordement ni régression d'accessibilité. |
| T44 | SHA `main`, CI, image/déploiement et santé corrélés sans données sensibles. |
| T45 | Smoke public lecture seule, démo/protégé, PDF/PWA, hors ligne et liens vérifiés. |

## Contrat d'exécution d'une PR

Avant de coder, relever HEAD, état local et PR ouvertes; rejouer la preuve du défaut sur le parent ou qualifier honnêtement le travail de préventif. Décider migration et retour arrière avant tout changement de format.

Pendant la PR, garder une intention principale. Le test de régression accompagne la correction. Il est interdit de supprimer une assertion, baisser un seuil, augmenter arbitrairement un timeout ou désactiver un contrôle pour obtenir du vert.

Tout fichier `e2e/**/*.spec.ts` ajouté doit être sélectionné par un script `test:e2e*` et ce script doit être appelé par `.github/workflows/ci.yml` dans la même PR. `tests/e2eSelection.test.mjs` rend cet oubli bloquant.

Avant fusion, exécuter `npm run check`, les suites navigateur du périmètre et les audits pertinents. Une preuve indique le SHA et distingue automatisé, manuel, simulé et live. Un résultat non exécuté reste « non exécuté ».

Après fusion, relire le nouveau `main`. Pour une modification runtime ou UI, vérifier le commit réellement déployé et les probes; pour une PR documentaire, marquer cette étape non applicable avec motif.

Le modèle détaillé de compte rendu est intégré au template de pull request. Les migrations PR-06/PR-08 ne peuvent pas annoncer qu'un simple `git revert` suffit sans preuve qu'un ancien lecteur comprend les nouvelles données.
