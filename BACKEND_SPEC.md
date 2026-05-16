# Skatepark Finder Backend: Technical Specification (SDD)

This document defines the formal contract and architecture for the Skatepark Finder API. This specification follows **Spec-Driven Development (SDD)** principles—implementation must strictly adhere to these definitions.

**Platform:** AWS Amplify Gen 2 (built on AWS CDK). Backend resources are defined as code in the `amplify/` directory. Amplify primitives (`defineAuth`, `defineData`, `defineStorage`, `defineFunction`) are used wherever they fit. CDK escape hatches via `backend.createStack(...)` are reserved for resources Amplify does not natively support — currently OpenSearch (§8A) and CloudWatch RUM (§8C).

## Implementation Status (current state)

| Component | Status |
| :--- | :--- |
| `defineAuth` — Cognito + admins/editors groups | Deployed (sandbox + prod), unused by frontend yet |
| `defineData` — Skatepark model + region/geohash GSIs | **Deployed and seeded** with ~472 records across 11 US regions |
| `defineStorage` — S3 bucket for media | **Not yet provisioned.** App uses Wikimedia/external image URLs directly via `imageUrl` field |
| Ingest pipeline | **Implemented as local Node.js CLI** (`scripts/ingest.mjs`), not yet a Lambda. See §6A |
| Search-triggered population | **Deferred (Phase 2c).** Frontend uses static OSM fallback when DDB returns 0 results |
| Frontend swap to AppSync client | **Deployed** via hybrid service (`src/services/skateparkService.ts`) |
| Auth tiers in §4 | **Temporarily collapsed** to `allow.publicApiKey()` only for sandbox/seed access. See §4 for `FIXME(prod)` |

---

## 1. Domain Model & Data Schema

The backend uses **AppSync + DynamoDB** provisioned by Amplify `defineData`. Each model owns its own DynamoDB table; Amplify generates GSIs from `secondaryIndexes` declarations.

**File:** `amplify/data/resource.ts`

```ts
const schema = a.schema({
  Skatepark: a
    .model({
      osmId: a.string().required(),         // e.g., "way/12345" — type/id from OSM
      osmType: a.string(),                  // "node" | "way" | "relation"
      name: a.string().required(),
      description: a.string(),
      imageUrl: a.url(),
      imageLicense: a.string(),             // CC license (e.g., "CC BY-SA 4.0") when from Wikimedia
      imageAttribution: a.string(),         // Artist / photographer when available
      imageSource: a.string(),              // Provenance — "wikipedia" | "wikimedia-geosearch:..." | etc.
      lat: a.float().required(),
      lng: a.float().required(),
      address: a.string(),
      website: a.url(),                     // Operator/city park URL when tagged in OSM
      surface: a.string(),                  // Free-form; mostly null since OSM tags this inconsistently
      geohash: a.string().required(),       // 9-char (ngeohash); narrower than the 12 in original spec
      region: a.string().required(),        // city slug (e.g., "nyc", "la", "portland", "sf")
    })
    .secondaryIndexes((index) => [
      index('region').sortKeys(['osmId']),
      index('geohash'),
    ])
    .authorization((allow) => [
      // FIXME(prod): tighten before going live. See §4 — single auth provider
      // chosen for sandbox to avoid an Amplify Gen 2 quirk where mixing
      // publicApiKey + authenticated + groups failed to propagate
      // @aws_api_key directives to optional fields, surfacing as
      // "Unauthorized on [imageUrl, description, ...]" errors at read time.
      allow.publicApiKey(),
    ]),
})
```

### Attribute Validation

