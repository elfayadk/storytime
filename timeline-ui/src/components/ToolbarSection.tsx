import React from 'react';
import {
  Box,
  Paper,
  InputBase,
  IconButton,
  Divider,
  Chip,
  Stack,
  Tooltip,
  FormControl,
  Select,
  MenuItem,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  Popover,
  Button,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select/SelectInput';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  ViewModule as ViewModuleIcon,
  ViewTimeline as ViewTimelineIcon,
  Map as MapIcon,
  BubbleChart as NetworkIcon,
  Download as ExportIcon,
  Settings as SettingsIcon,
  Person as PersonIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import DateRangeFilter from './DateRangeFilter';
import type { User } from '../types';

interface ToolbarSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPlatforms: string[];
  onPlatformToggle: (platform: string) => void;
  viewMode: string;
  onViewModeChange: (mode: string) => void;
  sortOrder: string;
  onSortOrderChange: (order: string) => void;
  startDate: string;
  endDate: string;
  onDateRangeChange: (startDate: string, endDate: string) => void;
  filteredUsers: User[];
  onUserSelect: (user: User) => void;
  selectedUser: User | null;
}

const ToolbarSection: React.FC<ToolbarSectionProps> = ({
  searchQuery,
  onSearchChange,
  selectedPlatforms,
  onPlatformToggle,
  viewMode,
  onViewModeChange,
  sortOrder,
  onSortOrderChange,
  startDate,
  endDate,
  onDateRangeChange,
  filteredUsers,
  onUserSelect,
  selectedUser,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLDivElement | null>(null);
  const open = Boolean(anchorEl);

  const handleSearchFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    if (filteredUsers.length > 0) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleSearchBlur = () => {
    // Add a small delay to allow clicking on the user list
    setTimeout(() => {
      setAnchorEl(null);
    }, 200);
  };

  const handleUserClick = (user: User) => {
    onUserSelect(user);
    setAnchorEl(null);
  };

  const handleSortChange = (event: SelectChangeEvent) => {
    onSortOrderChange(event.target.value);
  };

  const handleViewModeChange = (mode: string) => {
    onViewModeChange(mode);
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Paper
        elevation={1}
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          bgcolor: 'background.paper',
        }}
      >
        {/* Search and Basic Controls */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Paper
            component="form"
            sx={{
              p: '2px 4px',
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
            }}
          >
            <InputBase
              sx={{ ml: 1, flex: 1 }}
              placeholder={selectedUser ? `Filtering by ${selectedUser.name}` : "Search users by name, username, or email..."}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
            />
            {selectedUser && (
              <Tooltip title="Clear user filter">
                <IconButton size="small" onClick={() => onUserSelect(null)}>
                  <CloseIcon />
                </IconButton>
              </Tooltip>
            )}
            <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
            <Tooltip title="Search">
              <IconButton type="button" sx={{ p: '10px' }}>
                <SearchIcon />
              </IconButton>
            </Tooltip>
          </Paper>

          <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'left',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'left',
            }}
            PaperProps={{
              sx: {
                width: anchorEl?.offsetWidth,
                maxHeight: 300,
                overflowY: 'auto',
              },
            }}
          >
            <List>
              {filteredUsers.map((user) => (
                <ListItem
                  key={user.id}
                  button
                  onClick={() => handleUserClick(user)}
                  sx={{
                    '&:hover': {
                      bgcolor: 'action.hover',
                    },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar src={user.avatarUrl}>
                      <PersonIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={user.name}
                    secondary={
                      <React.Fragment>
                        {user.username} • {user.email}
                        <br />
                        {user.company && `${user.company} • `}{user.location}
                      </React.Fragment>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Popover>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={sortOrder}
              onChange={handleSortChange}
              displayEmpty
              variant="outlined"
              startAdornment={<SortIcon sx={{ mr: 1 }} />}
            >
              <MenuItem value="newest">Newest First</MenuItem>
              <MenuItem value="oldest">Oldest First</MenuItem>
              <MenuItem value="relevance">Most Relevant</MenuItem>
              <MenuItem value="engagement">Most Engaged</MenuItem>
            </Select>
          </FormControl>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Timeline View">
              <IconButton
                color={viewMode === 'timeline' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('timeline')}
              >
                <ViewTimelineIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Grid View">
              <IconButton
                color={viewMode === 'grid' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('grid')}
              >
                <ViewModuleIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Map View">
              <IconButton
                color={viewMode === 'map' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('map')}
              >
                <MapIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Network View">
              <IconButton
                color={viewMode === 'network' ? 'primary' : 'default'}
                onClick={() => handleViewModeChange('network')}
              >
                <NetworkIcon />
              </IconButton>
            </Tooltip>
          </Stack>

          <Divider orientation="vertical" flexItem />

          <Stack direction="row" spacing={1}>
            <Tooltip title="Export Data">
              <IconButton>
                <ExportIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Settings">
              <IconButton>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Filters and Tags */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
            <FilterIcon sx={{ mr: 0.5, fontSize: 20 }} />
            Filters:
          </Typography>
          
          <Stack direction="row" spacing={1}>
            <Chip
              label="GitHub"
              onClick={() => onPlatformToggle('github')}
              color={selectedPlatforms.includes('github') ? 'primary' : 'default'}
              variant={selectedPlatforms.includes('github') ? 'filled' : 'outlined'}
            />
            <Chip
              label="Twitter"
              onClick={() => onPlatformToggle('twitter')}
              color={selectedPlatforms.includes('twitter') ? 'primary' : 'default'}
              variant={selectedPlatforms.includes('twitter') ? 'filled' : 'outlined'}
            />
            <Chip
              label="Reddit"
              onClick={() => onPlatformToggle('reddit')}
              color={selectedPlatforms.includes('reddit') ? 'primary' : 'default'}
              variant={selectedPlatforms.includes('reddit') ? 'filled' : 'outlined'}
            />
          </Stack>

          <Divider orientation="vertical" flexItem />

          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={onDateRangeChange}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default ToolbarSection; 