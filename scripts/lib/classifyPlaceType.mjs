// Classify an OSM feature into one of: 'park' | 'spot' | 'shop'.
//
//   - shop=*                              → 'shop'
//   - leisure=skate_park                  → 'park' (modern OSM convention)
//   - sport=skateboard + any leisure tag  → 'park' (the dominant real-world
//       pattern: leisure=pitch/park/sports_centre + sport=skateboard marks
//       a formal facility inside a parent feature)
//   - sport=skateboard with no leisure    → 'spot' (DIY spots, plazas, point
//       features with no parent recreation area)
//   - everything else                     → 'park' (name-only matches default
//       to park since OSM doesn't have a clean spot tag)
//
// Mirror this logic in src/services/osmService.ts when changing it.
export function classifyPlaceType(tags) {
  if (!tags) return 'park'
  if (tags.shop) return 'shop'
  if (tags.leisure === 'skate_park') return 'park'
  if (tags.sport === 'skateboard' && tags.leisure) return 'park'
  if (tags.sport === 'skateboard') return 'spot'
  return 'park'
}
