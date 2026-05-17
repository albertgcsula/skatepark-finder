/**
 * GraphQL queries for Skatepark Finder
 * 
 * These queries work with the Amplify Data client.
 * Import the generated client and use these as reference for your queries.
 */

import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

const client = generateClient<Schema>({ authMode: 'apiKey' })

// ============================================================================
// SKATEPARK QUERIES
// ============================================================================

/**
 * List all skateparks (paginated)
 */
export async function listSkateparks(limit = 100, nextToken?: string) {
  return await client.models.Skatepark.list({
    limit,
    nextToken,
  })
}

/**
 * Get a specific skatepark by ID
 */
export async function getSkateparkById(id: string) {
  return await client.models.Skatepark.get({ id })
}

/**
 * List skateparks by region (uses secondary index)
 * Regions: 'austin', 'boston', 'chicago', 'denver', 'la', 'nyc', 'philly', 'portland', 'sandiego', 'seattle', 'sf'
 */
export async function listSkateparksByRegion(region: string, limit = 100, nextToken?: string) {
  // The exact generated index method name + arg shape varies by Amplify Gen 2
  // version. Casting until this helper is wired up in real call sites.
  return await (client.models.Skatepark as unknown as { listSkateparkByRegion: (args: unknown) => Promise<unknown> }).listSkateparkByRegion({
    region,
    limit,
    nextToken,
  })
}

/**
 * List skateparks by geohash (uses secondary index)
 * Useful for geographic queries
 */
export async function listSkateparksByGeohash(geohash: string, limit = 100, nextToken?: string) {
  return await (client.models.Skatepark.listSkateparkByGeohash as (args: unknown) => Promise<unknown>)({
    geohash,
    limit,
    nextToken,
  })
}

/**
 * Filter skateparks by place type
 * Place types: 'park', 'spot', 'shop'
 */
export async function filterSkateparksByPlaceType(placeType: string, limit = 1000) {
  const response = await client.models.Skatepark.list({ limit })
  
  if (response.data) {
    const filtered = response.data.filter(park => park.placeType === placeType)
    return { ...response, data: filtered }
  }
  
  return response
}

/**
 * Search skateparks by name (client-side filter)
 */
export async function searchSkateparksByName(searchTerm: string, limit = 1000) {
  const response = await client.models.Skatepark.list({ limit })
  
  if (response.data) {
    const searchLower = searchTerm.toLowerCase()
    const filtered = response.data.filter(park => 
      park.name.toLowerCase().includes(searchLower)
    )
    return { ...response, data: filtered }
  }
  
  return response
}

/**
 * Get skateparks with images only
 */
export async function listSkateparksWithImages(limit = 1000) {
  const response = await client.models.Skatepark.list({ limit })
  
  if (response.data) {
    const filtered = response.data.filter(park => park.imageUrl !== null)
    return { ...response, data: filtered }
  }
  
  return response
}

/**
 * Get all skateparks in a region with specific place type
 */
export async function getSkateparksByRegionAndType(
  region: string,
  placeType: string,
  limit = 100
) {
  type RegionResponse = {
    data?: Array<Schema['Skatepark']['type']>
    errors?: Array<{ message?: string }>
    nextToken?: string | null
  }
  const response: RegionResponse = await (client.models.Skatepark as unknown as { listSkateparkByRegion: (args: unknown) => Promise<RegionResponse> }).listSkateparkByRegion({
    region,
    limit,
  })

  if (response.data) {
    const filtered = response.data.filter((park) => park.placeType === placeType)
    return { ...response, data: filtered }
  }

  return response
}

// ============================================================================
// RECOMMENDATION QUERIES
// ============================================================================

/**
 * List all recommendations (paginated)
 */
export async function listRecommendations(limit = 100, nextToken?: string) {
  return await client.models.Recommendation.list({
    limit,
    nextToken,
  })
}

/**
 * Get a specific recommendation by ID
 */
export async function getRecommendationById(id: string) {
  return await client.models.Recommendation.get({ id })
}

