# GraphQL Queries for Skatepark Finder

This directory contains all GraphQL operations (queries, mutations, and subscriptions) for the Skatepark Finder application.

## Structure

- **queries.ts** - Read operations for skateparks and recommendations
- **mutations.ts** - Create, update, and delete operations
- **subscriptions.ts** - Real-time updates for data changes
- **index.ts** - Centralized exports for easy importing

## Usage

### Basic Queries

```typescript
import { listSkateparks, getSkateparkById } from '@/graphql'

// List skateparks with pagination
const { data, errors, nextToken } = await listSkateparks(100)

// Get a specific skatepark
const { data: skatepark } = await getSkateparkById('some-id')
```

### Regional Queries

```typescript
import { listSkateparksByRegion } from '@/graphql'

// Get skateparks in a specific region (uses secondary index)
const { data } = await listSkateparksByRegion('sf', 100)
```

Available regions: `austin`, `boston`, `chicago`, `denver`, `la`, `nyc`, `philly`, `portland`, `sandiego`, `seattle`, `sf`

### Filtering

```typescript
import { 
  filterSkateparksByPlaceType,
  searchSkateparksByName,
  listSkateparksWithImages 
} from '@/graphql'

// Filter by place type
const { data: parks } = await filterSkateparksByPlaceType('park')
const { data: spots } = await filterSkateparksByPlaceType('spot')
const { data: shops } = await filterSkateparksByPlaceType('shop')

// Search by name
const { data } = await searchSkateparksByName('golden gate')

// Get only skateparks with images
const { data } = await listSkateparksWithImages()
```

### Recommendations

```typescript
import { 
  createRecommendation,
  getPendingRecommendations,
  approveRecommendation 
} from '@/graphql'

// Submit a new recommendation
const { data } = await createRecommendation({
  type: 'skatepark',
  name: 'My Local Park',
  address: '123 Main St, San Francisco, CA',
  description: 'Great bowl and street section',
  website: 'https://example.com',
  submitterEmail: 'user@example.com',
})

// Get pending recommendations (for admin review)
const { data } = await getPendingRecommendations()

// Approve a recommendation
await approveRecommendation('recommendation-id')
```

### Mutations

```typescript
import { 
  createSkatepark,
  updateSkatepark,
  deleteSkatepark 
} from '@/graphql'

// Create a skatepark
const { data } = await createSkatepark({
  osmId: 'way/123456789',
  name: 'Golden Gate Park Skatepark',
  lat: 37.7694,
  lng: -122.4862,
  geohash: '9q8yy',
  region: 'sf',
  placeType: 'park',
  surface: 'concrete',
  address: 'Golden Gate Park, San Francisco, CA',
})

// Update a skatepark
await updateSkatepark('skatepark-id', {
  description: 'Updated description',
  imageUrl: 'https://example.com/image.jpg',
})

// Delete a skatepark
await deleteSkatepark('skatepark-id')
```

### Subscriptions (Real-time Updates)

```typescript
import { 
  onCreateSkatepark,
  subscribeToAllRecommendationEvents 
} from '@/graphql'

// Subscribe to new skateparks
const subscription = onCreateSkatepark((skatepark) => {
  console.log('New skatepark added:', skatepark)
  // Update your UI here
})

// Unsubscribe when done
subscription.unsubscribe()

// Subscribe to all recommendation events
const allSubs = subscribeToAllRecommendationEvents({
  onCreate: (rec) => console.log('New recommendation:', rec),
  onUpdate: (rec) => console.log('Recommendation updated:', rec),
  onDelete: (rec) => console.log('Recommendation deleted:', rec),
})

// Unsubscribe from all
allSubs.unsubscribe()
```

### Helper Functions

```typescript
import { 
  fetchAllSkateparks,
  countSkateparksByRegion,
  countSkateparksByPlaceType 
} from '@/graphql'

// Fetch all skateparks with automatic pagination
const allSkateparks = await fetchAllSkateparks()

// Get count by region
const regionCounts = await countSkateparksByRegion()
// { sf: 42, la: 38, nyc: 51, ... }

// Get count by place type
const typeCounts = await countSkateparksByPlaceType()
// { park: 200, spot: 150, shop: 50, unknown: 10 }
```

### Bulk Operations

```typescript
import { 
  bulkCreateSkateparks,
  bulkApproveRecommendations,
  deleteBotRecommendations 
} from '@/graphql'

// Bulk create skateparks
const { successful, failed } = await bulkCreateSkateparks([
  { osmId: 'way/1', name: 'Park 1', lat: 37.7, lng: -122.4, geohash: '9q8', region: 'sf' },
  { osmId: 'way/2', name: 'Park 2', lat: 37.8, lng: -122.5, geohash: '9q9', region: 'sf' },
])

// Bulk approve recommendations
await bulkApproveRecommendations(['id1', 'id2', 'id3'])

// Delete bot submissions (honeypot field not empty)
await deleteBotRecommendations()
```

## Error Handling

All operations return errors in the response object:

```typescript
const { data, errors } = await listSkateparks()

if (errors?.length) {
  console.error('GraphQL errors:', errors)
  // Handle errors
}

if (data) {
  // Use data
}
```

## Types

All operations are fully typed using the generated Amplify schema:

```typescript
import type { Schema } from '../../amplify/data/resource'

type Skatepark = Schema['Skatepark']['type']
type Recommendation = Schema['Recommendation']['type']
```

## Secondary Indexes

The schema includes two secondary indexes for efficient querying:

1. **region-osmId-index** - Query skateparks by region
2. **geohash-index** - Query skateparks by geohash for geographic searches

## Notes

- All operations use `apiKey` auth mode (public access)
- Pagination uses `limit` and `nextToken` parameters
- Client-side filtering is used for complex queries without direct index support
- Honeypot field in recommendations helps filter out bot submissions
