import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Typography,
  Paper,
} from '@mui/material';
import { api } from '../services/api';

interface UserScraperProps {
  onUserScraped: (user: any, events: any[]) => void;
}

const UserScraper: React.FC<UserScraperProps> = ({ onUserScraped }) => {
  const [platform, setPlatform] = useState<'github' | 'twitter' | 'reddit'>('github');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.scrapeUser({ platform, username });
      if (response.success && response.user && response.events) {
        setSuccess(`Successfully scraped ${platform} user: ${username}`);
        onUserScraped(response.user, response.events);
      } else {
        setError('Failed to scrape user data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while scraping user data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Scrape User Data
      </Typography>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <FormControl fullWidth>
          <InputLabel>Platform</InputLabel>
          <Select
            value={platform}
            label="Platform"
            onChange={(e) => setPlatform(e.target.value as 'github' | 'twitter' | 'reddit')}
          >
            <MenuItem value="github">GitHub</MenuItem>
            <MenuItem value="twitter">Twitter</MenuItem>
            <MenuItem value="reddit">Reddit</MenuItem>
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder={`Enter ${platform} username`}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={loading || !username}
          sx={{ mt: 1 }}
        >
          {loading ? (
            <CircularProgress size={24} sx={{ mr: 1 }} />
          ) : (
            'Scrape User Data'
          )}
        </Button>

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}
      </Box>
    </Paper>
  );
};

export default UserScraper; 