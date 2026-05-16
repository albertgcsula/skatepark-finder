# Deployment Specification: AWS Amplify Gen 2 (Static SPA + Backend)

## Overview

The app is deployed on **AWS Amplify Hosting** as a **static SPA** front-end with a separately-deployed **Amplify Gen 2 backend** (Cognito + AppSync + DynamoDB). Frontend and backend ship from the same repo and CI pipeline.

**Live URL:** `https://main.dc6ydxyxjc7kt.amplifyapp.com/` (production), `sk8finder.cloud` pending DNS cutover.

---

## Architecture

```
                            Amplify Hosting (us-east-1, platform: WEB)
                            ┌──────────────────────────────────────────┐
                            │  CloudFront ── S3 (static assets)        │
   Browser ──── HTTPS ────► │      └────► index.html + JS bundle       │
                            │             (bundles amplify_outputs.json) │
                            └──────────────────────────────────────────┘
                                              │
                                              │ (client-side)
                                              ▼
                            Amplify Gen 2 Backend (deployed by ampx pipeline-deploy)
                            ┌──────────────────────────────────────────┐
                            │  AppSync (GraphQL API)                   │
                            │     ├── publicApiKey auth                │
                            │     └── Resolvers ──► DynamoDB tables    │
                            │                       ├── Skatepark      │
                            │                       └── (model GSIs)   │
                            │  Cognito User Pool (admins/editors)      │
                            └──────────────────────────────────────────┘
                                              │
                                              │ (fallback when DDB empty)
                                              ▼
                            OSM Public APIs (Overpass + Nominatim)
```

### Rendering Strategy

**Client-side rendering (static SPA).** The deployed `index.html` is a Vite-built static file (~5KB) containing:

- All SEO meta tags (title, description, OG, Twitter, JSON-LD structured data) inlined so crawlers see them on first byte.
- A `<script type="module">` that bootstraps the React app with TanStack Router.
- Robots-friendly `<noscript>` fallback explaining the app needs JS.

**Why not SSR:** This project attempted TanStack Start + Nitro SSR via Amplify's `WEB_COMPUTE` platform during development (see `DEPLOYMENT_SPEC.md` history). Amplify Hosting's open-compute SSR pipeline didn't recognize Nitro's `aws-amplify` preset output despite the deploy-manifest.json being valid — no Lambda compute was ever provisioned, requests fell through to static. After validating across two fresh app creations, the team reverted to static SPA with rich static SEO meta (Google crawls it identically since the SEO content is static). If a future feature needs true SSR for SEO-targeted dynamic content (e.g., per-skatepark detail pages with unique titles), revisit with either Next.js (native Amplify support) or CDK-deployed Lambda Function URL + CloudFront.

---

## Infrastructure as Code

**Single source of truth:** the `amplify/` directory.

```
amplify/
├── backend.ts          # defineBackend({ auth, data })
├── auth/resource.ts    # Cognito user pool + admins/editors groups
├── data/resource.ts    # AppSync API + Skatepark model + region/geohash GSIs
├── package.json        # marks subtree as ESM
└── tsconfig.json       # backend-specific TS config (skipLibCheck, bundler resolution)
```

The Amplify CLI (`@aws-amplify/backend-cli`, invoked as `npx ampx`) generates a CDK stack from these resource definitions and deploys it. `amplify_outputs.json` is the generated output mapping containing the AppSync endpoint, API key, Cognito IDs.

### Environments

- **Personal dev sandbox:** `npx ampx sandbox` — provisions a per-developer Cognito+AppSync+DynamoDB triple. Hot-reloads on `amplify/*` changes. Writes `amplify_outputs.json` to project root (gitignored).
- **Production:** Provisioned by Amplify Hosting CI when the `backend` phase in `amplify.yml` runs `npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID`. Each git branch produces its own environment.

---

## Build & Deploy Pipeline

### `amplify.yml`

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - nvm use 20
        - npm install --no-audit --no-fund --prefer-offline
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    preBuild:
      commands:
        - nvm use 20
        - npm install --no-audit --no-fund --prefer-offline
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - ~/.npm/**/*
```

### Pipeline Stages

1. **`backend.build`** runs first. `ampx pipeline-deploy` synthesizes the CDK stack from `amplify/` and deploys/updates it. On success, writes `amplify_outputs.json` to the project root.
2. **`frontend.preBuild`** installs deps a second time (separate node_modules cache from backend phase).
3. **`frontend.build`** runs `vite build`. Vite's `import.meta.glob('/amplify_outputs.json')` picks up the file generated in step 1 and bundles it into the deployed JS, so the runtime knows the AppSync endpoint and API key.
4. **Deploy:** Amplify uploads `dist/` to its CloudFront-fronted bucket.

### IAM Service Role

The Amplify app's hosting service role (`AmplifyServiceRole-*`) needs the AWS-managed policy **`AmplifyBackendDeployFullAccess`** attached, in addition to whatever Amplify provisioned by default. Without this, `ampx pipeline-deploy` fails with IAM errors when trying to deploy CDK stacks. Set via console or:

```bash
aws iam attach-role-policy \
  --role-name AmplifyServiceRole-<id> \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmplifyBackendDeployFullAccess
