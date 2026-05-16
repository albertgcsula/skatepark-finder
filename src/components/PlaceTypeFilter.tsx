import React from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import ParkIcon from '@mui/icons-material/Park'
import PlaceIcon from '@mui/icons-material/Place'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useSkateparks } from '../context/SkateparkContext'
import type { PlaceType } from '../services/osmService'

const OPTIONS: { value: PlaceType; label: string; icon: React.ReactNode }[] = [
  { value: 'park', label: 'Parks', icon: <ParkIcon fontSize="small" /> },
  { value: 'spot', label: 'Spots', icon: <PlaceIcon fontSize="small" /> },
  { value: 'shop', label: 'Shops', icon: <StorefrontIcon fontSize="small" /> },
]

export const PlaceTypeFilter: React.FC = () => {
  const { placeTypeFilter, togglePlaceType, location } = useSkateparks()

  // Don't render until the user has searched — nothing to filter yet.
  if (!location) return null

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
      <Typography variant="body2" color="text.secondary">
        Show:
      </Typography>
      <ToggleButtonGroup
        value={[...placeTypeFilter]}
        aria-label="Filter by place type"
        size="small"
      >
        {OPTIONS.map((opt) => (
          <ToggleButton
            key={opt.value}
            value={opt.value}
            onClick={() => togglePlaceType(opt.value)}
            aria-label={opt.label}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {opt.icon}
              {opt.label}
            </Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  )
}
