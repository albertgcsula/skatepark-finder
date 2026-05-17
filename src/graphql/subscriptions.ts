/**
 * GraphQL subscriptions for Skatepark Finder
 * 
 * Real-time updates for skateparks and recommendations.
 */

import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'

const client = generateClient<Schema>({ authMode: 'apiKey' })

// ============================================================================
// SKATEPARK SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to skatepark creation events
 */
export function onCreateSkatepark(
  callback: (data: Schema['Skatepark']['type']) => void
) {
  const subscription = client.models.Skatepark.onCreate().subscribe({
    next: (data) => {
      console.log('[subscriptions] New skatepark created:', data)
      callback(data)
    },
    error: (error) => {
      console.error('[subscriptions] Error on skatepark creation:', error)
    },
  })
  
  return subscription
}

/**
 * Subscribe to skatepark update events
 */
export function onUpdateSkatepark(
  callback: (data: Schema['Skatepark']['type']) => void
) {
  const subscription = client.models.Skatepark.onUpdate().subscribe({
    next: (data) => {
      console.log('[subscriptions] Skatepark updated:', data)
      callback(data)
    },
    error: (error) => {
      console.error('[subscriptions] Error on skatepark update:', error)
    },
  })
  
  return subscription
}

/**
 * Subscribe to skatepark deletion events
 */
export function onDeleteSkatepark(
  callback: (data: Schema['Skatepark']['type']) => void
) {
  const subscription = client.models.Skatepark.onDelete().subscribe({
    next: (data) => {
      console.log('[subscriptions] Skatepark deleted:', data)
      callback(data)
    },
    error: (error) => {
      console.error('[subscriptions] Error on skatepark deletion:', error)
    },
  })
  
  return subscription
}

// ============================================================================
// RECOMMENDATION SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to new recommendation submissions
 */
export function onCreateRecommendation(
  callback: (data: Schema['Recommendation']['type']) => void
) {
  const subscription = client.models.Recommendation.onCreate().subscribe({
    next: (data) => {
      console.log('[subscriptions] New recommendation submitted:', data)
      callback(data)
    },
    error: (error) => {
      console.error('[subscriptions] Error on recommendation creation:', error)
    },
  })
  
  return subscription
}

/**
 * Subscribe to recommendation updates (status changes, edits)
 */
export function onUpdateRecommendation(
  callback: (data: Schema['Recommendation']['type']) => void
) {
  const subscription = client.models.Recommendation.onUpdate().subscribe({
    next: (data) => {
      console.log('[subscriptions] Recommendation updated:', data)
      callback(data)
    },
    error: (error) => {
      console.error('[subscriptions] Error on recommendation update:', error)
    },
  })
  
  return subscription
}

/**
 * Subscribe to recommendation deletions
 */
export function onDeleteRecommendation(
  callback: (data: Schema['Recommendation']['type']) => void
) {
  const subscription = client.models.Recommendation.onDelete().subscribe({
    next: (data) => {
      console.log('[subscriptions] Recommendation deleted:', data)
      callback(data)
    },
    error: (error) => {
      console.error('[subscriptions] Error on recommendation deletion:', error)
    },
  })
  
  return subscription
}

// ============================================================================
// COMBINED SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribe to all skatepark events
 */
export function subscribeToAllSkateparkEvents(callbacks: {
  onCreate?: (data: Schema['Skatepark']['type']) => void
  onUpdate?: (data: Schema['Skatepark']['type']) => void
  onDelete?: (data: Schema['Skatepark']['type']) => void
}) {
  const subscriptions = []
  
  if (callbacks.onCreate) {
    subscriptions.push(onCreateSkatepark(callbacks.onCreate))
  }
  
  if (callbacks.onUpdate) {
    subscriptions.push(onUpdateSkatepark(callbacks.onUpdate))
  }
  
  if (callbacks.onDelete) {
    subscriptions.push(onDeleteSkatepark(callbacks.onDelete))
  }
  
  return {
    unsubscribe: () => {
      subscriptions.forEach(sub => sub.unsubscribe())
    },
  }
}

/**
 * Subscribe to all recommendation events
 */
export function subscribeToAllRecommendationEvents(callbacks: {
  onCreate?: (data: Schema['Recommendation']['type']) => void
  onUpdate?: (data: Schema['Recommendation']['type']) => void
  onDelete?: (data: Schema['Recommendation']['type']) => void
}) {
  const subscriptions = []
  
  if (callbacks.onCreate) {
    subscriptions.push(onCreateRecommendation(callbacks.onCreate))
  }
  
  if (callbacks.onUpdate) {
    subscriptions.push(onUpdateRecommendation(callbacks.onUpdate))
  }
  
  if (callbacks.onDelete) {
    subscriptions.push(onDeleteRecommendation(callbacks.onDelete))
  }
  
  return {
    unsubscribe: () => {
      subscriptions.forEach(sub => sub.unsubscribe())
    },
  }
}

export { client }
