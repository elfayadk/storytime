import React from 'react';
import { Box, Button, Typography, useTheme } from '@mui/material';
import { Error as ErrorIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong',
  onRetry
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        gap: 2,
        p: 3,
        textAlign: 'center'
      }}
    >
      <ErrorIcon
        sx={{
          fontSize: 64,
          color: theme.palette.error.main,
          mb: 2
        }}
      />
      <Typography
        variant="h6"
        sx={{
          color: theme.palette.error.main,
          fontWeight: 500,
          maxWidth: '400px'
        }}
      >
        {message}
      </Typography>
      {onRetry && (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          sx={{ mt: 2 }}
        >
          Try Again
        </Button>
      )}
    </Box>
  );
};

export default ErrorState; 