import React, { useState, Suspense, useEffect } from 'react';
import {
  Box,
  Container,
  AppBar,
  Toolbar,
  Typography,
  Tabs,
  Tab,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Card,
  CardContent,
  Paper,
  IconButton,
  InputBase,
  Grid,
  CircularProgress,
  Avatar,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Person as PersonIcon,
  GitHub as GitHubIcon,
  Twitter as TwitterIcon,
  LinkedIn as LinkedInIcon,
  Reddit as RedditIcon,
  Email as EmailIcon,
  Business as BusinessIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import TimelineView from './components/TimelineView';
import AnalyticsView from './components/AnalyticsView';
import ToolbarSection from './components/ToolbarSection';
import type { TimelineEvent, User } from './types';
import UserScraper from './components/UserScraper';
import { api } from './services/api';

const theme = createTheme({
  typography: {
    fontFamily: '"Poppins", sans-serif',
    h1: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 700
    },
    h2: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 600
    },
    h3: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 600
    },
    h4: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 500
    },
    h5: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 500
    },
    h6: {
      fontFamily: '"Playfair Display", serif',
      fontWeight: 500
    }
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0'
    },
    secondary: {
      main: '#dc004e',
      light: '#ff4081',
      dark: '#9a0036'
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff'
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
          boxShadow: '0 3px 5px 2px rgba(33, 150, 243, .3)'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 4px -1px rgba(0,0,0,0.1), 0 4px 5px 0 rgba(0,0,0,0.07), 0 1px 10px 0 rgba(0,0,0,0.06)'
        }
      }
    }
  }
});

// Add more mock users
const mockUsers: User[] = [
  {
    id: 'user1',
    username: 'developer1',
    email: 'developer1@example.com',
    name: 'John Developer',
    avatarUrl: 'https://i.pravatar.cc/150?u=developer1',
    bio: 'Senior Software Engineer | Open Source Enthusiast',
    location: 'San Francisco, CA',
    company: 'TechCorp',
    socialLinks: {
      github: 'https://github.com/developer1',
      twitter: 'https://twitter.com/developer1',
      linkedin: 'https://linkedin.com/in/developer1'
    }
  },
  {
    id: 'user2',
    username: 'tester1',
    email: 'tester1@example.com',
    name: 'Alice Tester',
    avatarUrl: 'https://i.pravatar.cc/150?u=tester1',
    bio: 'QA Engineer | Bug Hunter',
    location: 'New York, NY',
    company: 'QualityFirst',
    socialLinks: {
      github: 'https://github.com/tester1',
      twitter: 'https://twitter.com/tester1'
    }
  },
  {
    id: 'user3',
    username: 'techie42',
    email: 'techie42@example.com',
    name: 'Sarah Tech',
    avatarUrl: 'https://i.pravatar.cc/150?u=techie42',
    bio: 'Tech Blogger | Developer Advocate',
    location: 'Austin, TX',
    company: 'DevRel Inc',
    socialLinks: {
      twitter: 'https://twitter.com/techie42',
      linkedin: 'https://linkedin.com/in/techie42'
    }
  },
  {
    id: 'user4',
    username: 'dev_seeker',
    email: 'dev_seeker@example.com',
    name: 'Mike Seeker',
    avatarUrl: 'https://i.pravatar.cc/150?u=dev_seeker',
    bio: 'Full Stack Developer | Always Learning',
    location: 'Seattle, WA',
    company: 'TechStart',
    socialLinks: {
      github: 'https://github.com/dev_seeker',
      reddit: 'https://reddit.com/u/dev_seeker'
    }
  },
  {
    id: 'user5',
    username: 'developer2',
    email: 'developer2@example.com',
    name: 'Emma Developer',
    avatarUrl: 'https://i.pravatar.cc/150?u=developer2',
    bio: 'Frontend Developer | UI/UX Enthusiast',
    location: 'Portland, OR',
    company: 'WebCraft',
    socialLinks: {
      github: 'https://github.com/developer2',
      twitter: 'https://twitter.com/developer2',
      linkedin: 'https://linkedin.com/in/developer2'
    }
  }
];

