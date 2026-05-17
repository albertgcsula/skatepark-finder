export type PlaceType = 'park' | 'spot' | 'shop';

export type Skatepark = {
  id: string;
  // Amplify/DynamoDB-generated UUID. Only present for DDB-sourced records.
  ddbId?: string;
  lat: number;
  lon: number;
  name: string;
  address?: string;
  distance?: number;
  placeType?: PlaceType;
  geohash?: string;
  // Optional enriched fields (populated from DynamoDB; absent from OSM-only results)
  description?: string;
  imageUrl?: string;
  imageAttribution?: string;
  imageLicense?: string;
  website?: string;
  // Yelp enrichment fields (populated by scripts/ingest.mjs when a Yelp
  // business matches; absent for parks without a Yelp listing).
  rating?: number;
  reviewCount?: number;
  phone?: string;
  yelpUrl?: string;
  source?: 'ddb' | 'osm';
}

// Keep in sync with scripts/lib/classifyPlaceType.mjs.
function classifyPlaceType(tags: Record<string, string> | undefined): PlaceType {
  if (!tags) return 'park';
  if (tags.shop) return 'shop';
  if (tags.leisure === 'skate_park') return 'park';
  if (tags.sport === 'skateboard' && tags.leisure) return 'park';
  if (tags.sport === 'skateboard') return 'spot';
  return 'park';
}

// Minimal ngeohash typing — package ships JS only.
import ngeohash from 'ngeohash';

export type GeocodeResult = {
  lat: number;
  lon: number;
  displayName: string;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: {
          'User-Agent': 'SkateparkFinderApp/1.0',
        },
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
  } catch (err) {
    console.error('Geocoding error:', err);
  }
  return null;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ name?: string; address?: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SkateparkFinderApp/1.0',
        },
      }
    );
    const data = await response.json();
    if (data) {
      const addr = data.address || {};
      const street = addr.road || addr.pedestrian || '';
      const city = addr.city || addr.town || addr.village || '';
      const housenumber = addr.house_number || '';
      
      let formattedAddress = '';
      if (street) {
        formattedAddress = `${housenumber ? housenumber + ' ' : ''}${street}${city ? ', ' + city : ''}`;
      } else {
        formattedAddress = data.display_name || '';
      }

      // Nominatim might give us a specific name for the object at these coordinates
      const name = addr.leisure || addr.amenity || addr.park || '';

      return {
        name: name,
        address: formattedAddress,
      };
    }
  } catch (err) {
    console.error('Reverse geocoding error:', err);
  }
  return null;
}

export async function fetchSkateparks(
  lat: number,
  lon: number,
  radiusMiles: number
): Promise<Skatepark[]> {
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  // Refined query: we still query broadly but will filter in JS to ensure quality
  const query = `
    [out:json][timeout:25];
    (
      node["leisure"="skate_park"](around:${radiusMeters}, ${lat}, ${lon});
      way["leisure"="skate_park"](around:${radiusMeters}, ${lat}, ${lon});
      relation["leisure"="skate_park"](around:${radiusMeters}, ${lat}, ${lon});
      node["sport"="skateboard"](around:${radiusMeters}, ${lat}, ${lon});
      way["sport"="skateboard"](around:${radiusMeters}, ${lat}, ${lon});
      relation["sport"="skateboard"](around:${radiusMeters}, ${lat}, ${lon});
    );
    out center;
  `;

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: query,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.elements) return [];

    const rawSkateparks: Skatepark[] = data.elements
      .map((el: any) => {
        const tags = el.tags || {};
        
        // 1. Core Filtering Logic
        const rawName = tags.name || tags.official_name || '';
        const isSkatePark = 
          tags.leisure === 'skate_park' || 
          tags.sport === 'skateboard' ||
          rawName.toLowerCase().includes('skate');

        if (!isSkatePark) return null;

        const placeType = classifyPlaceType(tags);
        const typeLabel = placeType === 'shop' ? 'Skate Shop' : placeType === 'spot' ? 'Skate Spot' : 'Skatepark';

        // 2. Intelligent Naming Fallback
        let name = rawName;
        if (!name) {
          if (tags.operator) {
            name = `${tags.operator} ${typeLabel}`;
          } else if (tags['addr:street']) {
            name = `${tags['addr:street']} ${typeLabel}`;
          } else if (tags['addr:city']) {
            name = `${tags['addr:city']} ${typeLabel}`;
          } else if (tags.brand) {
            name = `${tags.brand} ${typeLabel}`;
          } else {
            name = `Unnamed ${typeLabel}`;
          }
        }

        // 3. Address Construction
        const street = tags['addr:street'] || '';
        const city = tags['addr:city'] || '';
        const housenumber = tags['addr:housenumber'] || '';
        
        let address = 'Address not available';
        if (street) {
          address = `${housenumber ? housenumber + ' ' : ''}${street}${city ? ', ' + city : ''}`;
        } else if (tags['addr:full']) {
          address = tags['addr:full'];
        }

        const pLat = el.lat || el.center?.lat;
        const pLon = el.lon || el.center?.lon;
        const distance = calculateDistance(lat, lon, pLat, pLon);

        return {
          id: `${el.type ?? 'osm'}/${el.id}`,
          lat: pLat,
          lon: pLon,
          name,
          address,
          distance,
          placeType,
          geohash: ngeohash.encode(pLat, pLon, 9),
          source: 'osm' as const,
        };
      })
      .filter((p: any): p is Skatepark => p !== null && p.distance <= radiusMiles);

    // Enrich results that are missing name or address (max 5 to avoid heavy API usage/rate limits)
    const enrichedSkateparks = await Promise.all(
      rawSkateparks.map(async (p, index) => {
        if (index < 5 && (p.name === 'Unnamed Skatepark' || p.address === 'Address not available')) {
          // Small delay between requests to be respectful to Nominatim
          await new Promise(resolve => setTimeout(resolve, index * 200));
          const extraData = await reverseGeocode(p.lat, p.lon);
          if (extraData) {
            return {
              ...p,
              name: p.name === 'Unnamed Skatepark' && extraData.name ? `${extraData.name.charAt(0).toUpperCase() + extraData.name.slice(1)} Skatepark` : p.name,
              address: p.address === 'Address not available' ? extraData.address || p.address : p.address,
            };
          }
        }
        return p;
      })
    );

    // Sort by distance, closest first
    return enrichedSkateparks.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (err) {
    console.error('Fetch skateparks error:', err);
    throw err;
  }
}
