#!/usr/bin/env node
// Skatepark ingest: pull from OSM Overpass, enrich via free APIs, write JSON.
// Usage: npm run ingest -- [--scope=nyc] [--bbox=south,west,north,east] [--out=path]

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const USER_AGENT = 'SkateparkFinder-Ingest/1.0 (https://sk8finder.cloud; contact via github.com/albertgcsula/skatepark-finder)'

const PRESETS = {
  nyc: { south: 40.4774, west: -74.2591, north: 40.9176, east: -73.7004, label: 'New York City' },
  la: { south: 33.6500, west: -118.9500, north: 34.3373, east: -117.6500, label: 'Los Angeles County' },
  portland: { south: 45.4327, west: -122.8367, north: 45.6529, east: -122.4717, label: 'Portland OR' },
  brooklyn: { south: 40.5707, west: -74.0419, north: 40.7395, east: -73.8334, label: 'Brooklyn NY' },
  sf: { south: 37.2000, west: -122.5500, north: 37.9500, east: -121.8500, label: 'SF Bay Area' },
  seattle: { south: 47.1800, west: -122.5500, north: 47.8500, east: -122.1000, label: 'Seattle metro' },
  austin: { south: 30.1300, west: -97.9300, north: 30.5500, east: -97.5000, label: 'Austin TX' },
  chicago: { south: 41.6200, west: -87.9500, north: 42.0500, east: -87.5000, label: 'Chicago' },
  denver: { south: 39.5500, west: -105.2000, north: 39.9500, east: -104.5500, label: 'Denver' },
  sandiego: { south: 32.5500, west: -117.3000, north: 33.1200, east: -116.8500, label: 'San Diego' },
  boston: { south: 42.2000, west: -71.3000, north: 42.4500, east: -70.8500, label: 'Boston metro' },
  philly: { south: 39.8700, west: -75.3000, north: 40.1500, east: -74.9500, label: 'Philadelphia' },
}

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

const scope = args.scope ?? 'nyc'
const bbox = args.bbox
  ? Object.fromEntries(['south', 'west', 'north', 'east'].map((k, i) => [k, parseFloat(args.bbox.split(',')[i])]))
  : PRESETS[scope]

if (!bbox) {
  console.error(`Unknown scope "${scope}". Valid: ${Object.keys(PRESETS).join(', ')}, or pass --bbox=south,west,north,east`)
  process.exit(1)
}

const outPath = args.out ?? join(__dirname, 'output', `${scope}.json`)

// ---------------------------------------------------------------------------
// helpers

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, { method = 'GET', body, headers = {}, timeoutMs = 30_000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method,
      body,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

// Nominatim allows 1 req/sec max — single shared rate-limited queue.
let nominatimChain = Promise.resolve()
function rateLimit(fn, minIntervalMs) {
  nominatimChain = nominatimChain.then(async () => {
    const start = Date.now()
    const result = await fn()
    const elapsed = Date.now() - start
    if (elapsed < minIntervalMs) await sleep(minIntervalMs - elapsed)
    return result
  })
  return nominatimChain
}

// ---------------------------------------------------------------------------
// 1. Overpass — fetch all skateparks in bbox with FULL tag set

async function fetchOverpass({ south, west, north, east }) {
  // bbox order in Overpass: south,west,north,east
  // We pull two sets in one query:
  // 1) Skateparks (target records)
  // 2) Named leisure features (park/playground/etc.) — used as name fallback
  //    for skateparks the mapper didn't tag but whose enclosing park is named.
  const query = `
    [out:json][timeout:60];
    (
      node["leisure"="skate_park"](${south},${west},${north},${east});
      way["leisure"="skate_park"](${south},${west},${north},${east});
      relation["leisure"="skate_park"](${south},${west},${north},${east});
      node["sport"="skateboard"](${south},${west},${north},${east});
      way["sport"="skateboard"](${south},${west},${north},${east});
      relation["sport"="skateboard"](${south},${west},${north},${east});
      way["leisure"~"^(park|playground|recreation_ground|garden|nature_reserve)$"]["name"](${south},${west},${north},${east});
      relation["leisure"~"^(park|playground|recreation_ground|garden|nature_reserve)$"]["name"](${south},${west},${north},${east});
    );
    out center tags;
  `
  const data = await fetchJson('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: query,
  })
  return data.elements || []
}

