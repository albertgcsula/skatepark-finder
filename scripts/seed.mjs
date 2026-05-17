#!/usr/bin/env node
// Seed DynamoDB from scripts/output/*.json via the Amplify Data client.
// Prereq: `npx ampx sandbox` must be running (or have produced amplify_outputs.json).
// Usage: npm run seed [-- --dry-run] [-- --region=nyc,la]

import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Amplify } from 'aws-amplify'
import { generateClient } from 'aws-amplify/data'
import { signIn, signOut } from 'aws-amplify/auth'
import geohash from 'ngeohash'
import { classifyPlaceType } from './lib/classifyPlaceType.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUTPUT_DIR = join(__dirname, 'output')
const OUTPUTS_FILE = process.env.AMPLIFY_OUTPUTS
  ? (process.env.AMPLIFY_OUTPUTS.startsWith('/') ? process.env.AMPLIFY_OUTPUTS : join(ROOT, process.env.AMPLIFY_OUTPUTS))
  : join(ROOT, 'amplify_outputs.json')

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const dryRun = !!args['dry-run']
const onlyRegions = args.region ? String(args.region).split(',') : null

// ---------------------------------------------------------------------------

if (!existsSync(OUTPUTS_FILE)) {
  console.error(`amplify_outputs.json not found at ${OUTPUTS_FILE}`)
  console.error(`Run \`npx ampx sandbox\` first to provision the dev backend.`)
  process.exit(1)
}

const outputs = JSON.parse(await readFile(OUTPUTS_FILE, 'utf8'))
Amplify.configure(outputs)

// Auth mode: default to apiKey (read+create only under tightened prod schema).
// If ADMIN_EMAIL + ADMIN_PASSWORD are provided, sign in as a Cognito admin so
// update operations succeed — required when re-seeding existing rows. The
// admin user must already be a member of the `admins` group in the user pool.
const adminEmail = process.env.ADMIN_EMAIL
const adminPassword = process.env.ADMIN_PASSWORD
let authMode = 'apiKey'
if (adminEmail && adminPassword) {
  console.log(`[seed] signing in as admin ${adminEmail}...`)
  await signIn({ username: adminEmail, password: adminPassword })
  authMode = 'userPool'
  console.log(`[seed] signed in; using userPool auth`)
}
const client = generateClient({ authMode })

console.log(`[seed] data endpoint: ${outputs.data?.url ?? '(unknown)'}`)
console.log(`[seed] authMode=${authMode} dryRun=${dryRun}${onlyRegions ? ` regions=${onlyRegions.join(',')}` : ''}`)

// ---------------------------------------------------------------------------
// Load ingest output files

const files = (await readdir(OUTPUT_DIR)).filter((f) => f.endsWith('.json'))
if (files.length === 0) {
  console.error(`No JSON files in ${OUTPUT_DIR}. Run \`npm run ingest\` first.`)
  process.exit(1)
}

let allRecords = []
for (const f of files) {
  const region = basename(f, '.json')
  if (onlyRegions && !onlyRegions.includes(region)) continue
  const data = JSON.parse(await readFile(join(OUTPUT_DIR, f), 'utf8'))
  console.log(`[seed] ${region}: ${data.records.length} records`)
  for (const r of data.records) {
    allRecords.push({ ...r, region })
  }
}
console.log(`[seed] total: ${allRecords.length} records to seed`)

// ---------------------------------------------------------------------------
// Transform: ingest record → Skatepark model row

function toSkatepark(r) {
  return {
    osmId: `${r.osmType}/${r.osmId}`, // unique key combining type+id
    osmType: r.osmType,
    name: r.name || 'Unnamed Skatepark',
    description: r.description ?? null,
    imageUrl: r.imageUrl ?? null,
    imageLicense: r.imageLicense ?? null,
    imageAttribution: r.imageAttribution ?? null,
    imageSource: r.imageSource ?? null,
    lat: r.lat,
    lng: r.lng,
    address: r.address ?? null,
    website: r.website ?? null,
    surface: r.surface ?? null,
    geohash: geohash.encode(r.lat, r.lng, 9),
    region: r.region,
    placeType: classifyPlaceType(r.rawOsmTags),
    rating: r.rating ?? null,
    reviewCount: r.reviewCount ?? null,
    phone: r.phone ?? null,
    yelpUrl: r.yelpUrl ?? null,
  }
}

// ---------------------------------------------------------------------------
// Scan existing rows once, build osmId → id map for O(1) upsert

console.log(`[seed] scanning existing rows for dedupe...`)
const existingMap = new Map()
let nextToken = undefined
let scanned = 0
do {
  const page = await client.models.Skatepark.list({ nextToken, limit: 1000 })
  if (page.errors?.length) {
    console.error(`[seed] scan errors:`, page.errors)
    process.exit(1)
  }
  for (const item of page.data || []) {
    existingMap.set(item.osmId, item.id)
    scanned++
  }
  nextToken = page.nextToken
} while (nextToken)
console.log(`[seed] scanned ${scanned} existing rows; ${existingMap.size} unique osmIds`)

// ---------------------------------------------------------------------------
// Run

const stats = { created: 0, updated: 0, 'would-create': 0, 'would-update': 0, error: 0 }
const errors = []

for (let i = 0; i < allRecords.length; i++) {
  const r = allRecords[i]
  const row = toSkatepark(r)
  const existingId = existingMap.get(row.osmId)
  process.stdout.write(`[${i + 1}/${allRecords.length}] ${row.osmId.padEnd(20)} ${row.name.slice(0, 40).padEnd(40)} `)
  try {
    let action, res
    if (existingId) {
      if (dryRun) {
        action = 'would-update'
      } else {
        res = await client.models.Skatepark.update({ id: existingId, ...row })
        action = 'updated'
      }
    } else {
      if (dryRun) {
        action = 'would-create'
      } else {
        res = await client.models.Skatepark.create(row)
        action = 'created'
        if (res.data?.id) existingMap.set(row.osmId, res.data.id)
      }
    }
    stats[action] = (stats[action] || 0) + 1
    process.stdout.write(`${action}\n`)
    if (res?.errors?.length) {
      errors.push({ osmId: row.osmId, errors: res.errors })
    }
  } catch (err) {
    stats.error++
    errors.push({ osmId: row.osmId, error: String(err) })
    process.stdout.write(`ERR: ${err.message}\n`)
  }
}

console.log(`\n[seed] done.`)
console.log(`  created:      ${stats.created}`)
console.log(`  updated:      ${stats.updated}`)
console.log(`  would-create: ${stats['would-create']}`)
console.log(`  would-update: ${stats['would-update']}`)
console.log(`  errors:       ${stats.error}`)

if (authMode === 'userPool') {
  try { await signOut() } catch {}
}

if (errors.length) {
  console.log(`\n[seed] first 5 errors:`)
  for (const e of errors.slice(0, 5)) {
    console.log(' ', JSON.stringify(e, null, 2))
  }
  process.exit(1)
}
