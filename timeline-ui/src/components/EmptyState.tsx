import React from 'react';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { Timeline as TimelineIcon } from '@mui/icons-material';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Data Found',
  message = 'Start by adding some data to your timeline',
  actionLabel,
  onAction
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px',
        gap: 2,
        p: 4,
        textAlign: 'center',
        bgcolor: theme.palette.background.paper,
        borderRadius: 2,
        border: `1px dashed ${theme.palette.divider}`
      }}
    >
      <TimelineIcon
        sx={{
          fontSize: 72,
          color: theme.palette.action.disabled,
          mb: 2
        }}
      />
      <Typography
        variant="h5"
        sx={{
          color: theme.palette.text.primary,
          fontWeight: 600
        }}
      >
        {title}
      </Typography>
      <Typography
        variant="body1"
        sx={{
          color: theme.palette.text.secondary,
          maxWidth: '400px',
          mb: 2
        }}
      >
        {message}
      </Typography>
      {actionLabel && onAction && (
        <Button
          variant="contained"
          color="primary"
          onClick={onAction}
          sx={{
            mt: 2,
            px: 4,
            py: 1,
            borderRadius: 2
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
};

export default EmptyState; 