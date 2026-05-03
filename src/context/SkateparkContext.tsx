import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { Skatepark, GeocodeResult } from '../services/osmService';
import { geocodeAddress, fetchSkateparks } from '../services/osmService';

interface SkateparkContextType {
  location: GeocodeResult | null;
  radius: number;
  results: Skatepark[];
  loading: boolean;
  error: string | null;
  setRadius: (radius: number) => void;
  search: (query: string) => void;
  locateMe: () => Promise<void>;
}

const SkateparkContext = createContext<SkateparkContextType | undefined>(undefined);

export const SkateparkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate({ from: '/' });
  const searchParams = useSearch({ from: '/' });
  
  const [location, setLocation] = useState<GeocodeResult | null>(null);
  const [results, setResults] = useState<Skatepark[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track last searched params to avoid redundant fetches
  const lastSearchRef = useRef<string>('');

  const performSearch = useCallback(async (lat: number, lon: number, rad: number) => {
    setLoading(true);
    setError(null);
    try {
      const parks = await fetchSkateparks(lat, lon, rad);
      setResults(parks);
    } catch (err) {
      setError('Failed to fetch skateparks. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Effect to handle searches from URL parameters
  useEffect(() => {
    const { q, radius = 10 } = searchParams;
    const searchKey = `${q}-${radius}`;
    
    if (q && searchKey !== lastSearchRef.current) {
      lastSearchRef.current = searchKey;
      
      const doSearch = async () => {
        setLoading(true);
        setError(null);
        try {
          const formattedQuery = /^\d{5}(-\d{4})?$/.test(q) ? `${q}, USA` : q;
          const geo = await geocodeAddress(formattedQuery);
          if (geo) {
            setLocation(geo);
            await performSearch(geo.lat, geo.lon, radius);
          } else {
            setError('Location not found. Please try a different address or zipcode.');
            setResults([]);
          }
        } catch (err) {
          setError('An error occurred during search.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      
      doSearch();
    }
  }, [searchParams, performSearch]);

  const search = useCallback((query: string) => {
    navigate({
      search: (prev) => ({ ...prev, q: query }),
    });
  }, [navigate]);

  const setRadius = useCallback((newRadius: number) => {
    navigate({
      search: (prev) => ({ ...prev, radius: newRadius }),
    });
  }, [navigate]);

  const locateMe = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({
          lat: latitude,
          lon: longitude,
          displayName: 'Your Current Location',
        });
        // For "Locate Me", we might not have a q, so we search directly
        // and update the URL to clear q if it exists
        navigate({
          search: (prev) => ({ ...prev, q: undefined }),
        });
        await performSearch(latitude, longitude, searchParams.radius || 10);
      },
      (err) => {
        setError('Unable to retrieve your location.');
        setLoading(false);
        console.error(err);
      }
    );
  }, [navigate, performSearch, searchParams.radius]);

  return (
    <SkateparkContext.Provider
      value={{
        location,
        radius: searchParams.radius || 10,
        results,
        loading,
        error,
        setRadius,
        search,
        locateMe,
      }}
    >
      {children}
    </SkateparkContext.Provider>
  );
};

export const useSkateparks = () => {
  const context = useContext(SkateparkContext);
  if (context === undefined) {
    throw new Error('useSkateparks must be used within a SkateparkProvider');
  }
  return context;
};
