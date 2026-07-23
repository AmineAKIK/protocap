# LineOps Toolkit

PWA de démonstration pour rendre plus lisibles plusieurs flux d'une ligne de conditionnement. L'application réunit cinq modules terrain, un rapport opérationnel et un espace ShiftGuide protégé.

> Projet personnel fondé sur des observations de terrain, avec des données de démonstration fictives. Aucune donnée réelle ou confidentielle n'est incluse dans le dépôt.

## Fonctionnalités

| Module | Usage principal |
| --- | --- |
| **ShiftGuide** | Assistance opérationnelle, check-lists, modules guidés, lexique, urgences et suivi LinePulse. |
| **Expiry Check** | Validité du bloc de remplissage, recharges de cuves et tournée laveur. |
| **Logistics Call** | Appels d'évacuation ou d'approvisionnement, priorisation et suivi logistique. |
| **Knowledge Base** | Consultation de modes opératoires, check-lists et fiches réaction fictives. |
| **Packing Calculator** | Conversion d'une quantité en palettes, cartons et unités selon la politique choisie. |

Le rapport accessible sous `/rapport` synthétise les observations, hypothèses, impacts et indicateurs associés aux prototypes.

## Stack technique

- React 18 et TypeScript
- Vite 6
- Tailwind CSS
- React Router
- Express 5
- vite-plugin-pwa et Workbox
- lucide-react
- persistance navigateur avec `localStorage` et `sessionStorage`

## Prérequis

- Node.js 20 ou supérieur
- npm

## Installation et développement

Installer exactement les versions verrouillées :

```bash
npm ci
```

Lancer le frontend en développement :

```bash
npm run dev
```

Vite affiche ensuite l'URL locale dans le terminal. Le serveur de développement couvre les modules frontend ; l'API protégée de ShiftGuide nécessite le serveur Express décrit ci-dessous.

## Build et serveur complet

Créer le build de production puis servir l'application et l'API avec Express :

```bash
npm run build
node server.mjs
```

Par défaut, le serveur écoute sur `http://localhost:3000`. La variable `PORT` permet de choisir un autre port.

Pour prévisualiser uniquement le frontend statique :

```bash
npm run preview
```

## Configuration de ShiftGuide

Le serveur charge la configuration protégée depuis des variables d'environnement :

| Variable | Moment de lecture | Description |
| --- | --- | --- |
| `PORT` | Exécution | Port HTTP du serveur Express, `3000` par défaut. |
| `VITE_SHIFTGUIDE_CODE` | Exécution | Code demandé par `POST /api/shiftguide/unlock`. |
| `SG_MODULES` | Exécution | Tableau JSON des modules ShiftGuide. |
| `SG_LEXIQUE` | Exécution | Tableau JSON des entrées du lexique. |
| `SG_URGENCES` | Exécution | Données JSON des procédures d'urgence. |
| `SG_SYSTEM_PROMPT` | Exécution | Complément facultatif du prompt système. |
| `VITE_DEEPSEEK_API_KEY` | Build | Clé utilisée par l'assistante Céline. |

`SG_MODULES`, `SG_LEXIQUE` et `SG_URGENCES` doivent contenir du JSON valide. Les valeurs sensibles doivent rester dans l'environnement de déploiement et ne jamais être ajoutées au dépôt.

> Important : toute variable préfixée par `VITE_` et utilisée dans le frontend est intégrée au bundle envoyé au navigateur. `VITE_DEEPSEEK_API_KEY` convient uniquement à ce prototype ; une utilisation en production doit passer par un proxy serveur afin de garder la clé secrète.

## Vérifications

Avant de proposer une modification :

```bash
npm run build
npm audit --omit=dev
```

Le build exécute d'abord le contrôle TypeScript, puis génère la PWA dans `dist/`.

## Déploiement Railway

Railway utilise `nixpacks.toml` et `railway.toml` :

- Node.js 20 ;
- installation avec `npm ci --omit=dev` ;
- démarrage avec `node server.mjs` ;
- redémarrage automatique en cas d'échec.

Le dossier `dist/` est volontairement versionné, car le déploiement Railway installe uniquement les dépendances de production et sert ce build directement. Après toute modification du frontend, exécuter `npm run build` et inclure le nouveau `dist/` dans le même commit.

## Déploiement GitHub Pages

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) construit et publie automatiquement le frontend à chaque push sur `main`. Il configure le chemin de base avec le nom du dépôt et génère `dist/404.html` pour les routes React :

```bash
VITE_BASE_PATH=/nom-du-depot/ npm run build:pages
```

Pour un domaine personnalisé servi à la racine :

```bash
VITE_BASE_PATH=/ npm run build:pages
```

GitHub Pages est un hébergement statique : l'endpoint Express `/api/shiftguide/unlock` et les variables lues à l'exécution n'y sont pas disponibles. Le déploiement Railway est donc nécessaire pour utiliser l'intégralité de ShiftGuide.

## PWA et stockage

L'application fournit un manifeste et une icône pour l'installation sur un appareil compatible. Le service worker est actuellement configuré en mode `selfDestroying` : il désinscrit les anciennes versions et vide leurs caches. Le mode hors ligne n'est donc pas actif dans la configuration actuelle.

Les interactions des modules sont enregistrées localement dans le navigateur. L'autorisation et les données ShiftGuide sont conservées pour la session en cours.

## Structure du projet

```text
.
├── .github/workflows/   déploiement GitHub Pages
├── dist/                build versionné pour Railway
├── public/              ressources publiques de la PWA
├── src/
│   ├── components/      composants UI réutilisables
│   ├── data/            données fictives et modèles ShiftGuide
│   ├── hooks/           stockage local et authentification ShiftGuide
│   ├── pages/           écrans et routes de l'application
│   ├── types/           types métier TypeScript
│   └── utils/           calculs et helpers métier
├── server.mjs           serveur Express et API ShiftGuide
├── vite.config.ts       build frontend et configuration PWA
├── railway.toml         commande de déploiement Railway
└── nixpacks.toml        environnement de build Railway
```

## Routes principales

- `/` — accueil et présentation
- `/rapport` — rapport opérationnel
- `/expiry-check`
- `/logistics-call`
- `/knowledge-base`
- `/packing-calculator`
- `/shiftguide` — espace protégé et sous-modules associés

## Limites actuelles

- Les données métier hors configuration ShiftGuide sont fictives et locales au navigateur.
- L'assistante IA appelle actuellement DeepSeek depuis le navigateur ; un proxy backend est requis avant tout usage de production.
- Le cache hors ligne est désactivé tant que `selfDestroying` reste actif dans la configuration PWA.
- Le dépôt contient des prototypes de démonstration, pas un système industriel qualifié.