```

### Custom Rules

Amplify Hosting needs a SPA fallback rule so client-side routes (`/?q=...`, future `/parks/:id`) don't 404. Set via the Amplify Console **Hosting → Rewrites and redirects** or the CLI:

```bash
aws amplify update-app --app-id <id> --custom-rules '[
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest|xml)$)([^.]+$)/>",
    "target": "/index.html",
    "status": "200"
  }
]'
```

The regex excludes common static-asset extensions (and `xml`/`txt` so `sitemap.xml` and `robots.txt` aren't rewritten to HTML).

---

## Build Constraints (Watch Out For)

A few non-obvious things future contributors will hit:

1. **`.npmrc` requires `legacy-peer-deps=true`.** Amplify SDK packages have internal peer-dep conflicts (`@aws-amplify/backend-output-schemas` peer-requires an exact `zod@3.25.17` while sibling packages bundle older versions). Without the flag, `npm install` errors out on peer mismatches.

2. **`npm install` instead of `npm ci`.** `aws-cdk-lib` declares `jsonschema` in both `dependencies` and `bundleDependencies` with different versions. This contradiction means `npm ci`'s strict lockfile validation fails ("Missing: jsonschema@1.4.1 from lock file") even though the lockfile is consistent. `npm install` is more permissive and resolves correctly. Tradeoff: slightly less reproducible builds (acceptable while the project is small).

3. **`tsx` peer dep.** `@aws-amplify/backend-cli` uses `tsx` at runtime to execute `amplify/backend.ts` (TypeScript without compilation). Listed as `devDependency`.

4. **Node 20 pinned via `.nvmrc`.** `ampx pipeline-deploy` and most Amplify packages target Node 20 LTS. Some `@tanstack/start-*` deps want Node 22+ but those are unused (vestigial from the SSR attempt) and emit harmless `EBADENGINE` warnings.

5. **Backend deploy takes ~5-8 min on first push** (CDK provisions Cognito, AppSync, DynamoDB, IAM roles from scratch). Subsequent deploys diff and take ~1-2 min.

---

## Data Seeding

`amplify_outputs.json` is per-environment. To seed the **production** DynamoDB after a backend deploy:

```bash
mkdir -p .seed-prod
npx ampx generate outputs --branch main --app-id dc6ydxyxjc7kt --out-dir .seed-prod
AMPLIFY_OUTPUTS=.seed-prod/amplify_outputs.json npm run seed
rm -rf .seed-prod
```

This downloads prod's `amplify_outputs.json` to a temp folder (so the dev sandbox config at project root isn't clobbered), runs the seed script against prod, then cleans up.

The seed script (`scripts/seed.mjs`) reads `scripts/output/*.json` from prior `npm run ingest` runs and writes records via the AppSync `createSkatepark`/`updateSkatepark` mutations. Idempotent — re-running updates existing records by `osmId`.

---

## Custom CDK Resources (Escape Hatches)

The `amplify/` framework covers most needs via `defineAuth`, `defineData`, `defineFunction`, `defineStorage`. For resources Amplify doesn't expose as primitives — currently **OpenSearch** (§8A in `BACKEND_SPEC.md`) and **CloudWatch RUM** — use the CDK escape hatch in `amplify/backend.ts`:

```typescript
import { defineBackend } from '@aws-amplify/backend'
import * as opensearch from 'aws-cdk-lib/aws-opensearchservice'
import { auth } from './auth/resource'
import { data } from './data/resource'

const backend = defineBackend({ auth, data })

const customStack = backend.createStack('AdvancedSearchStack')
new opensearch.Domain(customStack, 'SkateparkSearch', {
  version: opensearch.EngineVersion.OPENSEARCH_2_11,
})
```

Custom CDK resources participate in the same `ampx pipeline-deploy` flow — no separate deploy mechanism.

---

## Observability

- **CloudWatch Logs:** Automatic for every Amplify-managed Lambda. Log groups reachable via `backend.<resource>.resources.lambda`.
- **CloudFront access logs:** Available in the Amplify Hosting build details (request count, cache hit rate, geographic distribution).
- **AWS X-Ray:** Enable per-function with `tracing: 'Active'` on `defineFunction` calls (currently no Lambdas defined).
- **CloudWatch RUM:** Not yet wired. Add via CDK escape hatch when frontend performance baselining becomes a priority.

---

## Summary

| Layer | Implementation |
| :--- | :--- |
| Hosting | Amplify Hosting `WEB` platform (CloudFront + S3) |
| Rendering | Static Vite SPA with SEO meta inlined in `index.html` |
| Backend | Amplify Gen 2 (`amplify/`) — Cognito + AppSync + DynamoDB |
| Backend deploy | `ampx pipeline-deploy` invoked by `amplify.yml` `backend` phase |
| IaC | TypeScript on AWS CDK via Amplify Gen 2 |
| Seeding | Local `scripts/seed.mjs` against per-environment `amplify_outputs.json` |
| DNS | `dc6ydxyxjc7kt.amplifyapp.com` (auto), `sk8finder.cloud` (custom domain pending cutover) |
