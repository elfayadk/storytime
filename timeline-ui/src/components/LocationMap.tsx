import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from 'react-leaflet';
import { Box, Typography, useTheme } from '@mui/material';
import 'leaflet/dist/leaflet.css';
import { TimelineEvent } from '../types';

interface LocationPoint {
  lat: number;
  lng: number;
  events: TimelineEvent[];
  type: 'event' | 'cluster';
}

interface LocationMapProps {
  events: TimelineEvent[];
  width?: number;
  height?: number;
  onEventClick?: (event: TimelineEvent) => void;
}

const LocationMap: React.FC<LocationMapProps> = ({
  events,
  width = 800,
  height = 600,
  onEventClick
}) => {
  const theme = useTheme();

  // Group events by location
  const locationPoints = useMemo(() => {
    const points = new Map<string, LocationPoint>();
    
    events.forEach(event => {
      const locationEntities = event.entities?.filter(e => e.type === 'location') || [];
      
      locationEntities.forEach(location => {
        // Use geocoding service to get coordinates
        // For now, using mock coordinates for demonstration
        const mockCoords = getMockCoordinates(location.text);
        if (!mockCoords) return;

        const key = `${mockCoords.lat},${mockCoords.lng}`;
        if (!points.has(key)) {
          points.set(key, {
            lat: mockCoords.lat,
            lng: mockCoords.lng,
            events: [event],
            type: 'event'
          });
        } else {
          points.get(key)!.events.push(event);
          if (points.get(key)!.events.length > 1) {
            points.get(key)!.type = 'cluster';
          }
        }
      });
    });

    return Array.from(points.values());
  }, [events]);

  // Mock geocoding function - replace with actual geocoding service
  const getMockCoordinates = (location: string): { lat: number; lng: number } | null => {
    const mockLocations: Record<string, [number, number]> = {
      'San Francisco': [37.7749, -122.4194],
      'New York': [40.7128, -74.0060],
      'London': [51.5074, -0.1278],
      'Tokyo': [35.6762, 139.6503],
      'Berlin': [52.5200, 13.4050],
      'Paris': [48.8566, 2.3522],
      'Sydney': [-33.8688, 151.2093],
      'Singapore': [1.3521, 103.8198],
      'Toronto': [43.6532, -79.3832],
      'Mumbai': [19.0760, 72.8777]
    };

    // Simple fuzzy matching
    const key = Object.keys(mockLocations).find(k => 
      location.toLowerCase().includes(k.toLowerCase()) ||
      k.toLowerCase().includes(location.toLowerCase())
    );

    return key ? { lat: mockLocations[key][0], lng: mockLocations[key][1] } : null;
  };

  const getMarkerColor = (platform: string) => {
    switch (platform) {
      case 'github':
        return theme.palette.secondary.main;
      case 'twitter':
        return theme.palette.info.main;
      case 'reddit':
        return theme.palette.error.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const renderPopupContent = (point: LocationPoint) => (
    <Box sx={{ maxWidth: 300 }}>
      <Typography variant="subtitle1" gutterBottom>
        {point.type === 'cluster' ? `${point.events.length} events` : 'Event'}
      </Typography>
      {point.events.map((event, index) => (
        <Box
          key={event.id}
          sx={{
            mt: index > 0 ? 1 : 0,
            p: 1,
            bgcolor: 'background.paper',
            borderRadius: 1,
            cursor: onEventClick ? 'pointer' : 'default',
            '&:hover': onEventClick ? {
              bgcolor: 'action.hover'
            } : {}
          }}
          onClick={() => onEventClick?.(event)}
        >
          <Typography variant="subtitle2" color="primary">
            {event.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {event.platform} • {event.username}
          </Typography>
          <Typography variant="body2" noWrap>
            {event.content}
          </Typography>
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ width, height }}>
      <MapContainer
        center={[20, 0]} // Default center
        zoom={2}
        style={{ width: '100%', height: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {locationPoints.map((point, index) => (
          point.type === 'cluster' ? (
            <CircleMarker
              key={index}
              center={[point.lat, point.lng]}
              radius={Math.min(20, Math.max(10, Math.sqrt(point.events.length * 100)))}
              fillColor={theme.palette.primary.main}
              fillOpacity={0.6}
              stroke={false}
            >
              <Popup>
                {renderPopupContent(point)}
              </Popup>
            </CircleMarker>
          ) : (
            <Marker
              key={index}
              position={[point.lat, point.lng]}
            >
              <Popup>
                {renderPopupContent(point)}
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </Box>
  );
};

export default LocationMap; 