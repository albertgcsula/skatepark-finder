import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Chip,
  Typography,
  CardActions,
  Button,
  Box,
  Link,
} from '@mui/material';
import DirectionsIcon from '@mui/icons-material/Directions';
import MapIcon from '@mui/icons-material/Map';
import LanguageIcon from '@mui/icons-material/Language';
import ParkIcon from '@mui/icons-material/Park';
import PlaceIcon from '@mui/icons-material/Place';
import StorefrontIcon from '@mui/icons-material/Storefront';
import type { PlaceType, Skatepark } from '../services/osmService';

const PLACE_TYPE_META: Record<PlaceType, { label: string; icon: React.ReactElement; color: 'success' | 'info' | 'warning' }> = {
  park: { label: 'Park', icon: <ParkIcon />, color: 'success' },
  spot: { label: 'Spot', icon: <PlaceIcon />, color: 'info' },
  shop: { label: 'Shop', icon: <StorefrontIcon />, color: 'warning' },
};

interface SkateparkCardProps {
  skatepark: Skatepark;
}

export const SkateparkCard: React.FC<SkateparkCardProps> = ({ skatepark }) => {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${skatepark.lat},${skatepark.lon}`;
  const osmUrl = `https://www.openstreetmap.org/?mlat=${skatepark.lat}&mlon=${skatepark.lon}#map=17/${skatepark.lat}/${skatepark.lon}`;
  const typeMeta = PLACE_TYPE_META[skatepark.placeType ?? 'park'];

  return (
    <Card data-id={skatepark.ddbId} data-geohash={skatepark.geohash} sx={{ height: '100%', width: '100%', maxWidth: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {skatepark.imageUrl && (
        <CardMedia
          component="img"
          image={skatepark.imageUrl}
          alt={skatepark.name}
          sx={{
            width: '100%',
            height: 160,
            objectFit: 'cover',
            display: 'block',
            backgroundColor: '#f0f0f0',
          }}
          loading="lazy"
          onError={(e) => {
            // Hide broken images rather than showing a broken icon
            (e.currentTarget as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, overflow: 'hidden', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        <Chip
          icon={typeMeta.icon}
          label={typeMeta.label}
          size="small"
          color={typeMeta.color}
          variant="outlined"
          sx={{ mb: 1 }}
        />
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
            minHeight: '3.2em',
            lineHeight: '1.6em',
            textWrap: 'balance',
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
            textWrap: 'pretty',
          }}
        >
          {skatepark.address}
        </Typography>
        {skatepark.description && (
          <Typography
            variant="body2"
            sx={{
              mt: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {skatepark.description}
          </Typography>
        )}
        {skatepark.distance !== undefined && (
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
              {skatepark.distance.toFixed(1)} miles away
            </Typography>
          </Box>
        )}
        {skatepark.imageAttribution && (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1 }}>
            Photo: {skatepark.imageAttribution}
            {skatepark.imageLicense ? ` (${skatepark.imageLicense})` : ''}
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.disabled">
            Lat: {skatepark.lat.toFixed(4)}, Lon: {skatepark.lon.toFixed(4)}
          </Typography>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', p: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button
          size="small"
          startIcon={<DirectionsIcon />}
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Directions
        </Button>
        {skatepark.website && (
          <Button
            size="small"
            startIcon={<LanguageIcon />}
            component={Link}
            href={skatepark.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            Website
          </Button>
        )}
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
