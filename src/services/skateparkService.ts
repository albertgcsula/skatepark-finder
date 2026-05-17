import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import { fetchSkateparks as fetchSkateparksOsm } from './osmService'
import type { PlaceType, Skatepark } from './osmService'
import { closestRegion } from './regions'

// Load amplify_outputs.json via Vite's glob — gracefully handles the file
// being absent (e.g., dev server without `npx ampx sandbox` running).
const outputsGlob = import.meta.glob('/amplify_outputs.json', { eager: true }) as Record<string, { default: unknown }>
const amplifyOutputs = (Object.values(outputsGlob)[0]?.default ?? null) as Parameters<typeof Amplify.configure>[0] | null

let amplifyConfigured = false
if (amplifyOutputs) {
  try {
    Amplify.configure(amplifyOutputs)
    amplifyConfigured = true
  } catch (err) {
    console.warn('[skateparkService] Amplify.configure failed:', err)
  }
}

export const isAmplifyConfigured = () => amplifyConfigured

const client = amplifyConfigured ? generateClient<Schema>({ authMode: 'apiKey' }) : null

// ---------------------------------------------------------------------------

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type SkateparkListPage = {
  data?: Array<Schema['Skatepark']['type']>
  errors?: Array<{ message?: string }>
  nextToken?: string | null
}

async function fetchFromDdb(lat: number, lon: number, radiusMiles: number): Promise<Skatepark[]> {
  if (!client) return []
  // Phase 2b: list all and filter client-side. At ~500 records this is trivial.
  // When the DB grows we'll switch to geohash-bucket queries.
  let nextToken: string | undefined | null = undefined
  const all: Array<Schema['Skatepark']['type']> = []
  do {
    const page: SkateparkListPage = await client.models.Skatepark.list({ limit: 1000, nextToken: nextToken ?? undefined })
    if (page.errors?.length) {
      console.error('[skateparkService] DynamoDB list errors:', page.errors)
      return []
    }
    all.push(...(page.data ?? []))
    nextToken = page.nextToken
  } while (nextToken)

  return all
    .map((r) => ({
      // Use osmId as the canonical id so DDB and OSM records dedupe in the merge step.
      id: r.osmId,
      ddbId: r.id,
      lat: r.lat,
      lon: r.lng,
      name: r.name,
      address: r.address ?? undefined,
      description: r.description ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      imageAttribution: r.imageAttribution ?? undefined,
      imageLicense: r.imageLicense ?? undefined,
      website: r.website ?? undefined,
      placeType: (r.placeType ?? 'park') as PlaceType,
      geohash: r.geohash,
      distance: haversine(lat, lon, r.lat, r.lng),
      source: 'ddb' as const,
    }))
    .filter((p) => (p.distance ?? Infinity) <= radiusMiles)
}

/**
 * Union DynamoDB and OSM results, deduped by OSM id. DDB records take
 * precedence over OSM (richer fields). Falls back to OSM-only when Amplify
 * isn't configured (e.g., dev without `ampx sandbox`).
 *
 * Why union and not "DDB first, OSM fallback if empty": with ingest coverage
 * limited to specific bbox regions, a search near the edge of an ingested
 * region (e.g., Montebello CA, just outside our LA bbox) returns a few
 * nearby DDB records but misses the parks actually closest to the user. By
 * querying both sources in parallel, results from non-ingested areas
 * surface alongside the curated DDB data.
 */
export async function fetchSkateparksHybrid(
  lat: number,
  lon: number,
  radiusMiles: number,
): Promise<Skatepark[]> {
  const ddbPromise = amplifyConfigured
    ? fetchFromDdb(lat, lon, radiusMiles).catch((err) => {
        console.warn('[skateparkService] DDB query failed, continuing with OSM only:', err)
        return [] as Skatepark[]
      })
    : Promise.resolve([] as Skatepark[])

  // OSM errors are allowed to propagate — there's no further fallback and the
  // SkateparkContext catches them to display a user-visible error.
  const [ddbResults, osmResults] = await Promise.all([
    ddbPromise,
    fetchSkateparksOsm(lat, lon, radiusMiles),
  ])

  // Merge: start with OSM, then overlay DDB entries (DDB wins on duplicate
  // osmId because it has enriched fields like imageUrl/description).
  const byId = new Map<string, Skatepark>()
  for (const p of osmResults) byId.set(p.id, p)
  for (const p of ddbResults) byId.set(p.id, p)

  const merged = [...byId.values()].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
  console.log(
    `[skateparkService] merged: ${merged.length} total (${ddbResults.length} DDB, ${osmResults.length} OSM)`,
  )
  return merged
}

/**
 * Fire-and-forget cache write: persist OSM-only results to DDB so the next
 * search in this area hits the cache. Failures are logged but do not surface
 * to the user. Idempotency caveat: two concurrent searches over the same area
 * could both write the same osmId since the schema has no uniqueness
 * constraint on osmId (only `id` is unique). Duplicates collapse when read
 * because the client merges by osmId. Run `npm run seed` periodically to
 * dedupe.
 */
export async function cacheOsmResults(parks: Skatepark[]): Promise<void> {
  if (!client) return
  const toCache = parks.filter((p) => p.source === 'osm')
  if (toCache.length === 0) return

  const writes = toCache.map((p) =>
    client.models.Skatepark.create({
      osmId: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lon,
      address: p.address ?? null,
      website: p.website ?? null,
      description: p.description ?? null,
      imageUrl: p.imageUrl ?? null,
      imageAttribution: p.imageAttribution ?? null,
      imageLicense: p.imageLicense ?? null,
      placeType: p.placeType ?? 'park',
      geohash: p.geohash ?? '',
      region: closestRegion(p.lat, p.lon),
    }),
  )
  const results = await Promise.allSettled(writes)
  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length) {
    console.warn(`[skateparkService] cacheOsmResults: ${failed.length}/${toCache.length} writes failed`, failed)
  } else {
    console.log(`[skateparkService] cacheOsmResults: cached ${toCache.length} OSM records`)
  }
}
