import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Link,
  Divider,
  useTheme
} from '@mui/material';
import {
  Close as CloseIcon,
  GitHub as GitHubIcon,
  Twitter as TwitterIcon,
  Reddit as RedditIcon,
  Link as LinkIcon,
  Schedule as ScheduleIcon,
  Label as LabelIcon
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { TimelineEvent } from '../types';

interface EventDetailsProps {
  event: TimelineEvent;
  open: boolean;
  onClose: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ event, open, onClose }) => {
  const theme = useTheme();

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'github':
        return <GitHubIcon />;
      case 'twitter':
        return <TwitterIcon sx={{ color: '#1DA1F2' }} />;
      case 'reddit':
        return <RedditIcon sx={{ color: '#FF4500' }} />;
      default:
        return <LinkIcon />;
    }
  };

  const getSentimentColor = (sentiment?: { score: number; label: string }) => {
    if (!sentiment) return theme.palette.grey[500];
    if (sentiment.label === 'positive') return theme.palette.success.main;
    if (sentiment.label === 'negative') return theme.palette.error.main;
    return theme.palette.warning.main;
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          overflow: 'hidden'
        }
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: theme.palette.background.default,
          borderBottom: `1px solid ${theme.palette.divider}`
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getPlatformIcon(event.platform)}
          <Typography variant="h6">{event.title}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" gutterBottom>
            {event.description}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {event.content}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Avatar src={event.user.avatarUrl} alt={event.user.name}>
            {event.user.name.charAt(0)}
          </Avatar>
          <Box>
            <Typography variant="subtitle1">{event.user.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              @{event.user.username}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <ScheduleIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary">
            {format(new Date(event.timestamp), 'PPpp')}
          </Typography>
        </Box>

        {event.topics && event.topics.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LabelIcon fontSize="small" />
              Topics
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {event.topics.map((topic, index) => (
                <Chip
                  key={index}
                  label={topic}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}

        {event.sentiment && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Sentiment Analysis
            </Typography>
            <Chip
              label={`${event.sentiment.label} (${event.sentiment.score.toFixed(2)})`}
              size="small"
              sx={{
                bgcolor: getSentimentColor(event.sentiment) + '20',
                color: getSentimentColor(event.sentiment),
                fontWeight: 500
              }}
            />
          </Box>
        )}

        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Additional Information
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(event.metadata).map(([key, value]) => (
                <Chip
                  key={key}
                  label={`${key}: ${value}`}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: theme.palette.background.default }}>
        <Button onClick={onClose}>Close</Button>
        {event.user.socialLinks && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {Object.entries(event.user.socialLinks).map(([platform, url]) => (
              <IconButton
                key={platform}
                size="small"
                component={Link}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {getPlatformIcon(platform)}
              </IconButton>
            ))}
          </Box>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default EventDetails; 