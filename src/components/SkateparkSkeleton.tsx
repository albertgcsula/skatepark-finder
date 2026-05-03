import React from 'react';
import { 
  Card, 
  CardContent, 
  CardActions, 
  Skeleton, 
  Box
} from '@mui/material';

export const SkateparkSkeleton: React.FC = () => {
  return (
    <Card sx={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Skeleton variant="text" sx={{ fontSize: '1.5rem', mb: 1 }} width="80%" />
        <Skeleton variant="text" sx={{ fontSize: '1rem' }} width="60%" />
        <Skeleton variant="text" sx={{ fontSize: '1rem', mt: 1 }} width="40%" />
        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" sx={{ fontSize: '0.75rem' }} width="30%" />
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
        <Skeleton variant="rectangular" width={80} height={30} />
        <Skeleton variant="rectangular" width={80} height={30} />
      </CardActions>
    </Card>
  );
};