| Attribute | Type | Constraint |
| :--- | :--- | :--- |
| `osmId` | String | Required, unique per region. Format: `<osmType>/<id>` |
| `osmType` | String | "node" \| "way" \| "relation" |
| `name` | String | Required. Falls back to `"Unnamed Skatepark"` only when no source produces a name |
| `description` | String | Free-form; sourced from OSM `description` tag, Wikipedia extract, or enclosing park's description |
| `imageUrl` | URL | External URL (Wikimedia Commons in most cases); validated by AppSync scalar |
| `imageLicense` | String | Optional, populated for Wikimedia images |
| `imageAttribution` | String | Optional photographer/artist credit |
| `imageSource` | String | Provenance tag — see ingest §6A |
| `lat`, `lng` | Float | -90 to 90 / -180 to 180 |
| `address` | String | Derived from OSM `addr:*` tags or Nominatim reverse geocode |
| `website` | URL | Optional, from OSM `website` tag |
| `surface` | String | Optional, free-form (OSM tags vary too widely for an enum here) |
| `geohash` | String | 9-char (`ngeohash`); GSI-indexed |
| `region` | String | City slug — currently one of `nyc`, `la`, `portland`, `brooklyn`, `sf`, `seattle`, `austin`, `chicago`, `denver`, `sandiego`, `boston`, `philly` |

**Deviation from prior spec:** The original spec called for a single-table design (`PK=REGION#zip`, `SK=SKATEPARK#osm_id`). Amplify `defineData` generates per-model tables. Per-model is accepted for the trade of: free typed client generation, free subscriptions, free auth-rule enforcement, and zero resolver code. If write throughput or cost ever forces a revisit, the underlying CDK construct is reachable via `backend.data.resources.tables.Skatepark` for targeted overrides without abandoning the Amplify project.

The `surface` and `type` enums in the original draft were dropped — OSM tags are too inconsistent (e.g., `surface=asphalt;concrete`, `surface=paved`) to map cleanly to a closed enum. Stored as free strings; will tighten when curation data is available.

---

## 2. API Definition (AppSync GraphQL)

The backend exposes a **GraphQL API via AppSync**, auto-generated from the `defineData` schema in §1. Resolvers, schema, and a fully typed client are generated by `npx ampx generate`.

### Frontend Consumption

```ts
import { generateClient } from 'aws-amplify/api'
import type { Schema } from '#/amplify/data/resource'

const client = generateClient<Schema>()

const { data: parks } = await client.models.Skatepark.list({
  filter: { region: { eq: '90210' } },
})

// Real-time subscriptions (§8B) on the same client:
client.models.Skatepark.observeQuery({
  filter: { region: { eq: '90210' } },
}).subscribe({ next: ({ items }) => /* ... */ })
```

### Generated Operations (excerpt)

```graphql
type Query {
  getSkatepark(id: ID!): Skatepark
  listSkateparks(filter: ModelSkateparkFilterInput, limit: Int): ModelSkateparkConnection
  skateparksByRegion(region: String!, osmId: ModelStringKeyConditionInput): ModelSkateparkConnection
  skateparksByGeohash(geohash: String!): ModelSkateparkConnection
}

type Mutation {
  createSkatepark(input: CreateSkateparkInput!): Skatepark
  updateSkatepark(input: UpdateSkateparkInput!): Skatepark
  deleteSkatepark(input: DeleteSkateparkInput!): Skatepark
}

type Subscription {
  onCreateSkatepark: Skatepark @aws_subscribe(mutations: ["createSkatepark"])
  onUpdateSkatepark: Skatepark @aws_subscribe(mutations: ["updateSkatepark"])
}
```

**Auth-gated mutations:** The `.authorization()` block in §1 produces AppSync auth directives. Cognito JWTs and the public API key are enforced by AppSync — no manual bearer-token plumbing.

**Deviation from prior spec:** The original spec defined REST endpoints (`GET /skateparks`, `PATCH /skateparks/{id}`, etc.) via API Gateway with OpenAPI 3.0. Swapped to AppSync GraphQL because:

- Amplify auto-generates resolvers, schema, and a typed client — eliminating manual OpenAPI/handler/SDK drift.
- Auth-gated mutations are declared in `.authorization()`, not bespoke middleware.
- Subscriptions (§8B) ride the same API — no separate WebSocket layer.

The image upload endpoint from the original spec (`POST /skateparks/{id}` returning a presigned URL) is replaced by Amplify Storage (§3), which handles presigned URLs in the client SDK.

If a REST endpoint is genuinely required for a non-Amplify consumer, expose a single Lambda Function URL via `defineFunction` — but GraphQL is the canonical interface.

