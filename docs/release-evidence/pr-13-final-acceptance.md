# PR-13 — recette finale et preuve de publication

**Date :** 20 septembre 2026  
**Branche :** `chore/remediation-release-evidence`  
**Base :** `7bf55feac505687bf011bf999ce132e0af7aa462` (main après PR-12)  
**Objet :** exécuter T01–T45, corréler le déploiement réel et fermer F01–F24 uniquement avec preuve.

## État au démarrage

Le `main` de départ est déjà publié sur les deux services Railway :

| Service | Déploiement | SHA | Statut |
| --- | --- | --- | --- |
| `protocap` | `94bd9d9f-f2a1-498c-8314-3e6e6301de2c` | `7bf55feac505687bf011bf999ce132e0af7aa462` | SUCCESS |
| `protocap-demo` | `f22a333c-664c-4eb3-966a-0a95bcbbf23c` | `7bf55feac505687bf011bf999ce132e0af7aa462` | SUCCESS |

Les deux services suivent `AmineAKIK/protocap:main`, utilisent `/api/ready` comme healthcheck avec 60 s de délai, et exposent des domaines Railway distincts. Cette corrélation prouve l’état publié **avant PR-13** ; elle ne suffira pas à clore T44 après le merge PR-13.

## Méthode finale

- **Automatisé / PR SHA :** Quality Gate + CodeQL + suite Live smoke sur le SHA exact de PR-13.
- **Simulé / navigateur :** suites Playwright hermétiques avec données synthétiques, aucun fournisseur externe.
- **Live / lecture seule :** uniquement des requêtes GET sur les origines publiques ; aucun secret, aucun unlock, aucune création de session démo, aucun appel Céline.
- **Post-merge :** corrélation du SHA `main` fusionné avec les deux déploiements Railway puis relecture des probes publiques.

## Recette T01–T45

Le tableau ci-dessous nomme la preuve propriétaire. Le candidat fonctionnel `6c04083b831e97a774f4f2f94a366f45ca07bb93` a été revalidé par Quality Gate #818 (succès), CodeQL #517 (succès) et Live smoke #31 (succès). Le commit documentaire qui enregistre cette clôture doit lui-même repasser les mêmes contrôles avant merge.

| Test | Méthode / preuve propriétaire | Statut pré-merge |
| --- | --- | --- |
| T01 | `e2e/expiry-time.spec.ts`, `src/features/expiry/time.test.ts` | Vérifié — Quality Gate #818 |
| T02 | Expiry DST/unit + navigateur multi-fuseaux | Vérifié — Quality Gate #818 |
| T03 | validation Expiry/packing avant mutation | Vérifié — Quality Gate #818 |
| T04 | Expiry futur refusé + brouillon conservé | Vérifié — Quality Gate #818 |
| T05 | état temporel inconnu / incomplet non conforme par défaut | Vérifié — Quality Gate #818 |
| T06 | live refresh Expiry à 48 h / expiration | Vérifié — Quality Gate #818 |
| T07 | visibilité/focus/réveil + cleanup | Vérifié — Quality Gate #818 |
| T08 | revalidation état/horloge au submit | Vérifié — Quality Gate #818 |
| T09 | jours calendaires 119 h / 121 h | Vérifié — Quality Gate #818 |
| T10 | pannes stockage typées sans faux succès | Vérifié — Quality Gate #818 |
| T11 | création Logistics dégradée, brouillon conservé | Vérifié — Quality Gate #818 |
| T12 | retry idempotent / double clic | Vérifié — Quality Gate #818 |
| T13 | agrégat Expiry atomique état + historique | Vérifié — Quality Gate #818 |
| T14 | migration Expiry v8/v1 idempotente et sources intactes | Vérifié — Quality Gate #818 |
| T15 | JSON invalide / version future sans réécriture destructive | Vérifié — Quality Gate #818 |
| T16 | dates suspectes visibles sans correction globale | Vérifié — Quality Gate #818 |
| T17 | StrictMode/montage/changement de clé sans écriture parasite | Vérifié — Quality Gate #818 |
| T18 | Packing + consentement dégradé | Vérifié — Quality Gate #818 |
| T19 | ShiftGuide session/logout/révisions/progression/Céline séparés | Vérifié — Quality Gate #818 |
| T20 | Logistics historique sans `completedAt` n’invente pas d’heure | Vérifié — Quality Gate #818 |
| T21 | identités stables sous double submit/retry | Vérifié — Quality Gate #818 |
| T22 | matrice complète des transitions Logistics | Vérifié — Quality Gate #818 |
| T23 | `e2e/local-concurrency.spec.ts` : deux onglets, verrou annulable, absence Web Locks | Vérifié — Quality Gate #818 |
| T24 | `e2e/public-demo.spec.ts` : démo découvrable sans secret | Vérifié — Quality Gate #818 |
| T25 | démo : succès/clarification/inconnue/indisponibilité scénarisés | Vérifié — Quality Gate #818 |
| T26 | Node 24 + install + démo synthétique | Vérifié — Quality Gate #818 |
| T27 | lanceur dev complet, loopback, port occupé, signaux | Vérifié — Quality Gate #818 |
| T28 | `npm start`, configuration et erreurs sûres | Vérifié — Quality Gate #818 |
| T29 | harnais empoisonné sans fournisseur externe | Vérifié — Quality Gate #818 |
| T30 | couverture front globale + périmètre documenté | Vérifié — Quality Gate #818 |
| T31 | tests métier + seuils critiques + mutation smoke | Vérifié — Quality Gate #818 |
| T32 | audits graphe complet / production | Vérifié — Quality Gate #818 |
| T33 | politique d’exception bornée et expirante | Vérifié — Quality Gate #818 |
| T34 | portfolio sourcé sans métrique inventée | Vérifié — Quality Gate #818 |
| T35 | identité ProtoCap/ShiftGuide/Céline, clés historiques intactes | Vérifié — Quality Gate #818 |
| T36 | libellés local/non sauvegardé/simulation/validité estimée | Vérifié — Quality Gate #818 |
| T37 | docs courantes séparées des preuves historiques | Vérifié — Quality Gate #818 |
| T38 | manifeste E2E exhaustif, zéro test = échec | Vérifié — Quality Gate #818 |
| T39 | serveurs E2E hermétiques, pas de réutilisation ni accès métier externe | Vérifié — Quality Gate #818 |
| T40 | migration/reload + deux onglets ; PWA contrôlée par T45 | Vérifié — Quality Gate #818 |
| T41 | ancien lecteur interdit quand incompatible ; forward-fix documenté | Vérifié — Quality Gate #818 |
| T42 | focus/aria/annonces + axe sur modes modifiés | Vérifié — Quality Gate #818 |
| T43 | Chromium desktop/mobile + WebKit ciblé | Vérifié — Quality Gate #818 |
| T44 | Quality Gate/CodeQL + Railway exact SHA + `/api/ready` post-merge | En cours — CI pré-merge verte; déploiement du SHA de merge requis |
| T45 | dual-origin live smoke + PDF/PWA + séparation démo/protégé | Vérifié pré-merge — Quality Gate #818 + Live smoke #31; relecture post-merge requise |

