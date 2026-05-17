import { a, defineData, type ClientSchema } from '@aws-amplify/backend'

const schema = a.schema({
  Skatepark: a
    .model({
      osmId: a.string().required(),
      osmType: a.string(),
      name: a.string().required(),
      description: a.string(),
      imageUrl: a.url(),
      imageLicense: a.string(),
      imageAttribution: a.string(),
      imageSource: a.string(),
      lat: a.float().required(),
      lng: a.float().required(),
      address: a.string(),
      website: a.url(),
      surface: a.string(),
      geohash: a.string().required(),
      region: a.string().required(),
      // 'park' | 'spot' | 'shop'. Optional so existing rows seeded before this
      // column was added remain valid; backfilled by the next seed run.
      placeType: a.string(),
      // Yelp enrichment. All optional — populated by the ingest script when a
      // Yelp business matches the OSM coords + name; null for parks with no
      // Yelp match (DIY spots, unlisted parks).
      rating: a.float(),
      reviewCount: a.integer(),
      phone: a.string(),
      yelpUrl: a.url(),
    })
    .secondaryIndexes((index) => [
      index('region').sortKeys(['osmId']),
      index('geohash'),
    ])
    .authorization((allow) => [
      // Public via API key: read to populate the search UI, create to support
      // the auto-cache feature that persists OSM results into DDB after each
      // search. Update/delete are reserved for admins.
      allow.publicApiKey().to(['read', 'create']),
      // Admins: full control for moderation and cleanup. Reach this group via
      // the Cognito user pool; manage members in the AWS console.
      allow.groups(['admins']),
    ]),

  Recommendation: a
    .model({
      // Constrained client-side to 'skatepark' | 'spot' | 'shop'. Plain string
      // here because inline a.enum() interacts poorly with ClientSchema type
      // inference in this version of Amplify.
      type: a.string().required(),
      name: a.string().required(),
      address: a.string().required(),
      description: a.string(),
      website: a.url(),
      submitterEmail: a.email(),
      // Spam trap. Should always be empty on legitimate submissions; bots
      // auto-fill every input. Named innocuously so bots reading the GraphQL
      // schema docs don't recognize it as a honeypot.
      referralCode: a.string(),
      // 'pending' | 'approved' | 'rejected'. Defaulted by the submit form to
      // 'pending'; admin updates via the AppSync console.
      status: a.string().required(),
    })
    .authorization((allow) => [
      // Public can submit but cannot read other submissions (would expose
      // submitter emails) or modify existing ones.
      allow.publicApiKey().to(['create']),
      // Admins read/update/delete via AppSync console or future admin UI.
      allow.groups(['admins']),
    ]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
})
