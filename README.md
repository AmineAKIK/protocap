# LineOps Toolkit

PWA React/TypeScript pour trois modules génériques liés aux lignes de conditionnement.

## Objectif

Le projet regroupe trois modules fonctionnels et leurs bénéfices opérationnels :

- **Expiry Check** : suivi de validité du bloc de remplissage, traçabilité des recharges de cuves et board de tournée laveur.
- **Logistics Call** : appel digital pour évacuation ou fourniture de palettes, avec board logistique.
- **Knowledge Base** : base documentaire fictive plus claire, recherchable et structurée.

> Application personnelle générique - données fictives - aucune information réelle ou confidentielle.

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

Le projet est prêt pour un déploiement automatique via GitHub Actions.

### Déploiement automatique

1. Pousser le projet sur un dépôt GitHub.
2. Aller dans **Settings > Pages**.
3. Dans **Build and deployment**, choisir **GitHub Actions**.
4. Pousser sur la branche `main`.
5. Le workflow `.github/workflows/deploy.yml` construit l’application et publie le dossier `dist/`.

Le workflow configure automatiquement le `base` Vite avec le nom du dépôt :

```bash
VITE_BASE_PATH=/${{ repository-name }}/
```

Il génère aussi `dist/404.html` pour que les routes React comme `/expiry-check`, `/logistics-call` et `/knowledge-base` restent accessibles après rechargement direct.

### Build local pour GitHub Pages

Le `base` Vite reste configurable avec `VITE_BASE_PATH`.

Exemple pour un dépôt publié sous `/lineops-toolkit/` :

```bash
VITE_BASE_PATH=/lineops-toolkit/ npm run build:pages
```

Le dossier généré est `dist/`.

### Domaine personnalisé

Si le site est publié sur un domaine personnalisé à la racine, construire avec :

```bash
VITE_BASE_PATH=/ npm run build:pages
```

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
  pages/        pages applicatives
  types/        types métier TypeScript
  utils/        helpers date, statuts et identifiants
```
