import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../amplify/data/resource'
// Side-effect import: skateparkService runs Amplify.configure at module load,
// reading amplify_outputs.json. Importing it here ensures the Amplify client
// is configured when a user visits /submit without first hitting the home
// route. Amplify.configure is idempotent.
import { isAmplifyConfigured } from './skateparkService'

const client = isAmplifyConfigured() ? generateClient<Schema>({ authMode: 'apiKey' }) : null

export const isRecommendationSubmissionAvailable = () => client !== null

export type RecommendationType = 'skatepark' | 'spot' | 'shop'

export interface RecommendationInput {
  type: RecommendationType
  name: string
  address: string
  description?: string
  website?: string
  submitterEmail?: string
}

export async function submitRecommendation(input: RecommendationInput): Promise<void> {
  if (!client) {
    throw new Error('Submission is not available right now. Please try again later.')
  }
  const { errors } = await client.models.Recommendation.create({
    type: input.type,
    name: input.name.trim(),
    address: input.address.trim(),
    description: input.description?.trim() || undefined,
    website: input.website?.trim() || undefined,
    submitterEmail: input.submitterEmail?.trim() || undefined,
    referralCode: '',
    status: 'pending',
  })
  if (errors?.length) {
    console.error('[recommendationService] create errors:', errors)
    throw new Error(errors[0]?.message ?? 'Submission failed.')
  }
}
