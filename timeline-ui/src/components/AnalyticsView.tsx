import React, { useMemo } from 'react';
import {
  Grid as MuiGrid,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider
} from '@mui/material';
import type { Grid } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import type { TimelineEvent } from '../types';

interface AnalyticsViewProps {
  events: TimelineEvent[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ events }) => {
  const analytics = useMemo(() => {
    // Platform distribution
    const platformData = events.reduce((acc: { name: string; value: number }[], event) => {
      const existing = acc.find(item => item.name === event.platform);
      if (existing) {
        existing.value++;
      } else {
        acc.push({ name: event.platform, value: 1 });
      }
      return acc;
    }, []);

    // Category distribution
    const categoryData = events.reduce((acc: { name: string; count: number }[], event) => {
      const existing = acc.find(item => item.name === event.category);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ name: event.category, count: 1 });
      }
      return acc;
    }, []);

    // Sentiment analysis
    const sentimentData = events.reduce((acc: { name: string; value: number }[], event) => {
      if (event.sentiment) {
        const label = event.sentiment.label;
        const existing = acc.find(item => item.name === label);
        if (existing) {
          existing.value++;
        } else {
          acc.push({ name: label, value: 1 });
        }
      }
      return acc;
    }, []);

    // Activity over time
    const timeData = events.reduce((acc: { date: string; count: number }[], event) => {
      const date = new Date(event.timestamp).toLocaleDateString();
      const existing = acc.find(item => item.date === date);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ date, count: 1 });
      }
      return acc.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, []);

    // Top topics
    const topicsData = events.reduce((acc: { name: string; count: number }[], event) => {
      event.topics?.forEach(topic => {
        const existing = acc.find(item => item.name === topic);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ name: topic, count: 1 });
        }
      });
      return acc;
    }, []).sort((a, b) => b.count - a.count).slice(0, 5);

    return {
      platformData,
      categoryData,
      sentimentData,
      timeData,
      topicsData
    };
  }, [events]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography 
        variant="h4" 
        gutterBottom
        sx={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 600,
          color: 'primary.main',
          mb: 4
        }}
      >
        Analytics Dashboard
      </Typography>
      <MuiGrid container spacing={3}>
        {/* Activity Timeline */}
        <MuiGrid item xs={12}>
          <Card>
            <CardHeader 
              title={
                <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>
                  Activity Over Time
                </Typography>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.timeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        fontFamily: '"Poppins", sans-serif',
                        borderRadius: 8,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#1976d2"
                      fill="#1976d2"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </MuiGrid>

        {/* Platform Distribution */}
        <MuiGrid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title={
                <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>
                  Platform Distribution
                </Typography>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.platformData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {analytics.platformData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        fontFamily: '"Poppins", sans-serif',
                        borderRadius: 8,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      formatter={(value) => (
                        <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </MuiGrid>

        {/* Category Distribution */}
        <MuiGrid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title={
                <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>
                  Event Categories
                </Typography>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name"
                      tick={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}
                    />
                    <YAxis 
                      tick={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        fontFamily: '"Poppins", sans-serif',
                        borderRadius: 8,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      formatter={(value) => (
                        <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                    <Bar dataKey="count" fill="#1976d2" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </MuiGrid>

        {/* Sentiment Analysis */}
        <MuiGrid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title={
                <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>
                  Sentiment Analysis
                </Typography>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.sentimentData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label
                    >
                      {analytics.sentimentData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            entry.name === 'positive' ? '#4caf50' :
                            entry.name === 'negative' ? '#f44336' :
                            '#9e9e9e'
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        fontFamily: '"Poppins", sans-serif',
                        borderRadius: 8,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      formatter={(value) => (
                        <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </MuiGrid>

        {/* Top Topics */}
        <MuiGrid item xs={12} md={6}>
          <Card>
            <CardHeader 
              title={
                <Typography variant="h6" sx={{ fontFamily: '"Playfair Display", serif' }}>
                  Top Topics
                </Typography>
              }
            />
            <Divider />
            <CardContent>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={analytics.topicsData}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      type="number"
                      tick={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category"
                      tick={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        fontFamily: '"Poppins", sans-serif',
                        borderRadius: 8,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                    <Legend 
                      formatter={(value) => (
                        <span style={{ fontFamily: '"Poppins", sans-serif', fontSize: 12 }}>
                          {value}
                        </span>
                      )}
                    />
                    <Bar dataKey="count" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </MuiGrid>
      </MuiGrid>
    </Box>
  );
};

export default AnalyticsView; 