// Extended mock data
const mockEvents: TimelineEvent[] = [
  {
    id: '1',
    timestamp: '2024-03-24T10:00:00Z',
    title: 'Code Commit',
    description: 'Updated README.md',
    content: 'Added project documentation',
    category: 'code_commit',
    platform: 'github',
    user: mockUsers[0], // developer1
    sentiment: {
      score: 0.8,
      label: 'positive'
    },
    entities: [
      { text: 'documentation', type: 'other', confidence: 0.9 }
    ],
    topics: ['docs', 'readme'],
    metadata: {}
  },
  {
    id: '2',
    timestamp: '2024-03-24T09:30:00Z',
    title: 'New Issue Created',
    description: 'Bug: Navigation not working on mobile',
    content: 'The navigation menu is not responsive on mobile devices',
    category: 'issue',
    platform: 'github',
    user: mockUsers[1], // tester1
    sentiment: {
      score: 0.3,
      label: 'negative'
    },
    topics: ['bug', 'mobile', 'navigation'],
    metadata: { priority: 'high' }
  },
  {
    id: '3',
    timestamp: '2024-03-24T09:00:00Z',
    title: 'Twitter Discussion',
    description: 'Excited about the new features!',
    content: 'Just tried the new timeline visualization - amazing work team! #webdev',
    category: 'post',
    platform: 'twitter',
    user: mockUsers[2], // techie42
    sentiment: {
      score: 0.9,
      label: 'positive'
    },
    topics: ['feedback', 'feature'],
    metadata: { likes: 42, retweets: 12 }
  },
  {
    id: '4',
    timestamp: '2024-03-23T15:00:00Z',
    title: 'Reddit Post',
    description: 'Looking for timeline visualization recommendations',
    content: 'What libraries do you recommend for building interactive timelines?',
    category: 'post',
    platform: 'reddit',
    user: mockUsers[3], // dev_seeker
    sentiment: {
      score: 0.5,
      label: 'neutral'
    },
    topics: ['question', 'visualization', 'libraries'],
    metadata: { upvotes: 15, comments: 8 }
  },
  {
    id: '5',
    timestamp: '2024-03-23T14:30:00Z',
    title: 'Pull Request Merged',
    description: 'Feature: Add dark mode support',
    content: 'Implemented system-wide dark mode with theme switching',
    category: 'code_pr',
    platform: 'github',
    user: mockUsers[4], // developer2
    sentiment: {
      score: 0.85,
      label: 'positive'
    },
    topics: ['feature', 'dark-mode', 'ui'],
    metadata: { additions: 156, deletions: 23 }
  }
];

