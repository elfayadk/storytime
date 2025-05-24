import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid as MuiGrid,
  useTheme
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';
import type { TimelineEvent } from '../types';

interface AnalyticsDashboardProps {
  events: TimelineEvent[];
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ events }) => {
  const theme = useTheme();

  // Prepare data for sentiment analysis chart
  const sentimentData = useMemo(() => {
    const data = events
      .filter(event => event.sentiment)
      .reduce((acc, event) => {
        const sentiment = event.sentiment!;
        acc[sentiment.label] = (acc[sentiment.label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(data).map(([label, count]) => ({
      name: label.charAt(0).toUpperCase() + label.slice(1),
      value: count
    }));
  }, [events]);

  // Prepare data for topic distribution chart
  const topicData = useMemo(() => {
    const topicCounts = new Map<string, number>();
    
    events.forEach(event => {
      event.topics?.forEach(topic => {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
      });
    });

    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({
        name: topic,
        count
      }));
  }, [events]);

  // Prepare data for activity timeline chart
  const activityData = useMemo(() => {
    const activityData: Record<string, number> = {};
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const platformCounts: Record<string, number> = {};

    events.forEach(event => {
      // Handle date
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      activityData[date] = (activityData[date] || 0) + 1;

      // ... rest of the function ...
    });

    return Object.entries(activityData).map(([date, count]) => ({
      date,
      count
    }));
  }, [events]);

  // Prepare data for platform distribution chart
  const platformData = useMemo(() => {
    const data = events.reduce((acc, event) => {
      acc[event.platform] = (acc[event.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(data).map(([platform, count]) => ({
      name: platform.charAt(0).toUpperCase() + platform.slice(1),
      value: count
    }));
  }, [events]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const uniqueUsers = new Set(events.map(e => e.username)).size;
    const avgSentiment = events
      .filter(e => e.sentiment)
      .reduce((sum, e) => sum + e.sentiment!.score, 0) / events.filter(e => e.sentiment).length;
    const topTopics = Array.from(new Set(events.flatMap(e => e.topics || [])))
      .slice(0, 5);

    return { totalEvents, uniqueUsers, avgSentiment, topTopics };
  }, [events]);

  const COLORS = [
    theme.palette.primary.main,
    theme.palette.secondary.main,
    theme.palette.error.main,
    theme.palette.warning.main,
    theme.palette.info.main,
    theme.palette.success.main
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Summary Cards */}
      <MuiGrid container spacing={3} sx={{ mb: 3 }}>
        <MuiGrid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Events
              </Typography>
              <Typography variant="h4">
                {stats.totalEvents}
              </Typography>
            </CardContent>
          </Card>
        </MuiGrid>
        <MuiGrid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Unique Users
              </Typography>
              <Typography variant="h4">
                {stats.uniqueUsers}
              </Typography>
            </CardContent>
          </Card>
        </MuiGrid>
        <MuiGrid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Average Sentiment
              </Typography>
              <Typography variant="h4">
                {stats.avgSentiment.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </MuiGrid>
        <MuiGrid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Top Topics
              </Typography>
              <Typography variant="body2">
                {stats.topTopics.join(', ')}
              </Typography>
            </CardContent>
          </Card>
        </MuiGrid>
      </MuiGrid>

      {/* Charts */}
      <MuiGrid container spacing={3}>
        {/* Activity Timeline */}
        <MuiGrid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Activity Timeline
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={theme.palette.primary.main}
                    name="Events"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MuiGrid>

        {/* Sentiment Distribution */}
        <MuiGrid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sentiment Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={sentimentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {sentimentData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MuiGrid>

        {/* Platform Distribution */}
        <MuiGrid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Platform Distribution
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={platformData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {platformData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MuiGrid>

        {/* Topic Distribution */}
        <MuiGrid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Topics
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topicData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="count"
                    fill={theme.palette.primary.main}
                    name="Occurrences"
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MuiGrid>
      </MuiGrid>
    </Box>
  );
};

export default AnalyticsDashboard; 