/**
 * Filter recommendations by status
 * Status values: 'pending', 'approved', 'rejected'
 */
export async function filterRecommendationsByStatus(status: string, limit = 1000) {
  const response = await client.models.Recommendation.list({ limit })
  
  if (response.data) {
    const filtered = response.data.filter(rec => rec.status === status)
    return { ...response, data: filtered }
  }
  
  return response
}

/**
 * Get pending recommendations (for admin review)
 */
export async function getPendingRecommendations(limit = 1000) {
  return filterRecommendationsByStatus('pending', limit)
}

/**
 * Get approved recommendations
 */
export async function getApprovedRecommendations(limit = 1000) {
  return filterRecommendationsByStatus('approved', limit)
}

/**
 * Filter recommendations by type
 * Types: 'skatepark', 'spot', 'shop'
 */
export async function filterRecommendationsByType(type: string, limit = 1000) {
  const response = await client.models.Recommendation.list({ limit })
  
  if (response.data) {
    const filtered = response.data.filter(rec => rec.type === type)
    return { ...response, data: filtered }
  }
  
  return response
}

/**
 * Filter recommendations by status and type
 */
export async function getRecommendationsByStatusAndType(
  status: string,
  type: string,
  limit = 1000
) {
  const response = await client.models.Recommendation.list({ limit })
  
  if (response.data) {
    const filtered = response.data.filter(
      rec => rec.status === status && rec.type === type
    )
    return { ...response, data: filtered }
  }
  
  return response
}

/**
 * Get non-bot recommendations (honeypot field is empty)
 */
export async function getValidRecommendations(limit = 1000) {
  const response = await client.models.Recommendation.list({ limit })
  
  if (response.data) {
    const filtered = response.data.filter(
      (rec) => !rec.referralCode || rec.referralCode === '',
    )
    return { ...response, data: filtered }
  }
  
  return response
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type ListPage<T> = {
  data?: T[]
  errors?: Array<{ message?: string }>
  nextToken?: string | null
}

/**
 * Fetch all items with automatic pagination
 */
export async function fetchAllSkateparks() {
  let nextToken: string | undefined | null = undefined
  const all: Array<Schema['Skatepark']['type']> = []

  do {
    const page: ListPage<Schema['Skatepark']['type']> = await client.models.Skatepark.list({
      limit: 1000,
      nextToken: nextToken ?? undefined,
    })

    if (page.errors?.length) {
      console.error('[queries] Error fetching skateparks:', page.errors)
      break
    }

    all.push(...(page.data ?? []))
    nextToken = page.nextToken
  } while (nextToken)

  return all
}

/**
 * Fetch all recommendations with automatic pagination
 */
export async function fetchAllRecommendations() {
  let nextToken: string | undefined | null = undefined
  const all: Array<Schema['Recommendation']['type']> = []

  do {
    const page: ListPage<Schema['Recommendation']['type']> = await client.models.Recommendation.list({
      limit: 1000,
      nextToken: nextToken ?? undefined,
    })

    if (page.errors?.length) {
      console.error('[queries] Error fetching recommendations:', page.errors)
      break
    }

    all.push(...(page.data ?? []))
    nextToken = page.nextToken
  } while (nextToken)

  return all
}

/**
 * Count skateparks by region
 */
export async function countSkateparksByRegion() {
  const skateparks = await fetchAllSkateparks()
  const counts: Record<string, number> = {}
  
  for (const park of skateparks) {
    counts[park.region] = (counts[park.region] || 0) + 1
  }
  
  return counts
}

/**
 * Count skateparks by place type
 */
export async function countSkateparksByPlaceType() {
  const skateparks = await fetchAllSkateparks()
  const counts: Record<string, number> = { park: 0, spot: 0, shop: 0, unknown: 0 }
  
  for (const park of skateparks) {
    const type = park.placeType || 'unknown'
    counts[type] = (counts[type] || 0) + 1
  }
  
  return counts
}

export { client }
