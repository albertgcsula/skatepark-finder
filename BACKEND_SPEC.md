# Skatepark Finder Backend: Technical Specification (SDD)

This document defines the formal contract and architecture for the Skatepark Finder API. This specification follows **Spec-Driven Development (SDD)** principles—implementation must strictly adhere to these definitions.

---

## 1. Domain Model & Data Schema (DynamoDB)

The system uses a single-table design for maximum performance and cost-efficiency.

**Table Name:** `Skateparks`
**Primary Key Strategy:**
- **PK (Partition Key):** `REGION#{zipcode|city_slug}`
- **SK (Sort Key):** `SKATEPARK#{osm_id}`

### Attributes
| Attribute | Type | Description | Validation |
| :--- | :--- | :--- | :--- |
| `osm_id` | String | Unique ID from OpenStreetMap | Required |
| `name` | String | Human-readable name (Editable) | Required, max 100 chars |
| `description` | String | User-provided or OSM details | Max 1000 chars |
| `image_url` | String | S3 URL or external photo link | Valid URL |
| `lat` | Number | Latitude | -90 to 90 |
| `lng` | Number | Longitude | -180 to 180 |
| `address` | String | Editable physical address | Max 200 chars |
| `surface` | String | `concrete` \| `wood` \| `asphalt` \| `metal` | Enum |
| `type` | String | `skate_park` \| `pump_track` \| `bowl` | Enum |
| `last_updated` | String | ISO-8601 timestamp | Required |
| `geohash` | String | 12-char geohash for proximity search | Index Required |

---

## 2. API Definition (OpenAPI 3.0 Fragment)

The backend MUST implement the following RESTful interface via AWS API Gateway.

```yaml
paths:
  /skateparks:
    get:
      summary: Search skateparks by location
      # ... (params)
  /skateparks/{id}:
    get:
      summary: Get details for a specific skatepark
    patch:
      summary: Update skatepark metadata (Name, Address, Description)
      security: [ BearerAuth: [] ]
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                name: { type: string }
                address: { type: string }
                description: { type: string }
    post:
      summary: Upload an image for a skatepark
      # Returns a Presigned URL for S3 upload
```

---

## 3. Media Storage (AWS S3)

To handle skatepark images:
1. **S3 Bucket:** `skatepark-finder-media` (Public Read, Private Write).
2. **Upload Pipeline:** 
   - Frontend requests a **Presigned URL** from a Lambda.
   - Frontend uploads the image directly to S3.
   - S3 Trigger (Lambda) generates thumbnails and updates the DynamoDB `image_url` attribute.

---

## 4. Data Sourcing Strategy

Metadata is sourced from three primary channels:
1. **Initial Seed (OSM):** Map `description` from OSM tags like `note` or `description`. Map `image_url` from `wikimedia_commons` if available.
2. **User Contributions:** Allow registered users to update fields. Updates are validated via a `PendingEdits` table or applied directly if user trust score is high.
3. **Manual Curation:** Admin overrides via a protected dashboard.

---

## 5. ETL & Data Ingestion Pipeline

The system uses a **Hybrid Ingestion Model** to balance data freshness with performance.

### A. Scheduled Sync (The "Maintenance" Worker)
- **Trigger:** EventBridge Rule (Every 24 hours).
- **Purpose:** Refreshes known high-traffic areas and cleans up stale data.
- **Query:** Overpass QL targeting global or major metropolitan areas.

### B. Search-Triggered Population (The "Just-In-Time" Worker)
To ensure the database is populated dynamically based on user demand:
1. **Cache Miss/Stale Check:** When a user searches a region, the `Search Lambda` checks if the `REGION` partition exists and if `last_updated` is within the threshold (e.g., 7 days).
2. **On-Demand Fetch:** If data is missing or stale, the Lambda fetches fresh data from the Overpass API.
3. **Lazy Write:**
   - The user receives the response immediately (using the fresh OSM data).
   - An asynchronous process (via Lambda Destination or SQS) writes the new/updated records to DynamoDB for future users.

---

## 4. Search-Triggered Population Logic (Sequence)

1. **User Search** (`q=90210`) -> `Search Lambda`.
2. **DynamoDB Query:** `SELECT * FROM Skateparks WHERE PK = 'REGION#90210'`.
3. **Decision Logic:**
   - **If Found & Fresh:** Return results (Sub-50ms).
   - **If Found but Stale** OR **Not Found:**
     - Fetch from Overpass API.
     - Return results to User.
     - Dispatch `UpdateDynamoDB` event to SQS/EventBridge.
4. **Asynchronous Population:** `osm-sync-worker` consumes the event and performs a `BatchWriteItem` to update the DynamoDB table.

---

## 5. Performance & Caching Contract

- **L1 Cache (Client):** `Cache-Control: public, max-age=3600` (1 hour) for search results.
- **L2 Cache (Edge):** CloudFront to cache GET requests based on query string parameters.
- **Database Performance:**
  - Proximity searches MUST use the `geohash` attribute via a Global Secondary Index (GSI) to avoid full table scans.
  - Target Latency: P95 < 150ms for search queries.

## 6. Advanced Technical Enhancements

### A. Semantic Search & Discovery (OpenSearch)
As the description and review data grows, basic keyword search is insufficient.
- **Integration:** Synchronize DynamoDB streams to an **Amazon OpenSearch** cluster.
- **Feature Search:** Enable natural language queries like *"Concrete bowl with pool coping and shade"* using vector embeddings.

### B. Real-time Communication (AWS AppSync / WebSockets)
For "Live Check-ins" and community features:
- **GraphQL Subscriptions:** Use AWS AppSync to push real-time updates to the frontend when a user checks in or a new photo is approved.
- **Advantage:** Reduces API polling and provides a "live" feel to the application.

### C. Deep Observability & Monitoring
- **AWS X-Ray:** Implement distributed tracing to identify bottlenecks in the Lambda-to-DynamoDB pipeline.
- **CloudWatch RUM (Real User Monitoring):** Capture client-side performance metrics (Core Web Vitals) and errors directly from the user's browser.

---

## 7. Infrastructure as Code (IaC) Contract

The entire stack MUST be defined in **AWS CDK (TypeScript)**.
- **Environments:** Strict parity between `dev`, `staging`, and `prod`.
- **Statelessness:** No manual changes in the AWS Console.
- **Deployment:** GitHub Actions pipeline to run `cdk deploy` after successful testing.

---

## 8. Implementation Milestones

1. **Sprint 1:** Define CloudFormation/SAM template for DynamoDB table and GSI.
2. **Sprint 2:** Implement `osm-sync-worker` Lambda with Overpass API integration.
3. **Sprint 3:** Deploy API Gateway and Search Lambda with geohash filtering logic.
4. **Sprint 4:** Implement Frontend switch from `osmService.ts` to `apiService.ts`.