## Preuves CI du candidat fonctionnel

- Quality Gate #818 — succès — SHA `6c04083b831e97a774f4f2f94a366f45ca07bb93` — artefact `quality-evidence-35473630853-1` (ID `10593376922`, rétention 14 jours).
- CodeQL #517 — succès — même SHA.
- Live smoke #31 — succès — même SHA — artefact `live-smoke-35473630959-1` (ID `10593672272`, rétention 14 jours).

Le Quality Gate a exécuté les checks repository, audits, couverture, mutation smoke, build/runtime conteneur et suites Playwright ciblées. Le Live smoke n'a utilisé que des GET sur les deux origines publiques.

## Extension live smoke PR-13

`scripts/live-smoke.mjs` vérifie désormais sans mutation :

### Origine ProtoCap réelle

- `/`
- `/api/health`
- `/api/ready`
- `/api/public-demo`
- `/robots.txt`
- `/manifest.webmanifest`
- `/sw.js`
- le PDF public, avec vérification du magic header `%PDF-`

### Origine ShiftGuide démo

- `/api/health`
- `/api/ready`
- `/api/public-demo`
- `/demo` et ses métadonnées runtime
- manifest ShiftGuide démo
- service worker sans fallback navigation, avec purge de caches
- redirection de `/` et `/rapport` vers l’origine ProtoCap réelle
- PDF ProtoCap absent en 404 sur l’origine démo

Le smoke n’utilise que GET. Il n’appelle ni `/api/shiftguide/unlock`, ni `/api/shiftguide/session`, ni `/api/public-demo/session`, ni `/api/celine/chat`.

## Retour arrière des schémas

Les formats actifs introduits pendant la remédiation ne promettent pas un `git revert` aveugle :

- Expiry : les sources v8/v1 sont conservées ; un lecteur plus ancien ne doit pas réécrire un format actif plus récent.
- Logistics : v8 reste une source immuable ; un lecteur voyant une version future passe en lecture seule.
- Packing : le format spécialisé conserve ses révisions et refuse l’écriture durable quand la coordination requise n’est pas disponible.

La récupération attendue est un **forward-fix capable de lire le format actif**. Le retour arrière vers un lecteur incompatible est explicitement interdit.

## Conditions de clôture

PR-13 ne sera considérée terminée que lorsque :

1. Quality Gate et CodeQL sont verts sur le SHA final ;
2. le Live smoke PR est vert sur le même SHA ;
3. le diff final ne réduit aucun contrôle ;
4. la PR est squash-mergée ;
5. Railway publie le **SHA de merge PR-13** sur `protocap` et `protocap-demo` avec statut SUCCESS ;
6. les probes et le smoke externe sont relus après ce déploiement ;
7. F01–F24 sont mis à jour sans transformer une limite documentée en succès fictif.

Aucun résultat de cette recette ne constitue une validation d’usage industriel réel, une certification d’accessibilité, une garantie d’absence de bug ou une preuve de bénéfice métier mesuré.
