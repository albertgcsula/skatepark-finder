export type Skatepark = {
  id: number;
  lat: number;
  lon: number;
  name: string;
  address?: string;
  distance?: number;
}

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

    const skateparks: Skatepark[] = data.elements
      .map((el: any) => {
        const tags = el.tags || {};
        
        // 1. Core Filtering Logic
        const rawName = tags.name || tags.official_name || '';
        const isSkatePark = 
          tags.leisure === 'skate_park' || 
          tags.sport === 'skateboard' ||
          rawName.toLowerCase().includes('skate');

        if (!isSkatePark) return null;

        // 2. Intelligent Naming Fallback
        let name = rawName;
        if (!name) {
          if (tags.operator) {
            name = `${tags.operator} Skatepark`;
          } else if (tags['addr:street']) {
            name = `${tags['addr:street']} Skatepark`;
          } else if (tags['addr:city']) {
            name = `${tags['addr:city']} Skatepark`;
          } else if (tags.brand) {
            name = `${tags.brand} Skatepark`;
          } else {
            name = 'Unnamed Skatepark';
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
          id: el.id,
          lat: pLat,
          lon: pLon,
          name,
          address,
          distance,
        };
      })
      .filter((p: any): p is Skatepark => p !== null && p.distance <= radiusMiles);

    // Sort by distance, closest first
    return skateparks.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (err) {
    console.error('Fetch skateparks error:', err);
    throw err;
  }
}
