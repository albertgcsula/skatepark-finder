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
      // FIXME(prod): tighten before going live. Mixing publicApiKey with
      // authenticated/groups caused field-level @aws_api_key directives to not
      // propagate to optional fields, surfacing as "Unauthorized on [imageUrl,
      // description, ...]" errors. For sandbox/dev we use a single auth
      // provider. Before prod: split read (publicApiKey) from write (groups).
      allow.publicApiKey(),
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
