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

Le tableau ci-dessous nomme la preuve propriétaire. Le statut reste **À rejouer** tant que les workflows du SHA final de PR-13 ne sont pas terminés.

| Test | Méthode / preuve propriétaire | Statut pré-merge |
| --- | --- | --- |
| T01 | `e2e/expiry-time.spec.ts`, `src/features/expiry/time.test.ts` | À rejouer |
| T02 | Expiry DST/unit + navigateur multi-fuseaux | À rejouer |
| T03 | validation Expiry/packing avant mutation | À rejouer |
| T04 | Expiry futur refusé + brouillon conservé | À rejouer |
| T05 | état temporel inconnu / incomplet non conforme par défaut | À rejouer |
| T06 | live refresh Expiry à 48 h / expiration | À rejouer |
| T07 | visibilité/focus/réveil + cleanup | À rejouer |
| T08 | revalidation état/horloge au submit | À rejouer |
| T09 | jours calendaires 119 h / 121 h | À rejouer |
| T10 | pannes stockage typées sans faux succès | À rejouer |
| T11 | création Logistics dégradée, brouillon conservé | À rejouer |
| T12 | retry idempotent / double clic | À rejouer |
| T13 | agrégat Expiry atomique état + historique | À rejouer |
| T14 | migration Expiry v8/v1 idempotente et sources intactes | À rejouer |
| T15 | JSON invalide / version future sans réécriture destructive | À rejouer |
| T16 | dates suspectes visibles sans correction globale | À rejouer |
| T17 | StrictMode/montage/changement de clé sans écriture parasite | À rejouer |
| T18 | Packing + consentement dégradé | À rejouer |
| T19 | ShiftGuide session/logout/révisions/progression/Céline séparés | À rejouer |
| T20 | Logistics historique sans `completedAt` n’invente pas d’heure | À rejouer |
| T21 | identités stables sous double submit/retry | À rejouer |
| T22 | matrice complète des transitions Logistics | À rejouer |
| T23 | `e2e/local-concurrency.spec.ts` : deux onglets, verrou annulable, absence Web Locks | À rejouer |
| T24 | `e2e/public-demo.spec.ts` : démo découvrable sans secret | À rejouer |
| T25 | démo : succès/clarification/inconnue/indisponibilité scénarisés | À rejouer |
| T26 | Node 24 + install + démo synthétique | À rejouer |
| T27 | lanceur dev complet, loopback, port occupé, signaux | À rejouer |
| T28 | `npm start`, configuration et erreurs sûres | À rejouer |
| T29 | harnais empoisonné sans fournisseur externe | À rejouer |
| T30 | couverture front globale + périmètre documenté | À rejouer |
| T31 | tests métier + seuils critiques + mutation smoke | À rejouer |
| T32 | audits graphe complet / production | À rejouer |
| T33 | politique d’exception bornée et expirante | À rejouer |
| T34 | portfolio sourcé sans métrique inventée | À rejouer |
| T35 | identité ProtoCap/ShiftGuide/Céline, clés historiques intactes | À rejouer |
| T36 | libellés local/non sauvegardé/simulation/validité estimée | À rejouer |
| T37 | docs courantes séparées des preuves historiques | À rejouer |
| T38 | manifeste E2E exhaustif, zéro test = échec | À rejouer |
| T39 | serveurs E2E hermétiques, pas de réutilisation ni accès métier externe | À rejouer |
| T40 | migration/reload + deux onglets ; PWA contrôlée par T45 | À rejouer |
| T41 | ancien lecteur interdit quand incompatible ; forward-fix documenté | À rejouer |
| T42 | focus/aria/annonces + axe sur modes modifiés | À rejouer |
| T43 | Chromium desktop/mobile + WebKit ciblé | À rejouer |
| T44 | Quality Gate/CodeQL + Railway exact SHA + `/api/ready` post-merge | Post-merge requis |
| T45 | dual-origin live smoke + PDF/PWA + séparation démo/protégé | À rejouer + post-merge |

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
