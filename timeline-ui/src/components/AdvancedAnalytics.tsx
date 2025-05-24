import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  useTheme
} from '@mui/material';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Scatter,
  ScatterChart
} from 'recharts';
import type { TimelineEvent } from '../types';

interface AdvancedAnalyticsProps {
  events: TimelineEvent[];
}

const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ events }) => {
  const theme = useTheme();

  // Activity over time
  const activityData = useMemo(() => {
    const data = events.reduce((acc, event) => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(data)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events]);

  // Sentiment distribution over platforms
  const sentimentData = useMemo(() => {
    const data = events.reduce((acc, event) => {
      const platform = event.platform;
      const sentiment = event.sentiment?.label || 'neutral';
      
      if (!acc[platform]) {
        acc[platform] = { platform, positive: 0, neutral: 0, negative: 0 };
      }
      acc[platform][sentiment]++;
      
      return acc;
    }, {} as Record<string, any>);

    return Object.values(data);
  }, [events]);

  // Topic correlation
  const topicCorrelation = useMemo(() => {
    const correlations: Record<string, { topic: string; frequency: number; impact: number }> = {};
    
    events.forEach(event => {
      event.topics?.forEach(topic => {
        if (!correlations[topic]) {
          correlations[topic] = {
            topic,
            frequency: 0,
            impact: event.sentiment?.score || 0.5
          };
        } else {
          correlations[topic].frequency++;
          correlations[topic].impact += event.sentiment?.score || 0.5;
        }
      });
    });

    return Object.values(correlations).map(item => ({
      ...item,
      impact: item.impact / (item.frequency || 1)
    }));
  }, [events]);

  // Platform distribution
  const platformData = useMemo(() => {
    return events.reduce((acc, event) => {
      const platform = event.platform;
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
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
      <Typography variant="h5" gutterBottom>Advanced Analytics</Typography>
      
      <Grid container spacing={3}>
        {/* Activity Timeline */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Activity Timeline</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={theme.palette.primary.main}
                    fill={theme.palette.primary.light}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Sentiment by Platform */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Sentiment by Platform</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={sentimentData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="positive"
                    stroke={theme.palette.success.main}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="neutral"
                    stroke={theme.palette.warning.main}
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="negative"
                    stroke={theme.palette.error.main}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Topic Impact Analysis */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Topic Impact Analysis</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="frequency"
                    name="Frequency"
                    type="number"
                  />
                  <YAxis
                    dataKey="impact"
                    name="Impact"
                    type="number"
                    domain={[0, 1]}
                  />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter
                    name="Topics"
                    data={topicCorrelation}
                    fill={theme.palette.primary.main}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Platform Distribution */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Platform Distribution</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(platformData).map(([name, value]) => ({
                      name,
                      value
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {Object.keys(platformData).map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AdvancedAnalytics; 