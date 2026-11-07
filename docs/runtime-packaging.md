# Production runtime packaging

Protocap uses the repository root `Dockerfile` as the production build and runtime contract.

## Build contract

- Node.js 24 on Debian Bookworm slim is used for both build and runtime stages.
- `npm ci` installs the exact lockfile dependency graph in the build stage.
- `npm run build` produces the Vite/PWA `dist` bundle.
- The runtime stage performs a fresh `npm ci --omit=dev --ignore-scripts` and contains only production dependencies plus `dist`, `server.mjs`, `server/` and `shared/`.
- The process runs as the image's non-root `node` user.
- `PORT` selects the listening port (default 3000); on the VPS it is published on loopback only and reached through nginx.

`.dockerignore` removes generated directories, test/evaluation material, documentation and local environment files from the Docker build context.

## VPS (Docker + nginx)

The production host builds the root `Dockerfile` and runs it with Docker Compose; `deploy/docker-compose.yml` shows the two-service layout (protected service and isolated demo). Health and restart controls live in the Compose service definition:

- healthcheck path: `/api/ready`;
- restart policy: `unless-stopped`;
- ports published on `127.0.0.1` only, so nginx is the only network path in.

The repository contains no `nixpacks.toml` or `railway.toml`. There is one build/runtime source of truth instead of overlapping platform configuration files.

## Verification

The repository Quality Gate runs `docker build --tag protocap-ci .` for every pull request and push to `main`. `tests/runtimePackaging.test.mjs` also locks the key packaging invariants and prevents the obsolete config files from returning unnoticed.

A successful container build proves that the repository can produce its production image. It does not by itself prove that the VPS is serving it; deployment success is verified separately through `docker compose ps` and `/api/ready`.
