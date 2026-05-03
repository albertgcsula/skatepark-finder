import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  CardActions, 
  Button, 
  Box
} from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import MapIcon from '@mui/icons-material/Map';
import type { Skatepark } from '../services/osmService';

interface SkateparkCardProps {
  skatepark: Skatepark;
}

export const SkateparkCard: React.FC<SkateparkCardProps> = ({ skatepark }) => {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${skatepark.lat},${skatepark.lon}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${skatepark.lat}&mlon=${skatepark.lon}#map=17/${skatepark.lat}/${skatepark.lon}`;

  return (
    <Card sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <CardContent sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <Typography 
          variant="h6" 
          component="div" 
          gutterBottom
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: '3.2em', // Fixed height for exactly 2 lines
            lineHeight: '1.6em',
            textWrap: 'balance', // Modern text wrapping for titles
          }}
          title={skatepark.name}
        >
          {skatepark.name}
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary"
          sx={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            minHeight: '3em',
            textWrap: 'pretty', // Modern text wrapping to avoid orphans
          }}
        >
          {skatepark.address}
        </Typography>
        {skatepark.distance !== undefined && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              {skatepark.distance.toFixed(1)} miles away
            </Typography>
          </Box>
        )}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.disabled">
            Lat: {skatepark.lat.toFixed(4)}, Lon: {skatepark.lon.toFixed(4)}
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
        <Button 
          size="small" 
          startIcon={<DirectionsIcon />} 
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Directions
        </Button>
        <Button 
          size="small" 
          color="secondary"
          startIcon={<MapIcon />}
          href={osmUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          View Map
        </Button>
      </CardActions>
    </Card>
  );
};
