// Region centers, derived from the bbox of each scripts/output/*.json file.
// Used to tag auto-cached OSM records with the nearest seeded region so the
// region GSI stays useful.
export const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  austin: { lat: 30.34, lng: -97.715 },
  boston: { lat: 42.325, lng: -71.075 },
  chicago: { lat: 41.835, lng: -87.725 },
  denver: { lat: 39.75, lng: -104.875 },
  la: { lat: 33.99365, lng: -118.3 },
  nyc: { lat: 40.6975, lng: -73.97975 },
  philly: { lat: 40.01, lng: -75.125 },
  portland: { lat: 45.5428, lng: -122.6542 },
  sandiego: { lat: 32.835, lng: -117.075 },
  seattle: { lat: 47.515, lng: -122.325 },
  sf: { lat: 37.575, lng: -122.2 },
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function closestRegion(lat: number, lng: number): string {
  let bestName = 'auto'
  let bestDist = Infinity
  for (const [name, center] of Object.entries(REGION_CENTERS)) {
    const d = haversine(lat, lng, center.lat, center.lng)
    if (d < bestDist) {
      bestDist = d
      bestName = name
    }
  }
  return bestName
}
