import React, { useState, useEffect } from 'react';
import { 
  Paper, 
  TextField, 
  Button, 
  Box, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  IconButton, 
  Tooltip,
  Typography
} from '@mui/material';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import SearchIcon from '@mui/icons-material/Search';
import { useSkateparks } from '../context/SkateparkContext';
import { useSearch } from '@tanstack/react-router';

export const SearchForm: React.FC = () => {
  const { search, locateMe, radius, setRadius, loading } = useSkateparks();
  const searchParams = useSearch({ from: '/' });
  const [query, setQuery] = useState(searchParams.q || '');

  // Update local query state if URL param changes (e.g. browser back/forward)
  useEffect(() => {
    setQuery(searchParams.q || '');
  }, [searchParams.q]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h5" gutterBottom>
        Find Skateparks
      </Typography>
      <Box 
        component="form" 
        onSubmit={handleSubmit}
        sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          gap: 2,
          alignItems: 'center'
        }}
      >
        <TextField
          fullWidth
          label="Zipcode or Address"
          variant="outlined"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. 90001 or Los Angeles, CA"
          disabled={loading}
        />
        
        <FormControl sx={{ minWidth: 120 }}>
          <InputLabel id="radius-label">Radius</InputLabel>
          <Select
            labelId="radius-label"
            value={radius}
            label="Radius"
            onChange={(e) => setRadius(Number(e.target.value))}
            disabled={loading}
          >
            <MenuItem value={5}>5 Miles</MenuItem>
            <MenuItem value={10}>10 Miles</MenuItem>
            <MenuItem value={15}>15 Miles</MenuItem>
            <MenuItem value={25}>25 Miles</MenuItem>
            <MenuItem value={50}>50 Miles</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button 
            type="submit" 
            variant="contained" 
            size="large"
            startIcon={<SearchIcon />}
            disabled={loading || !query}
            sx={{ height: 56, px: 4 }}
          >
            Search
          </Button>
          
          <Tooltip title="Use my current location">
            <IconButton 
              color="primary" 
              onClick={locateMe}
              disabled={loading}
              sx={{ 
                width: 56, 
                height: 56, 
                border: '1px solid',
                borderColor: 'primary.main'
              }}
            >
              <MyLocationIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
};
