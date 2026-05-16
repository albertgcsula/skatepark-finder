import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
import { fetchSkateparks as fetchSkateparksOsm } from './osmService'
import type { Skatepark } from './osmService'

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

async function fetchFromDdb(lat: number, lon: number, radiusMiles: number): Promise<Skatepark[]> {
  if (!client) return []
  // Phase 2b: list all and filter client-side. At 179 records this is trivial.
  // When the DB grows we'll switch to geohash-bucket queries.
  let nextToken: string | undefined | null = undefined
  const all: Array<Schema['Skatepark']['type']> = []
  do {
    const page = await client.models.Skatepark.list({ limit: 1000, nextToken: nextToken ?? undefined })
    if (page.errors?.length) {
      console.error('[skateparkService] DynamoDB list errors:', page.errors)
      return []
    }
    all.push(...(page.data ?? []))
    nextToken = page.nextToken
  } while (nextToken)

  const enriched: Skatepark[] = all
    .map((r) => ({
      id: r.id,
      lat: r.lat,
      lon: r.lng,
      name: r.name,
      address: r.address ?? undefined,
      description: r.description ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      imageAttribution: r.imageAttribution ?? undefined,
      imageLicense: r.imageLicense ?? undefined,
      website: r.website ?? undefined,
      distance: haversine(lat, lon, r.lat, r.lng),
      source: 'ddb' as const,
    }))
    .filter((p) => (p.distance ?? Infinity) <= radiusMiles)
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))

  return enriched
}

/**
 * Hybrid query: DynamoDB first (enriched data), OSM fallback if no DDB results
 * within the search radius.
 */
export async function fetchSkateparksHybrid(
  lat: number,
  lon: number,
  radiusMiles: number,
): Promise<Skatepark[]> {
  if (amplifyConfigured) {
    try {
      const ddbResults = await fetchFromDdb(lat, lon, radiusMiles)
      if (ddbResults.length > 0) {
        console.log(`[skateparkService] DDB hit: ${ddbResults.length} records`)
        return ddbResults
      }
      console.log('[skateparkService] DDB empty for region, falling back to OSM')
    } catch (err) {
      console.warn('[skateparkService] DDB query failed, falling back to OSM:', err)
    }
  }
  return fetchSkateparksOsm(lat, lon, radiusMiles)
}
