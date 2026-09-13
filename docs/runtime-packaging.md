# Production runtime packaging

Protocap uses the repository root `Dockerfile` as the production build and runtime contract.

## Build contract

- Node.js 24 on Debian Bookworm slim is used for both build and runtime stages.
- `npm ci` installs the exact lockfile dependency graph in the build stage.
- `npm run build` produces the Vite/PWA `dist` bundle.
- Frontend libraries (`react`, `react-dom`, `react-router-dom`, `lucide-react`) are build-stage dependencies from the container perspective: Vite bundles their browser code into `dist`, so Node does not need their npm packages in the final image.
- The runtime stage performs a fresh `npm ci --omit=dev --ignore-scripts`; its direct npm runtime dependency is therefore limited to `express`, plus the transitive packages Express requires.
- The final image contains only the production npm graph plus `dist`, `server.mjs`, `server/` and `shared/`.
- The process runs as the image's non-root `node` user.
- Railway supplies `PORT`; the image's `EXPOSE 3000` documents the local default only.

`.dockerignore` removes generated directories, test/evaluation material, documentation and local environment files from the Docker build context.

## Railway

Railway automatically detects a root file named `Dockerfile`. The production service keeps deployment-health and restart controls in Railway service configuration rather than the deprecated `railway.toml` config-as-code format:

- readiness path: `/api/ready`;
- readiness timeout: 60 seconds;
- restart policy: `ON_FAILURE`;
- maximum restart retries: 3.

The repository therefore contains no `nixpacks.toml` or `railway.toml`. There is one build/runtime source of truth instead of overlapping Railpack, Nixpacks and service-file configuration.

## Verification

The repository Quality Gate runs `docker build --tag protocap-ci .` for every pull request and push to `main`. `tests/runtimePackaging.test.mjs` locks the key packaging invariants, including the direct runtime npm dependency boundary, and prevents obsolete config files from returning unnoticed.

A successful container build proves that the repository can produce its production image. It does not by itself prove that Railway accepted or activated a deployment; deployment success is verified separately through Railway status and `/api/ready`.
