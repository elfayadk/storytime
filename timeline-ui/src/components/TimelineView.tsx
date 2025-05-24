import React, { useState } from 'react';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Collapse,
  Avatar,
  Tooltip,
  Badge
} from '@mui/material';
import {
  Code as CodeIcon,
  Comment as CommentIcon,
  Create as CreateIcon,
  Public as PublicIcon,
  BugReport as BugIcon,
  ExpandMore as ExpandMoreIcon,
  GitHub as GitHubIcon,
  Twitter as TwitterIcon,
  Reddit as RedditIcon,
  SentimentSatisfiedAlt as SentimentPositiveIcon,
  SentimentDissatisfied as SentimentNegativeIcon,
  SentimentNeutral as SentimentNeutralIcon,
  LinkedIn as LinkedInIcon
} from '@mui/icons-material';
import type { TimelineEvent, User } from '../types';

interface TimelineViewProps {
  events: TimelineEvent[];
  onEventClick?: (event: TimelineEvent) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({ events, onEventClick }) => {
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const toggleEventExpansion = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedEvents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const getEventIcon = (category: string) => {
    switch (category) {
      case 'code_commit':
      case 'code_pr':
      case 'code_create':
        return <CodeIcon />;
      case 'comment':
        return <CommentIcon />;
      case 'post':
        return <CreateIcon />;
      case 'issue':
        return <BugIcon />;
      default:
        return <PublicIcon />;
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'github':
        return <GitHubIcon />;
      case 'twitter':
        return <TwitterIcon sx={{ color: '#1DA1F2' }} />;
      case 'reddit':
        return <RedditIcon sx={{ color: '#FF4500' }} />;
      default:
        return <PublicIcon />;
    }
  };

  const getSentimentIcon = (sentiment?: { score: number; label: string }) => {
    if (!sentiment) return null;
    
    switch (sentiment.label) {
      case 'positive':
        return <SentimentPositiveIcon sx={{ color: '#4caf50' }} />;
      case 'negative':
        return <SentimentNegativeIcon sx={{ color: '#f44336' }} />;
      default:
        return <SentimentNeutralIcon sx={{ color: '#9e9e9e' }} />;
    }
  };

  const getEventColor = (category: string) => {
    switch (category) {
      case 'code_commit':
      case 'code_pr':
      case 'code_create':
        return '#2196f3';
      case 'issue':
        return '#f44336';
      case 'post':
        return '#4caf50';
      case 'comment':
        return '#ff9800';
      default:
        return '#9e9e9e';
    }
  };

  return (
    <Timeline position="alternate">
      {events.map((event) => (
        <TimelineItem key={event.id}>
          <TimelineOppositeContent color="text.secondary">
            <Typography variant="body2">
              {new Date(event.timestamp).toLocaleString()}
            </Typography>
          </TimelineOppositeContent>
          
          <TimelineSeparator>
            <TimelineDot sx={{ bgcolor: getEventColor(event.category) }}>
              {getEventIcon(event.category)}
            </TimelineDot>
            <TimelineConnector />
          </TimelineSeparator>

          <TimelineContent>
            <Card 
              sx={{ 
                cursor: onEventClick ? 'pointer' : 'default',
                '&:hover': onEventClick ? {
                  boxShadow: 3,
                  transform: 'translateY(-2px)',
                  transition: 'all 0.2s'
                } : {}
              }}
              onClick={() => onEventClick?.(event)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar src={event.user.avatarUrl} sx={{ bgcolor: getEventColor(event.category) }}>
                      {!event.user.avatarUrl && event.user.name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="h6" component="div">
                        {event.title}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {event.platform} • {event.user.name} ({event.user.username})
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {getSentimentIcon(event.sentiment)}
                    <IconButton
                      size="small"
                      onClick={(e) => toggleEventExpansion(event.id, e)}
                      sx={{
                        transform: expandedEvents.has(event.id) ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <ExpandMoreIcon />
                    </IconButton>
                  </Box>
                </Box>

                <Typography variant="body2" sx={{ mt: 1 }}>
                  {event.description}
                </Typography>

                <Collapse in={expandedEvents.has(event.id)}>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {event.content}
                    </Typography>

                    {event.topics && event.topics.length > 0 && (
                      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {event.topics.map((topic, index) => (
                          <Tooltip key={index} title={`Topic: ${topic}`}>
                            <Chip
                              label={topic}
                              size="small"
                              variant="outlined"
                              sx={{ borderRadius: 1 }}
                            />
                          </Tooltip>
                        ))}
                      </Box>
                    )}

                    <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        Posted by:
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          src={event.user.avatarUrl}
                          sx={{ width: 24, height: 24 }}
                        >
                          {!event.user.avatarUrl && event.user.name.charAt(0)}
                        </Avatar>
                        <Typography variant="body2">
                          {event.user.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {event.user.company && `at ${event.user.company}`}
                        </Typography>
                      </Box>
                    </Box>

                    {event.user.socialLinks && (
                      <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                        {event.user.socialLinks.github && (
                          <Tooltip title="GitHub Profile">
                            <IconButton
                              size="small"
                              href={event.user.socialLinks.github}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <GitHubIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {event.user.socialLinks.twitter && (
                          <Tooltip title="Twitter Profile">
                            <IconButton
                              size="small"
                              href={event.user.socialLinks.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <TwitterIcon fontSize="small" sx={{ color: '#1DA1F2' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        {event.user.socialLinks.linkedin && (
                          <Tooltip title="LinkedIn Profile">
                            <IconButton
                              size="small"
                              href={event.user.socialLinks.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <LinkedInIcon fontSize="small" sx={{ color: '#0077B5' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          </TimelineContent>
        </TimelineItem>
      ))}
    </Timeline>
  );
};

export default TimelineView; 