# PR-12 — portfolio, noms et preuves exactes

**Date :** 19 septembre 2026  
**Branche :** `docs/portfolio-product-truth`  
**Base :** `f924e86de87a7dbc6424991836b79dbba7fba8b3` (main après PR-11)  
**Méthode :** audit statique des surfaces visibles + tests de régression + Quality Gate/CodeQL de la PR.  
**Statut de publication :** preuve pré-merge uniquement. La corrélation avec le commit effectivement déployé reste PR-13.

## Périmètre vérifié

PR-12 traite F11, F16, F17, F18 et la présentation de la limite F24 sans modifier les données métier, les clés historiques, les routes ou la licence.

### T24 — démonstration découvrable

Le README expose un lien direct vers la démo ShiftGuide isolée et le verrou ShiftGuide conserve son CTA public sans demander de secret au mainteneur. L’accueil ProtoCap ne réintroduit pas de promotion vers un SPA démo complet.

### T34 — portfolio vérifiable

L’entrée du README distingue :
- comportement implémenté ;
- démo synthétique ;
- runtime protégé ;
- preuves techniques versionnées ;
- résultats industriels non mesurés.

Aucune statistique métier, attribution de travail solitaire, gain de temps ou déploiement industriel n’est déduit du nombre de commits ou du comportement du prototype.

### T35 — identité canonique

Les surfaces visibles utilisent **ProtoCap**, **ShiftGuide** et **Céline**. Les anciennes marques visibles `LineOps Toolkit` / `LineOps` ont été retirées des parcours principaux.

Les clés historiques `lineops.*` restent volontairement inchangées : elles identifient des formats de stockage existants et les renommer sans migration casserait la compatibilité. Le test `tests/productIdentity.test.mjs` protège explicitement cette distinction.

### T36 — libellés honnêtes

Logistics Call décrit désormais son board comme **local à ce navigateur** et n’affirme plus qu’une demande est « envoyée » à un acteur distant ou conservée « sans perte ».

Expiry Check décrit un **état de validité estimé** selon les données locales ; il ne présente plus ce calcul comme une autorisation de démarrage machine ou qualité.

Les écrans de simulation ShiftGuide restent explicitement marqués « données fictives » et « réponses scénarisées — aucun appel IA externe ».

### T37 — preuve actuelle vs historique

Les documents actuels sont alignés avec le produit courant, notamment le contrat de progression ShiftGuide v4 et le périmètre actuel de la démo hébergée.

Les anciens fichiers `docs/release-evidence/ws-*.md` ne sont pas réécrits pour leur donner une apparence actuelle. Ils restent des preuves historiques de leur SHA/date et peuvent contenir des noms de clés historiques ou des états ensuite supersédés.

Cette preuve PR-12 supersède uniquement les affirmations de présentation courante qu’elle nomme ; elle n’efface ni ne remplace les résultats historiques.

### T43 — navigateurs et accessibilité

PR-12 n’introduit pas de nouveau layout ni de composant interactif. Les surfaces textuelles modifiées restent couvertes par la matrice browser/accessibilité existante de la Quality Gate. Le résultat exact du SHA final de PR-12 doit être attaché à la PR avant merge.

## Limite F24

Les dates historiques ambiguës ou suspectes ne sont pas « réparées » par un décalage global. PR-12 rend cette limite explicite dans la traçabilité ; les sources historiques restent conservées. La recette finale PR-13 revalidera T14/T16/T37 avant clôture.

## Ce que cette preuve ne démontre pas

- aucune validation d’un usage industriel réel ;
- aucun KPI métier mesuré ;
- aucune attribution personnelle au-delà de ce que les sources publiques établissent ;
- aucune preuve que le SHA de cette branche est déjà déployé ;
- aucune modification de licence.

La preuve de déploiement exacte, les smokes live et la clôture F01–F24 appartiennent à PR-13.
