import React from 'react';
import {
  Grid,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { SkateparkCard } from './SkateparkCard';
import { SkateparkSkeleton } from './SkateparkSkeleton';
import { useSkateparks } from '../context/SkateparkContext';

export const SkateparkList: React.FC = () => {
  const { results, loading, error, location, placeTypeFilter } = useSkateparks();

  const visibleResults = results.filter((p) =>
    placeTypeFilter.includes((p.placeType ?? 'park'))
  );

  if (loading) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom sx={{ mb: 3, opacity: 0.5 }}>
          Searching for skateparks...
        </Typography>
        <Grid container spacing={3} alignItems="stretch">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i} sx={{ display: 'flex' }}>
              <SkateparkSkeleton />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>;
  }

  if (location && results.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', my: 8 }}>
        <Typography variant="h6" color="text.secondary">
          No skateparks found in this area. Try increasing the search radius.
        </Typography>
      </Box>
    );
  }

  if (!location) {
    return null;
  }

  if (visibleResults.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', my: 8 }}>
        <Typography variant="h6" color="text.secondary">
          No results match the selected filters. Try toggling more types on.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom sx={{ mb: 3 }}>
        Results near {location.displayName}
      </Typography>
      <Grid container spacing={3} alignItems="stretch">
        {visibleResults.map((park) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={park.id} sx={{ display: 'flex' }}>
            <SkateparkCard skatepark={park} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};
