# LineOps Toolkit

PWA React/TypeScript de démonstration présentant trois prototypes génériques inspirés de problématiques courantes en environnement de production et de conditionnement.

## Objectif

Le projet illustre des idées simples d’amélioration terrain :

- **Expiry Check** : suivi de validité d’éléments en contact produit, avec contrôle avant démarrage.
- **Logistics Call** : appel digital pour évacuation ou fourniture de palettes, avec board logistique.
- **Knowledge Base** : base documentaire fictive plus claire, recherchable et structurée.

> Prototype personnel générique - données fictives - aucune information réelle ou confidentielle.

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- localStorage
- vite-plugin-pwa
- lucide-react

## Lancer le projet

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Déploiement GitHub Pages

Le `base` Vite est configurable avec `VITE_BASE_PATH`.

Exemple pour un dépôt publié sous `/lineops-toolkit/` :

```bash
VITE_BASE_PATH=/lineops-toolkit/ npm run build
```

Le dossier généré est `dist/`.

## PWA

La PWA est configurée avec `vite-plugin-pwa` :

- manifest applicatif
- icône SVG maskable
- service worker avec cache offline basique
- mode `standalone`

## Données

Toutes les données affichées sont des exemples fictifs stockés dans `src/data/`. Les interactions principales persistent dans le navigateur via `localStorage`.

## Structure

```text
src/
  components/   composants UI réutilisables
  data/         données fictives
  hooks/        persistance localStorage
  pages/        pages et prototypes
  types/        types métier TypeScript
  utils/        helpers date, statuts et identifiants
```
