# LineOps Toolkit

PWA React/TypeScript regroupant plusieurs prototypes génériques liés aux lignes de conditionnement, dont ShiftGuide et Céline.

> Application personnelle générique. Ne pas committer de secrets, de variables d'environnement ou d'artefacts générés.

## Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Express
- vite-plugin-pwa
- lucide-react
- Railway pour le déploiement

## Développement local

Node.js 20 est la version de référence (`.nvmrc`).

```bash
npm ci
npm run dev
```

## Validation

La commande de référence du dépôt est :

```bash
npm run check
```

Elle vérifie la syntaxe du serveur Express, exécute TypeScript puis construit l'application Vite/PWA. Le workflow GitHub Actions ajoute aussi un `npm audit --omit=dev` et vérifie que `node_modules/` et `dist/` ne sont pas versionnés.

## Build

```bash
npm run build
npm run preview
```

`dist/` est généré à la demande et n'est jamais committé.

## Déploiement Railway

Railway est la cible de déploiement de l'application. La configuration Nixpacks effectue :

```text
npm ci
npm run build
node server.mjs
```

Le serveur Express sert ensuite le bundle Vite et les routes API.

Les variables de production restent configurées dans Railway. Le dépôt fournit uniquement `.env.example` comme référence de noms ; aucune valeur secrète ne doit être ajoutée à Git.

Pour Céline, le backend accepte `DEEPSEEK_API_KEY` et conserve la compatibilité avec `VITE_DEEPSEEK_API_KEY`. Pour ShiftGuide, `SHIFTGUIDE_CODE` est le nom recommandé avec compatibilité pour `VITE_SHIFTGUIDE_CODE`.

## PWA

La PWA utilise `vite-plugin-pwa` avec :

- manifest applicatif ;
- icône SVG maskable ;
- service worker en mise à jour automatique ;
- cache offline basique ;
- mode `standalone`.

## Structure

```text
src/
  components/   composants UI réutilisables
  data/         données et référentiels applicatifs
  hooks/        persistance et état partagé
  pages/        pages applicatives
  types/        types TypeScript
  utils/        helpers
server.mjs      serveur Express et API
```

## Maintenance

Dependabot vérifie chaque semaine les dépendances npm et les GitHub Actions. Les changements doivent passer le workflow `Quality gate` avant fusion.
