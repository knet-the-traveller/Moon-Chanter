# Vercel Deployment & Build Architecture

## Overview
AniTala / FieldShift is built and deployed as a single-page, zero-auth client-side static web application on Vercel.

## Vercel Configuration
The repository deployment is pinned strictly to the Vite frontend using `vercel.json` at the repository root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

- **Framework**: `vite` (pins Vercel's build scanner strictly to the root Vite project, preventing multi-service or Python autodetection).
- **Install Command**: `npm install` (standard npm package manager using `package-lock.json`).
- **Build Command**: `npm run build` (`tsc -b && vite build`).
- **Output Directory**: `dist` (Vite production bundle).
- **Exclusions (`.vercelignore`)**: `scripts/soilgrids/` is excluded as a backup safeguard.

> [!NOTE]
> **Caveat on Git-Connected Deployments**: For Git-connected deployments, Vercel clones the entire Git repository before running build commands. Therefore, pinning `"framework": "vite"` directly in `vercel.json` is the authoritative fix to prevent Vercel from treating offline helper directories (like `scripts/soilgrids`) as secondary backend services; `.vercelignore` provides secondary defense-in-depth for CLI uploads.

## Local-Only Offline Tools (`scripts/soilgrids/`)
- Directories under `scripts/soilgrids/` contain offline, local-only data-acquisition and preprocessing scripts (e.g., `acquire.py`, `verify.py`, `requirements.txt`).
- These scripts are used exclusively by developers to generate offline sample fixtures in `public/sample-data/`.
- `scripts/soilgrids/` is not a runtime backend service and **must never be deployed to production**.
- The production build (`npm run build`) does not depend on anything in `scripts/soilgrids/`.

## Environment Variables & Zero Secret Leakage Warning
> [!WARNING]
> **Client-Side Exposure**: In Vite applications, all environment variables prefixed with `VITE_` (e.g., `VITE_APP_NAME`, `VITE_DEFAULT_LAT`) are embedded directly into the public JavaScript bundle during `npm run build`. They are publicly inspectable by any website visitor via browser Developer Tools.
> 
> **Never commit or configure private secrets, API keys, or personal tokens (such as NASA Earthdata login tokens or private credentials) in `VITE_*` environment variables.**
> 
> FieldShift / AniTala operates as a 100% zero-auth decision support tool accessing public telemetry (NASA POWER, ISRIC SoilGrids, NASA GIBS) without private API keys.
