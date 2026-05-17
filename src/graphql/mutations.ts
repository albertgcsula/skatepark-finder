/**
 * GraphQL mutations for Skatepark Finder
 * 
 * These mutations work with the Amplify Data client.
 * Import the generated client and use these for create/update/delete operations.
 */

import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

const client = generateClient<Schema>({ authMode: 'apiKey' })

// ============================================================================
// SKATEPARK MUTATIONS
// ============================================================================

/**
 * Create a new skatepark
 */
export async function createSkatepark(input: {
  osmId: string
  osmType?: string
  name: string
  description?: string
  imageUrl?: string
  imageLicense?: string
  imageAttribution?: string
  imageSource?: string
  lat: number
  lng: number
  address?: string
  website?: string
  surface?: string
  geohash: string
  region: string
  placeType?: 'park' | 'spot' | 'shop'
}) {
  return await client.models.Skatepark.create(input)
}

/**
 * Update an existing skatepark
 */
export async function updateSkatepark(
  id: string,
  updates: {
    name?: string
    description?: string
    imageUrl?: string
    imageLicense?: string
    imageAttribution?: string
    imageSource?: string
    address?: string
    website?: string
    surface?: string
    placeType?: 'park' | 'spot' | 'shop'
  }
) {
  return await client.models.Skatepark.update({
    id,
    ...updates,
  })
}

/**
 * Delete a skatepark
 */
export async function deleteSkatepark(id: string) {
  return await client.models.Skatepark.delete({ id })
}

/**
 * Bulk create skateparks
 */
export async function bulkCreateSkateparks(
  skateparks: Array<{
    osmId: string
    osmType?: string
    name: string
    description?: string
    imageUrl?: string
    imageLicense?: string
    imageAttribution?: string
    imageSource?: string
    lat: number
    lng: number
    address?: string
    website?: string
    surface?: string
    geohash: string
    region: string
    placeType?: 'park' | 'spot' | 'shop'
  }>
) {
  const results = await Promise.allSettled(
    skateparks.map(park => client.models.Skatepark.create(park))
  )
  
  const successful = results.filter(r => r.status === 'fulfilled')
  const failed = results.filter(r => r.status === 'rejected')
  
  console.log(`[mutations] Created ${successful.length} skateparks, ${failed.length} failed`)
  
  return { successful, failed, results }
}

// ============================================================================
// RECOMMENDATION MUTATIONS
// ============================================================================

/**
 * Submit a new recommendation
 */
export async function createRecommendation(input: {
  type: 'skatepark' | 'spot' | 'shop'
  name: string
  address: string
  description?: string
  website?: string
  submitterEmail?: string
  referralCode?: string
  status?: 'pending' | 'approved' | 'rejected'
}) {
  return await client.models.Recommendation.create({
    ...input,
    status: input.status || 'pending',
  })
}

/**
 * Update recommendation status (admin action)
 */
export async function updateRecommendationStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected'
) {
  return await client.models.Recommendation.update({
    id,
    status,
  })
}

/**
 * Approve a recommendation
 */
export async function approveRecommendation(id: string) {
  return updateRecommendationStatus(id, 'approved')
}

/**
 * Reject a recommendation
 */
export async function rejectRecommendation(id: string) {
  return updateRecommendationStatus(id, 'rejected')
}

/**
 * Update a recommendation
 */
export async function updateRecommendation(
  id: string,
  updates: {
    type?: 'skatepark' | 'spot' | 'shop'
    name?: string
    address?: string
    description?: string
    website?: string
    submitterEmail?: string
    status?: 'pending' | 'approved' | 'rejected'
  }
) {
  return await client.models.Recommendation.update({
    id,
    ...updates,
  })
}

/**
 * Delete a recommendation
 */
export async function deleteRecommendation(id: string) {
  return await client.models.Recommendation.delete({ id })
}

/**
 * Bulk approve recommendations
 */
export async function bulkApproveRecommendations(ids: string[]) {
  const results = await Promise.allSettled(
    ids.map(id => approveRecommendation(id))
  )
  
  const successful = results.filter(r => r.status === 'fulfilled')
  const failed = results.filter(r => r.status === 'rejected')
  
  console.log(`[mutations] Approved ${successful.length} recommendations, ${failed.length} failed`)
  
  return { successful, failed, results }
}

/**
 * Bulk reject recommendations
 */
export async function bulkRejectRecommendations(ids: string[]) {
  const results = await Promise.allSettled(
    ids.map(id => rejectRecommendation(id))
  )
  
  const successful = results.filter(r => r.status === 'fulfilled')
  const failed = results.filter(r => r.status === 'rejected')
  
  console.log(`[mutations] Rejected ${successful.length} recommendations, ${failed.length} failed`)
  
  return { successful, failed, results }
}

/**
 * Delete bot submissions (honeypot field is not empty)
 */
export async function deleteBotRecommendations() {
  // First, fetch all recommendations
  type RecPage = {
    data?: Array<Schema['Recommendation']['type']>
    errors?: Array<{ message?: string }>
    nextToken?: string | null
  }
  let nextToken: string | undefined | null = undefined
  const botSubmissions: string[] = []

  do {
    const page: RecPage = await client.models.Recommendation.list({
      limit: 1000,
      nextToken: nextToken ?? undefined,
    })

    if (page.data) {
      const bots = page.data
        .filter((rec) => rec.referralCode && rec.referralCode !== '')
        .map((rec) => rec.id)

      botSubmissions.push(...bots)
    }

    nextToken = page.nextToken
  } while (nextToken)
  
  // Delete bot submissions
  const results = await Promise.allSettled(
    botSubmissions.map(id => client.models.Recommendation.delete({ id }))
  )
  
  const successful = results.filter(r => r.status === 'fulfilled')
  const failed = results.filter(r => r.status === 'rejected')
  
  console.log(`[mutations] Deleted ${successful.length} bot submissions, ${failed.length} failed`)
  
  return { successful, failed, results }
}

export { client }