function App() {
  const [currentTab, setCurrentTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState('timeline');
  const [sortOrder, setSortOrder] = useState('newest');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [events, setEvents] = useState<TimelineEvent[]>(mockEvents);
  const [isLoading, setIsLoading] = useState(false);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setCurrentTab(newValue);
    if (newValue === 'all') {
      setSelectedUser(null);
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setCurrentTab(user.id);
    setSearchQuery('');
    handleUserMenuClose();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = mockUsers.filter(user =>
        user.name.toLowerCase().includes(query.toLowerCase()) ||
        user.username.toLowerCase().includes(query.toLowerCase()) ||
        user.email.toLowerCase().includes(query.toLowerCase()) ||
        user.company?.toLowerCase().includes(query.toLowerCase()) ||
        user.location?.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const togglePlatformFilter = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const loadedUsers = await api.getUsers();
      setUsers(loadedUsers);
      
      // Load events for all users
      const allEvents = await Promise.all(
        loadedUsers.map(user => api.getUserEvents(user.id))
      );
      setEvents(allEvents.flat());
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserScraped = async (user: User, newEvents: TimelineEvent[]) => {
    setUsers(prev => {
      const existingUserIndex = prev.findIndex(u => u.id === user.id);
      if (existingUserIndex >= 0) {
        // Update existing user
        const updated = [...prev];
        updated[existingUserIndex] = user;
        return updated;
      }
      // Add new user
      return [...prev, user];
    });

    setEvents(prev => {
      // Remove old events for this user
      const filtered = prev.filter(e => e.user.id !== user.id);
      // Add new events
      return [...filtered, ...newEvents];
    });
  };

  // Filter events based on current tab, search, and filters
  const filteredEvents = mockEvents.filter(event => {
    // Tab filtering
    if (currentTab !== 'all' && event.user.id !== currentTab) {
      return false;
    }

    // Search filtering
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        event.title.toLowerCase().includes(searchLower) ||
        event.description.toLowerCase().includes(searchLower) ||
        event.content.toLowerCase().includes(searchLower) ||
        event.user.name.toLowerCase().includes(searchLower) ||
        event.user.username.toLowerCase().includes(searchLower) ||
        event.user.email.toLowerCase().includes(searchLower) ||
        event.topics?.some(topic => topic.toLowerCase().includes(searchLower));

      if (!matchesSearch) {
        return false;
      }
    }

    // Platform filtering
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(event.platform)) {
      return false;
    }

    // Date range filtering
    if (startDate || endDate) {
      const eventDate = new Date(event.timestamp);
      if (startDate && eventDate < new Date(startDate)) return false;
      if (endDate && eventDate > new Date(endDate)) return false;
    }

    return true;
  });

  // Sort events
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    switch (sortOrder) {
      case 'oldest':
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      case 'newest':
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      case 'relevance':
        return (b.sentiment?.score || 0) - (a.sentiment?.score || 0);
      case 'engagement':
        const getEngagement = (event: TimelineEvent) => {
          const meta = event.metadata as Record<string, number>;
          return (meta.likes || 0) + (meta.comments || 0) * 2 + (meta.retweets || 0) * 3;
        };
        return getEngagement(b) - getEngagement(a);
      default:
        return 0;
    }
  });

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Storytime</Typography>
            <Paper
              component="form"
              sx={{
                p: '2px 4px',
                display: 'flex',
                alignItems: 'center',
                width: 400,
                mr: 2,
                position: 'relative',
              }}
            >
              <InputBase
                sx={{ ml: 1, flex: 1 }}
                placeholder="Search by name, username, or email..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <IconButton type="button" sx={{ p: '10px' }}>
                <SearchIcon />
              </IconButton>
              {searchResults.length > 0 && searchQuery && (
                <Paper
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    mt: 1,
                    maxHeight: 400,
                    overflow: 'auto',
                  }}
                >
                  {searchResults.map((user) => (
                    <MenuItem
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                    >
                      <Avatar src={user.avatarUrl} alt={user.name}>
                        {user.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1">{user.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {user.username} • {user.email}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Paper>
              )}
            </Paper>
            <Button
              color="inherit"
              onClick={handleUserMenuOpen}
              startIcon={<PersonIcon />}
            >
              {selectedUser ? selectedUser.name : 'All Users'}
            </Button>
            <Menu
              anchorEl={userMenuAnchor}
              open={Boolean(userMenuAnchor)}
              onClose={handleUserMenuClose}
              PaperProps={{
                sx: { width: 320 }
              }}
            >
              <MenuItem onClick={() => { setCurrentTab('all'); setSelectedUser(null); handleUserMenuClose(); }}>
                <ListItemIcon>
                  <PersonIcon />
                </ListItemIcon>
                <ListItemText primary="All Users" />
              </MenuItem>
              <Divider />
              {mockUsers.map((user) => (
                <MenuItem key={user.id} onClick={() => handleUserSelect(user)}>
                  <ListItemIcon>
                    <Avatar src={user.avatarUrl} alt={user.name}>
                      {user.name.charAt(0)}
                    </Avatar>
                  </ListItemIcon>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="subtitle1">{user.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {user.username}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Toolbar>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ bgcolor: 'background.paper' }}
          >
            <Tab label="All Users" value="all" />
            {mockUsers.map((user) => (
              <Tab
                key={user.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      src={user.avatarUrl}
                      alt={user.name}
                      sx={{ width: 24, height: 24 }}
                    >
                      {user.name.charAt(0)}
                    </Avatar>
                    <span>{user.name}</span>
                  </Box>
                }
                value={user.id}
              />
            ))}
          </Tabs>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 3, mb: 3, flex: 1 }}>
          <UserScraper onUserScraped={handleUserScraped} />
          
          {selectedUser && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Avatar
                    src={selectedUser.avatarUrl}
                    alt={selectedUser.name}
                    sx={{ width: 80, height: 80 }}
                  >
                    {selectedUser.name.charAt(0)}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="h5">{selectedUser.name}</Typography>
                    <Typography color="text.secondary">@{selectedUser.username}</Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>{selectedUser.bio}</Typography>
                    <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                      {selectedUser.company && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <BusinessIcon fontSize="small" color="action" />
                          <Typography variant="body2">{selectedUser.company}</Typography>
                        </Box>
                      )}
                      {selectedUser.location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationIcon fontSize="small" color="action" />
                          <Typography variant="body2">{selectedUser.location}</Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EmailIcon fontSize="small" color="action" />
                        <Typography variant="body2">{selectedUser.email}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                      {selectedUser.socialLinks?.github && (
                        <IconButton
                          size="small"
                          href={selectedUser.socialLinks.github}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <GitHubIcon fontSize="small" />
                        </IconButton>
                      )}
                      {selectedUser.socialLinks?.twitter && (
                        <IconButton
                          size="small"
                          href={selectedUser.socialLinks.twitter}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <TwitterIcon fontSize="small" sx={{ color: '#1DA1F2' }} />
                        </IconButton>
                      )}
                      {selectedUser.socialLinks?.linkedin && (
                        <IconButton
                          size="small"
                          href={selectedUser.socialLinks.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <LinkedInIcon fontSize="small" sx={{ color: '#0077B5' }} />
                        </IconButton>
                      )}
                      {selectedUser.socialLinks?.reddit && (
                        <IconButton
                          size="small"
                          href={selectedUser.socialLinks.reddit}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <RedditIcon fontSize="small" sx={{ color: '#FF4500' }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Stats Summary */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    {selectedUser ? 'User Events' : 'Total Events'}
                  </Typography>
                  <Typography variant="h4">{sortedEvents.length}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>Platforms Used</Typography>
                  <Typography variant="h4">
                    {new Set(sortedEvents.map(e => e.platform)).size}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>Average Sentiment</Typography>
                  <Typography variant="h4">
                    {sortedEvents.length > 0
                      ? (sortedEvents.reduce((acc, e) => acc + (e.sentiment?.score || 0), 0) / sortedEvents.length)
                        .toFixed(2)
                      : 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>Most Active Platform</Typography>
                  <Typography variant="h4" sx={{ textTransform: 'capitalize' }}>
                    {sortedEvents.length > 0
                      ? Object.entries(
                          sortedEvents.reduce((acc, e) => {
                            acc[e.platform] = (acc[e.platform] || 0) + 1;
                            return acc;
                          }, {} as Record<string, number>)
                        )
                          .sort(([,a], [,b]) => b - a)[0][0]
                      : 'N/A'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Toolbar Section */}
          <ToolbarSection
            searchQuery={searchQuery}
            onSearchChange={handleSearch}
            selectedPlatforms={selectedPlatforms}
            onPlatformToggle={togglePlatformFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            filteredUsers={searchResults}
            onUserSelect={handleUserSelect}
            selectedUser={selectedUser}
          />

          {/* Main Content */}
          <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
              <CircularProgress />
            </Box>
          }>
            <TimelineView
              events={sortedEvents}
              onEventClick={(event) => console.log('Event clicked:', event)}
            />
          </Suspense>
        </Container>

        {/* Footer */}
        <Box 
          component="footer" 
          sx={{ 
            py: 3, 
            px: 2, 
            mt: 'auto',
            backgroundColor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Container maxWidth="lg">
            <Typography variant="body2" color="text.secondary" align="center">
              Created by Fayad K. Hassan • {new Date().getFullYear()}
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