---

## 3. Media Storage

### Current state: direct external URLs (no S3 yet)

Images are referenced by **external URL** stored in the `Skatepark.imageUrl` field. The ingest pipeline (§6A) populates this from:

- OSM `image` tag (rare; ~0% of records use it)
- OSM `wikimedia_commons` tag → resolved to a Wikimedia Commons file URL
- Wikipedia article lead image (when OSM has a `wikipedia` tag)
- Wikidata P18 (image property)
- Wikimedia Commons geosearch — nearby photos with skate-keyword filter

The frontend's `SkateparkCard` renders these directly with `<CardMedia component="img" src={imageUrl}>`. License and attribution from Wikimedia metadata are stored in `imageLicense` and `imageAttribution` and displayed in the card footer.

**Why no S3 yet:** the current image set is small (~35 images across 472 records), all hosted by Wikimedia, all CC-licensed and hotlinkable. The cost of provisioning an S3 bucket + thumbnail pipeline isn't justified until user uploads or hotlinking becomes a problem.

### Future plan: when we add user uploads

When user-contributed photos become a feature (per `FRONTEND_SPEC.md` roadmap), introduce `defineStorage`:

```ts
export const storage = defineStorage({
  name: 'skateparkMedia',
  access: (allow) => ({
    'public/skateparks/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read']),
      allow.groups(['admins']).to(['read', 'write', 'delete']),
    ],
    'private/uploads/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
})
```

Upload flow becomes:

1. Client calls `uploadData()` from `aws-amplify/storage` — SDK obtains a presigned URL and streams the upload directly to S3.
2. The S3 PUT triggers a `thumbnail-generator` `defineFunction` (S3 event source) that generates thumbnails (Sharp on an ARM64 Lambda layer) and issues an `updateSkatepark` mutation to set `imageUrl` on the parent record.

This deferred sprint (originally Sprint 4 in §10) is unblocked whenever uploads become a priority.

---

## 4. Authentication & Authorization

**File:** `amplify/auth/resource.ts`

```ts
export const auth = defineAuth({
  loginWith: {
    email: true,
    // externalProviders: { google: { ... } }, // optional, future
  },
  groups: ['admins', 'editors'],
  userAttributes: {
    preferredUsername: { mutable: true },
  },
})
```

### Authorization Tiers — design target

| Tier | Mechanism | Permissions |
| :--- | :--- | :--- |
| Anonymous | `allow.publicApiKey()` | Read skateparks |
| Authenticated user | `allow.authenticated()` | Read; update whitelisted fields on `Skatepark` (e.g., `name`, `address`, `description`) |
| `editors` group | `allow.groups(['editors'])` | All authenticated permissions; bypass trust-score gating |
| `admins` group | `allow.groups(['admins'])` | Full CRUD on all models |

Trust-score gating (referenced in §5) is implemented as either:

a. A field-level resolver that consults a `UserProfile.trustScore` model before applying an edit, or
b. A Lambda authorizer (`defineFunction` configured as a custom authorizer) for high-trust-only mutations.

### Current sandbox state — `FIXME(prod)`

The model auth (see §1) is **currently set to `allow.publicApiKey()` only** — the public API key has full CRUD. This was a deliberate sandbox-mode collapse because mixing `publicApiKey` + `authenticated` + `groups([...])` in a single `.authorization()` block triggered an Amplify Gen 2 quirk: optional fields (`imageUrl`, `description`, etc.) did not get the `@aws_api_key` directive propagated, causing reads to fail with `Unauthorized on [imageUrl, description, ...]` even though the model-level rule looked correct.

Before going to production:

1. Split read access (`publicApiKey().to(['read'])`) from write access (`groups(['admins']).to(['create','update','delete'])`).
2. Test field-level read access on optional fields after the change; if the directive issue resurfaces, add explicit field-level `.authorization()` blocks on those fields.
3. Move seed-script writes behind Cognito admin sign-in or a `defineFunction` with `allow.resource()` IAM auth (instead of the public API key).

---

## 5. Data Sourcing Strategy

Metadata is sourced from three channels:

1. **Initial seed (OSM):** `osm-sync-worker` (§6A) maps OSM tags (`note`, `description`, `wikimedia_commons`) into schema fields.
2. **User contributions:** Authenticated users submit edits via `updateSkatepark` mutations. Field-level auth rules in §1 / §4 restrict which attributes contributors can modify; trust-score gating filters which edits apply immediately vs. queue for review.
3. **Manual curation:** Admins use the same GraphQL API. An optional admin dashboard consumes the typed AppSync client.

---

## 6. ETL & Data Ingestion Pipeline

A **Hybrid Ingestion Model** balances data freshness against latency.

### A. Current state — local ingest CLI (not yet a Lambda)

**File:** `scripts/ingest.mjs` (Node.js ESM, run with `npm run ingest -- --scope=<region>`).

The ingest is currently a **local CLI script**, not a deployed `defineFunction`. The Lambda-ification (with EventBridge schedule) is deferred until manual ingest cadence becomes a bottleneck. The script's enrichment logic is the design source of truth and will move verbatim into a Lambda handler when promoted.

**Enrichment pipeline (per record):**

1. **Overpass query** — one request per region bbox returns:
   - All skateparks (`leisure=skate_park`, `sport=skateboard`)
   - All named `leisure=park|playground|recreation_ground|garden|nature_reserve` features (used for enclosing-park name resolution).
