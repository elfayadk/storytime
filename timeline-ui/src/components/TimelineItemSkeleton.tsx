import React from 'react';
import {
  Box,
  Skeleton,
  useTheme,
  Card,
  CardContent
} from '@mui/material';

interface TimelineItemSkeletonProps {
  count?: number;
}

const TimelineItemSkeleton: React.FC<TimelineItemSkeletonProps> = ({ count = 3 }) => {
  const theme = useTheme();

  const SingleSkeleton = () => (
    <Card
      sx={{
        mb: 2,
        borderRadius: 2,
        boxShadow: theme.shadows[1]
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={20} />
          </Box>
          <Skeleton variant="circular" width={24} height={24} />
        </Box>
        <Skeleton variant="text" width="90%" height={20} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="80%" height={20} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton variant="rounded" width={60} height={24} />
          <Skeleton variant="rounded" width={80} height={24} />
          <Skeleton variant="rounded" width={70} height={24} />
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box
      sx={{
        animation: 'pulse 1.5s ease-in-out infinite',
        '@keyframes pulse': {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.5 },
          '100%': { opacity: 1 },
        },
      }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <SingleSkeleton key={index} />
      ))}
    </Box>
  );
};

export default TimelineItemSkeleton; 