// Distance in meters between two lat/lng pairs (Haversine).
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Given an unnamed skatepark at (lat,lng), find the nearest named park-like
// feature within `maxMeters`. Returns the OSM tags object or null.
function findEnclosingParkName(lat, lng, namedFeatures, maxMeters = 200) {
  let best = null
  let bestDist = Infinity
  for (const f of namedFeatures) {
    const fLat = f.lat ?? f.center?.lat
    const fLng = f.lon ?? f.center?.lon
    if (fLat == null || fLng == null) continue
    const d = distanceMeters(lat, lng, fLat, fLng)
    if (d < bestDist && d <= maxMeters) {
      best = f
      bestDist = d
    }
  }
  return best ? { name: best.tags.name, distanceMeters: bestDist, parentTags: best.tags } : null
}

// Append "Skatepark" suffix if the source name doesn't already imply skating.
function nameFromEnclosingPark(parkName) {
  if (!parkName) return null
  if (SKATE_KEYWORDS.test(parkName)) return parkName
  return `${parkName} Skatepark`
}

// ---------------------------------------------------------------------------
// 2. Wikipedia REST — summary + lead image for `wikipedia` OSM tag
// Tag format: "en:Article Title" (lang prefix optional)

async function fetchWikipedia(tag) {
  if (!tag) return null
  const [lang, ...rest] = tag.split(':')
  const title = rest.length ? rest.join(':') : lang
  const wikiLang = rest.length ? lang : 'en'
  try {
    const data = await fetchJson(
      `https://${wikiLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    )
    return {
      title: data.title,
      extract: data.extract,
      thumbnail: data.thumbnail?.source ?? data.originalimage?.source ?? null,
      pageUrl: data.content_urls?.desktop?.page,
    }
  } catch (err) {
    return { error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// 3. Wikimedia Commons — file lookup (from OSM tag) + geosearch fallback

function cleanCommonsTag(tag) {
  // "File:Foo.jpg" / "Category:Skateparks in X" — pass through;
  // bare names get File: prefix
  if (!tag) return null
  if (tag.startsWith('File:') || tag.startsWith('Category:')) return tag
  return `File:${tag}`
}

async function fetchCommonsFile(tag) {
  const title = cleanCommonsTag(tag)
  if (!title) return null
  // Categories: pick the first image in the category
  if (title.startsWith('Category:')) {
    try {
      const data = await fetchJson(
        `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(title)}&cmtype=file&cmlimit=1&format=json&origin=*`,
      )
      const first = data.query?.categorymembers?.[0]?.title
      if (!first) return null
      return fetchCommonsFile(first)
    } catch (err) {
      return { error: String(err) }
    }
  }
  try {
    const data = await fetchJson(
      `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`,
    )
    const pages = data.query?.pages ?? {}
    const page = Object.values(pages)[0]
    const info = page?.imageinfo?.[0]
    if (!info) return null
    return {
      url: info.url,
      descriptionShortUrl: info.descriptionshorturl,
      license: info.extmetadata?.LicenseShortName?.value,
      artist: stripHtml(info.extmetadata?.Artist?.value),
      attribution: info.extmetadata?.Attribution?.value,
    }
  } catch (err) {
    return { error: String(err) }
  }
}

const SKATE_KEYWORDS = /(skate[\s-]?park|skatepark|skateboard|skate\s+plaza|pump[\s-]?track|skate\s+bowl)/i

async function fetchCommonsGeo(lat, lng, radiusMeters = 500) {
  try {
    // Look further afield to find skate-relevant photos
    const data = await fetchJson(
      `https://commons.wikimedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=${radiusMeters}&gsnamespace=6&gslimit=20&format=json&origin=*`,
    )
    const candidates = data.query?.geosearch ?? []
    // Strict filter: filename must reference skating
    const relevant = candidates.filter((c) => SKATE_KEYWORDS.test(c.title))
    for (const c of relevant) {
      const file = await fetchCommonsFile(c.title)
      if (file?.url) return { ...file, foundTitle: c.title }
    }
    return null
  } catch (err) {
    return { error: String(err) }
  }
}

