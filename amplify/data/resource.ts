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
    })
    .secondaryIndexes((index) => [
      index('region').sortKeys(['osmId']),
      index('geohash'),
    ])
    .authorization((allow) => [
      // FIXME(prod): tighten before going live. Mixing publicApiKey with
      // authenticated/groups caused field-level @aws_api_key directives to not
      // propagate to optional fields, surfacing as "Unauthorized on [imageUrl,
      // description, ...]" errors. For sandbox/dev we use a single auth
      // provider. Before prod: split read (publicApiKey) from write (groups).
      allow.publicApiKey(),
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
      // Honeypot: should always be empty. Non-empty values indicate a bot
      // submission and are filtered out at review time.
      honeypot: a.string(),
      // 'pending' | 'approved' | 'rejected'. Defaulted by the submit form to
      // 'pending'; admin updates via the AppSync console.
      status: a.string().required(),
    })
    .authorization((allow) => [allow.publicApiKey()]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'apiKey',
    apiKeyAuthorizationMode: { expiresInDays: 365 },
  },
})
