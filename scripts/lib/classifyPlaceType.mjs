// Classify an OSM feature into one of: 'park' | 'spot' | 'shop'.
//
//   - shop=*                    → 'shop'
//   - leisure=skate_park        → 'park'
//   - sport=skateboard (only)   → 'spot' (DIY spots, plazas, unnamed features)
//   - everything else           → 'park' (name-only matches, ambiguous cases)
//
// Mirror this logic in src/services/osmService.ts when changing it.
export function classifyPlaceType(tags) {
  if (!tags) return 'park'
  if (tags.shop) return 'shop'
  if (tags.leisure === 'skate_park') return 'park'
  if (tags.sport === 'skateboard') return 'spot'
  return 'park'
}