// Mine a park name out of a Commons filename, e.g.
//   "Far Rockaway Skatepark - 2019.jpg" → "Far Rockaway Skatepark"
//   "Skate park Bushwick jeh.jpg"       → "Bushwick Skate Park"
function extractNameFromCommonsTitle(title) {
  if (!title) return null
  // Strip prefix and extension
  let s = title.replace(/^File:/, '').replace(/\.(jpe?g|png|gif|webp|webm|svg|tiff?)$/i, '')
  // Try: "<Anything> Skate Park <anything>" pattern
  const m1 = s.match(/([A-Z][\w' ]{2,30}?\s+Skate\s*(?:Park|Plaza))/i)
  if (m1) return m1[1].trim().replace(/\s+/g, ' ')
  // Try: "Skate Park <name>" (reverse order)
  const m2 = s.match(/Skate\s*(?:Park|Plaza)\s+([A-Z][\w' ]{2,30}?)(?:\s+\d|\s*$|\s+jeh|\s+td|\s+\()/i)
  if (m2) return `${m2[1].trim()} Skate Park`.replace(/\s+/g, ' ')
  return null
}

function stripHtml(s) {
  if (!s) return undefined
  return String(s).replace(/<[^>]+>/g, '').trim() || undefined
}

// ---------------------------------------------------------------------------
// 4. Wikidata — entity properties (P18 image, P31 instance of)

async function fetchWikidata(qid) {
  if (!qid || !/^Q\d+$/.test(qid)) return null
  try {
    const data = await fetchJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)
    const entity = data.entities?.[qid]
    const claims = entity?.claims ?? {}
    const imageFile = claims.P18?.[0]?.mainsnak?.datavalue?.value
    const enLabel = entity?.labels?.en?.value
    const enDesc = entity?.descriptions?.en?.value
    let image = null
    if (imageFile) {
      const file = await fetchCommonsFile(`File:${imageFile}`)
      if (file?.url) image = file
    }
    return { label: enLabel, description: enDesc, image }
  } catch (err) {
    return { error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// 5. Nominatim — reverse geocode for missing addresses (1 req/sec)

async function fetchNominatim(lat, lon) {
  return rateLimit(async () => {
    try {
      const data = await fetchJson(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      )
      const addr = data.address || {}
      const street = addr.road || addr.pedestrian || ''
      const city = addr.city || addr.town || addr.village || ''
      const housenumber = addr.house_number || ''
      const formatted = street
        ? `${housenumber ? housenumber + ' ' : ''}${street}${city ? ', ' + city : ''}`
        : data.display_name || ''
      const name = addr.leisure || addr.amenity || addr.park || ''
      return { name, address: formatted }
    } catch (err) {
      return { error: String(err) }
    }
  }, 1100)
}

// ---------------------------------------------------------------------------
// Enrichment orchestration — per-park

function deriveBaseName(tags) {
  if (tags.name) return { name: tags.name, source: 'osm-name' }
  if (tags.official_name) return { name: tags.official_name, source: 'osm-official_name' }
  if (tags.alt_name) return { name: tags.alt_name, source: 'osm-alt_name' }
  if (tags.operator) return { name: `${tags.operator} Skatepark`, source: 'osm-operator' }
  if (tags['addr:street']) return { name: `${tags['addr:street']} Skatepark`, source: 'osm-addr-street' }
  if (tags['addr:city']) return { name: `${tags['addr:city']} Skatepark`, source: 'osm-addr-city' }
  return { name: null, source: null }
}

function deriveAddress(tags) {
  const street = tags['addr:street'] || ''
  const city = tags['addr:city'] || ''
  const housenumber = tags['addr:housenumber'] || ''
  if (street) return { address: `${housenumber ? housenumber + ' ' : ''}${street}${city ? ', ' + city : ''}`, source: 'osm-tags' }
  if (tags['addr:full']) return { address: tags['addr:full'], source: 'osm-tags' }
  return { address: null, source: null }
}

async function enrichOne(el, namedFeatures = []) {
  const tags = el.tags || {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (lat == null || lng == null) return null

  const out = {
    osmId: el.id,
    osmType: el.type,
    lat,
    lng,
    name: null,
    description: null,
    imageUrl: null,
    imageLicense: null,
    imageAttribution: null,
    imageSource: null,
    address: null,
    website: tags.website ?? null,
    surface: tags.surface ?? null,
    rawOsmTags: tags,
    sources: { name: null, description: null, address: null },
    enrichedAt: new Date().toISOString(),
  }

  // Base from OSM tags
  const baseName = deriveBaseName(tags)
  if (baseName.name) {
    out.name = baseName.name
    out.sources.name = baseName.source
  }
  const baseAddr = deriveAddress(tags)
  if (baseAddr.address) {
    out.address = baseAddr.address
    out.sources.address = baseAddr.source
  }
  if (tags.description) {
    out.description = tags.description
    out.sources.description = 'osm-tags'
  }
  if (tags.image) {
    out.imageUrl = tags.image
    out.imageSource = 'osm-tag-image'
  }

  // Wikipedia enrichment (description + thumbnail fallback)
  if (tags.wikipedia) {
    const wiki = await fetchWikipedia(tags.wikipedia)
    if (wiki && !wiki.error) {
      if (!out.description && wiki.extract) {
        out.description = wiki.extract
        out.sources.description = 'wikipedia'
      }
      if (!out.imageUrl && wiki.thumbnail) {
        out.imageUrl = wiki.thumbnail
        out.imageSource = 'wikipedia'
      }
      if (!out.name && wiki.title) {
        out.name = wiki.title
        out.sources.name = 'wikipedia'
      }
    }
  }

  // Wikimedia Commons (direct tag)
  if (!out.imageUrl && tags.wikimedia_commons) {
    const file = await fetchCommonsFile(tags.wikimedia_commons)
    if (file?.url) {
      out.imageUrl = file.url
      out.imageLicense = file.license
      out.imageAttribution = file.artist || file.attribution
      out.imageSource = 'wikimedia-tag'
    }
  }

  // Wikidata (image + name/description fallback)
  if (tags.wikidata) {
    const wd = await fetchWikidata(tags.wikidata)
    if (wd && !wd.error) {
      if (!out.imageUrl && wd.image?.url) {
        out.imageUrl = wd.image.url
        out.imageLicense = wd.image.license
        out.imageAttribution = wd.image.artist || wd.image.attribution
        out.imageSource = 'wikidata'
      }
      if (!out.name && wd.label) {
        out.name = wd.label
        out.sources.name = 'wikidata'
      }
      if (!out.description && wd.description) {
        out.description = wd.description
        out.sources.description = 'wikidata'
      }
    }
  }

  // Wikimedia Commons geosearch — last-resort image (skate-keyword filtered)
  if (!out.imageUrl) {
    const geo = await fetchCommonsGeo(lat, lng)
    if (geo?.url) {
      out.imageUrl = geo.url
      out.imageLicense = geo.license
      out.imageAttribution = geo.artist || geo.attribution
      out.imageSource = `wikimedia-geosearch:${geo.foundTitle}`
      // If we still don't have a name, try to mine one from the matched filename
      if (!out.name) {
        const mined = extractNameFromCommonsTitle(geo.foundTitle)
        if (mined) {
          out.name = mined
          out.sources.name = 'commons-filename'
        }
      }
    }
  }

  // Enclosing-park name fallback: the skatepark element itself has no name,
  // but the OSM mapper named the enclosing leisure=park / playground feature.
  if (!out.name) {
    const enclosing = findEnclosingParkName(lat, lng, namedFeatures, 100)
    if (enclosing) {
      const derived = nameFromEnclosingPark(enclosing.name)
      if (derived) {
        out.name = derived
        out.sources.name = 'enclosing-park'
        // Carry parent park description through if we still don't have one.
        if (!out.description && enclosing.parentTags.description) {
          out.description = enclosing.parentTags.description
          out.sources.description = 'enclosing-park'
        }
      }
    }
  }

  // Nominatim reverse geocode — only if both name AND address are missing
  if (!out.name || !out.address) {
    const nom = await fetchNominatim(lat, lng)
    if (nom && !nom.error) {
      if (!out.name && nom.name) {
        out.name = `${nom.name.charAt(0).toUpperCase()}${nom.name.slice(1)} Skatepark`
        out.sources.name = 'nominatim'
      }
      if (!out.address && nom.address) {
        out.address = nom.address
        out.sources.address = 'nominatim'
      }
    }
  }

  // Final fallback
  if (!out.name) out.name = 'Unnamed Skatepark'

  return out
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  console.log(`[ingest] scope=${scope} bbox=${[bbox.south, bbox.west, bbox.north, bbox.east].join(',')} (${bbox.label || 'custom'})`)
  console.log(`[ingest] fetching from Overpass...`)
  const elements = await fetchOverpass(bbox)
  console.log(`[ingest] fetched ${elements.length} OSM records (skateparks + named parks for enclosing-name lookup)`)

  // Skateparks: leisure=skate_park, sport=skateboard, or a name containing "skate".
  // Named features (parks/playgrounds): everything else returned by the query — pre-filtered to have a name.
  const candidates = []
  const namedFeatures = []
  for (const el of elements) {
    const tags = el.tags || {}
    const rawName = (tags.name || tags.official_name || '').toLowerCase()
    const isSkate = tags.leisure === 'skate_park' || tags.sport === 'skateboard' || rawName.includes('skate')
    if (isSkate) {
      candidates.push(el)
    } else if (tags.name) {
      namedFeatures.push(el)
    }
  }
  console.log(`[ingest] ${candidates.length} skateparks, ${namedFeatures.length} named leisure features for enclosing-name lookup`)

  const enriched = []
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i]
    process.stdout.write(`  [${i + 1}/${candidates.length}] osm:${el.type}/${el.id}... `)
    try {
      const rec = await enrichOne(el, namedFeatures)
      if (rec) {
        enriched.push(rec)
        process.stdout.write(
          `${rec.name?.slice(0, 40) ?? '(no name)'} ${rec.imageUrl ? '🖼' : '  '}\n`,
        )
      } else {
        process.stdout.write('(skipped: no coords)\n')
      }
    } catch (err) {
      process.stdout.write(`ERR: ${err.message}\n`)
    }
  }

  // Stats
  const stats = {
    total: enriched.length,
    withImage: enriched.filter((r) => r.imageUrl).length,
    withDescription: enriched.filter((r) => r.description).length,
    withAddress: enriched.filter((r) => r.address).length,
    nameSources: tally(enriched.map((r) => r.sources.name)),
    imageSources: tally(enriched.map((r) => r.imageSource)),
  }

  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify({ scope, bbox, stats, records: enriched }, null, 2))

  console.log(`\n[ingest] wrote ${enriched.length} records to ${outPath}`)
  console.log(`[ingest] stats:`)
  console.log(`  with image:       ${stats.withImage}/${stats.total} (${pct(stats.withImage, stats.total)}%)`)
  console.log(`  with description: ${stats.withDescription}/${stats.total} (${pct(stats.withDescription, stats.total)}%)`)
  console.log(`  with address:     ${stats.withAddress}/${stats.total} (${pct(stats.withAddress, stats.total)}%)`)
  console.log(`  name sources:     ${JSON.stringify(stats.nameSources)}`)
  console.log(`  image sources:    ${JSON.stringify(stats.imageSources)}`)
}

function tally(arr) {
  return arr.reduce((acc, v) => {
    const k = v ?? '(none)'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
}
function pct(a, b) {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
