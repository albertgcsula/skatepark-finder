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
    })
    .secondaryIndexes((index) => [
      index('region').sortKeys(['osmId']),
      index('geohash'),
    ])
    .authorization((allow) => [
      // FIXME(prod): tighten to ['read'] before going live. `create`/`update`
      // are temporarily granted to apiKey so the local seed script can run
      // without Cognito user provisioning. Sandbox-only.
      allow.publicApiKey().to(['read', 'create', 'update']),
      allow.authenticated().to(['read']),
      allow.groups(['admins']).to(['create', 'read', 'update', 'delete']),
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