2. **OSM tag harvest** — name (with `name`/`official_name`/`alt_name`/`operator`/`addr:street` fallback chain), description, image, website, address tags.
3. **Wikipedia REST** — for records with `wikipedia` tag: article summary + lead image + page URL.
4. **Wikimedia Commons** — for records with `wikimedia_commons` tag (file or category): image URL + license + attribution.
5. **Wikidata** — for records with `wikidata` tag: P18 image, P31 instance-of, en labels/descriptions.
6. **Wikimedia Commons geosearch** — last-resort image lookup; only accepts files whose name matches a skate keyword (`skate|skatepark|skateboard|plaza|pump.?track|bowl`). Filters out generic "nearest photo" matches (cars, cafes, etc.).
7. **Commons-filename name mining** — when the geosearch match has a skate-relevant title like "Far Rockaway Skatepark - 2019.jpg", parses out a park name.
8. **Enclosing-park name resolution** — for records still without a name, finds the nearest named `leisure=park|playground|...` feature within 100m (from step 1's bulk fetch) and derives a name like "Tompkins Square Park Skatepark". Sourced because OSM mappers commonly tag the enclosing park but not the skatepark element itself.
9. **Nominatim reverse geocode** — final fallback for missing addresses or names.

**Provenance tracking:** every enriched record carries a `sources: { name, description, address }` map and an `imageSource` string so we can audit which API produced which field.

**Rate-limit handling:** Nominatim is rate-limited to 1 req/sec per IP via a serialized queue. Wikipedia/Wikimedia have generous limits and are called inline. Overpass is hit once per region (one bbox query returns all needed data).

**Region presets** (current set, in `PRESETS` constant): `nyc`, `brooklyn`, `la`, `portland`, `sf`, `seattle`, `austin`, `chicago`, `denver`, `sandiego`, `boston`, `philly`. Arbitrary bboxes accepted via `--bbox=south,west,north,east`.

**Output:** `scripts/output/<scope>.json` — gitignored, consumed by `scripts/seed.mjs` to write into DynamoDB.

### A.bis. Future: schedule as Lambda

When manual ingest becomes a bottleneck, promote `scripts/ingest.mjs` to:

```ts
// amplify/functions/osm-sync-worker/resource.ts
export const osmSyncWorker = defineFunction({
  name: 'osm-sync-worker',
  entry: './handler.ts',
  schedule: 'every day',
  timeoutSeconds: 300,
  memoryMB: 512,
})
```

Amplify will provision the EventBridge rule. Handler will use the same enrichment pipeline and write via the IAM-signed AppSync admin client (using `allow.resource(osmSyncWorker).to(['create','update'])` on the Skatepark model).

### B. Search-Triggered Population — `region-populator` (Phase 2c — deferred)

**Not yet implemented.** Search outside an ingested region (e.g., user searches "Boston MA" with only NYC/LA/Portland/etc. in DDB) currently falls back to OSM Overpass at query time without writing back. The user sees results; the next user searching the same region also hits OSM.

The frontend implements the **read-side** of the hybrid pattern today (see §6.C below). The write-back side — persisting the OSM-derived records to DynamoDB so subsequent queries are fast — is the remaining work for Phase 2c.

**Target design when implemented:**

```ts
export const regionPopulator = defineFunction({
  name: 'region-populator',
  entry: './handler.ts',
  timeoutSeconds: 60,
})
```

**Deviation from the original spec:** SQS as the async buffer is dropped in favor of **Lambda async destinations** (or AppSync pipeline resolvers invoking the populator) — fewer moving parts, native Amplify wiring, same delivery guarantees for current durability requirements. If retry / DLQ / fan-out grows complex, SQS can be added via the CDK escape hatch later.

**Target sequence:**

1. **User search** (`q=90210`) → frontend's hybrid service.
2. **DynamoDB list+filter** via the AppSync `list` query (current frontend behavior).
3. **Decision logic**:
   - **Found**: return DynamoDB results (current behavior).
   - **Empty**: fetch from Overpass inline, **and** fire-and-forget invocation of `region-populator` (new — currently missing).
4. **Asynchronous population:** `region-populator` runs the ingest enrichment pipeline (§6A) for the bbox covering the user's search, then writes via the IAM-signed admin client.

### C. Current state — frontend hybrid query (read-side only)

**File:** `src/services/skateparkService.ts` (deployed).

```ts
export async function fetchSkateparksHybrid(lat, lon, radiusMiles) {
  if (amplifyConfigured) {
    const ddbResults = await fetchFromDdb(lat, lon, radiusMiles)
    if (ddbResults.length > 0) return filterNamed(ddbResults)
  }
  return filterNamed(await fetchSkateparksOsm(lat, lon, radiusMiles))
}
```

- **DDB query strategy:** full-table scan + client-side haversine filter. Scales fine through ~5k records; beyond that, switch to a `geohash`-bucket query using the GSI in §1.
- **Fallback:** if DDB returns 0 records (e.g., search outside an ingested region) or the Amplify client isn't configured (e.g., dev build without `npx ampx sandbox`), the service falls through to `osmService.fetchSkateparks` against Overpass live.
- **Result filter:** `filterNamed` hides records whose name is `"Unnamed Skatepark"` (the sentinel for "no source produced a name"). Drops ~25% of records but every remaining card is meaningful. Filter is intentionally per-render; un-name-able records remain in DDB so the ingest can backfill names later without re-create churn.

---

## 7. Performance & Caching Contract

- **L1 Cache (Client):** Generated AppSync client maintains an in-session normalized cache; reads hit memory before falling through to the network.
- **L2 Cache (Edge):** Amplify Hosting fronts traffic with CloudFront automatically. SSR responses set `Cache-Control: public, max-age=3600` for unauthenticated routes.
- **L3 Cache (AppSync):** AppSync server-side caching is enabled per-query via the `data` resource for read-heavy operations once hit-rate metrics justify the cost.
- **Database performance:**
  - Proximity searches use the `geohash` GSI generated from `secondaryIndexes` in §1.
  - Region listings use the `region` GSI to avoid full scans.
- **Latency targets:**
  - P95 < 150ms for cache-hit reads.
  - P95 < 500ms for cache-miss reads (includes Overpass round-trip).

---

## 8. Advanced Technical Enhancements

### A. Semantic Search & Discovery (OpenSearch)

**Amplify primitive:** none. **Approach:** CDK escape hatch.

```ts
// amplify/backend.ts
const customStack = backend.createStack('AdvancedSearchStack')
const domain = new opensearch.Domain(customStack, 'SkateparkSearch', {
  version: opensearch.EngineVersion.OPENSEARCH_2_11,
})
```

A DynamoDB Stream on `backend.data.resources.tables.Skatepark` feeds a `defineFunction` (Streams event source) that bulk-indexes into OpenSearch. Natural-language queries ("concrete bowl with pool coping and shade") use OpenSearch k-NN over text embeddings.

Deferred until the description corpus is large enough to justify the operational cost — rough trigger: > 10k records, or sustained semantic-query traffic.

### B. Real-time Communication

**Amplify primitive:** AppSync **subscriptions** (first-class).

Live check-ins, photo approvals, and any other real-time community feature are delivered through the same AppSync API as queries and mutations. No separate WebSocket infrastructure to operate.

```ts
client.models.Skatepark.onUpdate({
  filter: { region: { eq: '90210' } },
}).subscribe({ next: (park) => /* push to UI */ })
```

### C. Deep Observability & Monitoring

- **AWS X-Ray:** Set `tracing: 'Active'` on each `defineFunction`. Amplify propagates the X-Ray context through AppSync resolvers automatically.
- **CloudWatch Logs:** Automatic for every Amplify-managed Lambda; log groups are reachable via `backend.functions.<name>.resources.lambda`.
- **CloudWatch RUM:** Not an Amplify primitive. Add via CDK escape hatch (`aws-cdk-lib/aws-rum`). Deferred until post-launch baseline metrics are needed.

---

## 9. Infrastructure as Code (IaC) Contract

The entire stack is defined in **Amplify Gen 2** (TypeScript on top of AWS CDK) in the `amplify/` directory.

- **Environments:** Per-branch Amplify environments. `npx ampx sandbox` provisions a personal dev backend; feature branches produce ephemeral staging environments; `main` deploys prod.
- **Statelessness:** All resources defined as code. No manual AWS Console changes — drift surfaces at the next `cdk synth`.
- **Deployment:** Amplify Hosting CI rebuilds and redeploys on every push. CDK-native rollback if a deploy fails health checks.

### Project Layout

```
amplify/
├── backend.ts                       # defineBackend({ auth, data, storage, ... })
├── auth/resource.ts                 # defineAuth (Cognito)
├── data/resource.ts                 # defineData (AppSync + DynamoDB)
├── storage/resource.ts              # defineStorage (S3)
└── functions/
    ├── osm-sync-worker/             # scheduled OSM ingest
    ├── region-populator/            # async region writeback
    └── thumbnail-generator/         # S3-triggered image processing
```

---

## 10. Implementation Milestones

| Sprint | Deliverable | Status |
| :--- | :--- | :--- |
| 1 | `defineAuth` (Cognito + `admins`/`editors` groups), `defineData` with `Skatepark` model + `region` / `geohash` GSIs | **Done** — sandbox + prod deployed |
| 2 | OSM ingest with multi-source enrichment | **Done as local CLI** (`scripts/ingest.mjs`); Lambda promotion deferred |
| 3 | `region-populator` Lambda + custom AppSync resolver pipeline for stale-region detection and async invocation | **Phase 2c — pending** |
| 4 | `defineStorage` for `skatepark-media` bucket + `thumbnail-generator` S3-triggered Lambda | **Pending** — gated by user-upload feature in `FRONTEND_SPEC.md` |
| 5 | Frontend swap: `src/services/osmService.ts` → AppSync client via hybrid service | **Done** — `src/services/skateparkService.ts` deployed |
| 6 *(deferred)* | OpenSearch via CDK escape hatch once semantic search is justified | Pending — triggers at >10k records or sustained semantic-query traffic |
| 7 *(quality)* | Tighten model auth from `allow.publicApiKey()` to the tiered design in §4 | Pending — see §4 `FIXME(prod)` |
| 8 *(data quality)* | Yelp Fusion API enrichment (free 5k req/day) — biggest single unlock for image coverage | Pending — registered as a deferred note |

### Data coverage snapshot

| Metric | Count |
| :--- | :--- |
| Total records in prod DynamoDB | ~472 |
| Regions seeded | 11 (`nyc`, `la`, `portland`, `sf`, `seattle`, `austin`, `chicago`, `denver`, `sandiego`, `boston`, `philly`) |
| Named (post enclosing-park resolution) | 354 (~75%) |
| Records with an image | 35 (~7%) |
| Records with a description | ~20 |
