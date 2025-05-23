/**
 * Geospatial Analysis Module
 * Provides location detection and mapping capabilities
 */

import { TimelineEvent, GeoLocation, Entity } from '../../types.js';

// Configuration for geo-analysis
export interface GeoAnalysisConfig {
  /** Enable geo extraction */
  enabled: boolean;
  
  /** Minimum confidence level for extracted locations */
  minConfidence?: number;
  
  /** Filter locations by country codes */
  countryFilter?: string[];
  
  /** Specify reverse geocoding provider */
  geocodingProvider?: 'default' | 'osm' | 'google';
  
  /** API key for geocoding service if needed */
  geocodingApiKey?: string;
}

// Geographic bounding box
interface GeoBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Location with frequency
interface LocationFrequency {
  location: GeoLocation;
  count: number;
}

export class GeoAnalyzer {
  private config: GeoAnalysisConfig;
  
  // Location database for simple matching
  private locationDatabase: Map<string, GeoLocation>;
  
  constructor(config: GeoAnalysisConfig = { enabled: true }) {
    this.config = {
      enabled: true,
      minConfidence: 0.7,
      geocodingProvider: 'default',
      ...config
    };
    
    // Initialize simple location database with major cities and countries
    this.locationDatabase = this.initializeLocationDatabase();
  }
  
  /**
   * Process and enhance timeline events with geo information
   */
  async enhanceEventsWithGeoData(events: TimelineEvent[]): Promise<TimelineEvent[]> {
    if (!this.config.enabled) return events;
    
    const enhancedEvents: TimelineEvent[] = [];
    
    for (const event of events) {
      // Start with copy of the original event
      const geoEnhancedEvent = { ...event };
      
      // Check if event already has location data
      if (geoEnhancedEvent.location) {
        enhancedEvents.push(geoEnhancedEvent);
        continue;
      }
      
      // Extract location from event metadata if available
      const metadataLocation = this.extractLocationFromMetadata(geoEnhancedEvent);
      if (metadataLocation) {
        geoEnhancedEvent.location = metadataLocation;
        enhancedEvents.push(geoEnhancedEvent);
        continue;
      }
      
      // Extract location from entities if available
      const entityLocation = this.extractLocationFromEntities(geoEnhancedEvent);
      if (entityLocation) {
        geoEnhancedEvent.location = entityLocation;
        enhancedEvents.push(geoEnhancedEvent);
        continue;
      }
      
      // Extract location from content text
      const contentLocation = await this.extractLocationFromContent(geoEnhancedEvent);
      if (contentLocation) {
        geoEnhancedEvent.location = contentLocation;
      }
      
      enhancedEvents.push(geoEnhancedEvent);
    }
    
    return enhancedEvents;
  }
  
  /**
   * Extract location information from event metadata
   */
  private extractLocationFromMetadata(event: TimelineEvent): GeoLocation | null {
    // Check for direct coordinates in metadata
    if (event.metadata.lat && event.metadata.lng) {
      return {
        lat: parseFloat(event.metadata.lat),
        lng: parseFloat(event.metadata.lng),
        name: event.metadata.locationName || 'Unknown Location'
      };
    }
    
    // Check for geo coordinates in Twitter metadata
    if (event.platform === 'twitter' && event.metadata.geo) {
      const geo = event.metadata.geo;
      if (geo.coordinates && geo.coordinates.length >= 2) {
        return {
          lat: geo.coordinates[0],
          lng: geo.coordinates[1],
          name: geo.place_name || 'Twitter Location'
        };
      }
      
      if (geo.place && geo.place.full_name) {
        const location = this.lookupLocationByName(geo.place.full_name);
        if (location) return location;
      }
    }
    
    // Check for geo in Reddit metadata
    if (event.platform === 'reddit' && event.metadata.subreddit) {
      // Some subreddits are location-based (e.g., r/London)
      const subreddit = event.metadata.subreddit.toLowerCase();
      if (!subreddit.startsWith('r/')) return null;
      
      const locationName = subreddit.substring(2);
      const location = this.lookupLocationByName(locationName);
      if (location) return location;
    }
    
    return null;
  }
  
  /**
   * Extract location from entity data if available
   */
  private extractLocationFromEntities(event: TimelineEvent): GeoLocation | null {
    if (!event.entities || event.entities.length === 0) return null;
    
    // Find location entities
    const locationEntities = event.entities.filter(entity => 
      entity.type === 'location' && entity.confidence >= (this.config.minConfidence || 0.7)
    );
    
    if (locationEntities.length === 0) return null;
    
    // Use the highest confidence location
    const bestLocation = locationEntities.reduce((prev, current) => 
      (current.confidence > prev.confidence) ? current : prev
    );
    
    // Check if entity already has geo coordinates
    if (bestLocation.metadata && 
        bestLocation.metadata.lat && 
        bestLocation.metadata.lng) {
      return {
        lat: bestLocation.metadata.lat,
        lng: bestLocation.metadata.lng,
        name: bestLocation.text
      };
    }
    
    // Try to lookup location by name
    return this.lookupLocationByName(bestLocation.text);
  }
  
  /**
   * Extract location references from content text
   */
  private async extractLocationFromContent(event: TimelineEvent): Promise<GeoLocation | null> {
    if (!event.content || event.content.length === 0) return null;
    
    // Simple location extraction using known city and country names
    // A more robust solution would use NER or a geo parsing API
    
    const words = event.content.split(/\s+/);
    const potentialLocations: string[] = [];
    
    // Extract potential locations (words starting with uppercase)
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[^\w\s]/g, ''); // Remove punctuation
      
      // Skip short words
      if (word.length < 3) continue;
      
      // Check for capitalized words that might be place names
      if (/^[A-Z][a-z]+$/.test(word)) {
        potentialLocations.push(word);
      }
      
      // Check for multi-word locations (e.g., "New York")
      if (i < words.length - 1 && 
          /^[A-Z][a-z]+$/.test(word) && 
          /^[A-Z][a-z]+$/.test(words[i+1])) {
        potentialLocations.push(`${word} ${words[i+1]}`);
      }
    }
    
    // Try to match each potential location against our database
    for (const loc of potentialLocations) {
      const location = this.lookupLocationByName(loc);
      if (location) return location;
    }
    
    return null;
  }
  
  /**
   * Lookup a location by name in our simple database
   */
  private lookupLocationByName(name: string): GeoLocation | null {
    const normalizedName = name.toLowerCase().trim();
    return this.locationDatabase.get(normalizedName) || null;
  }
  
  /**
   * Find the geographic bounding box for a set of events
   */
  getBoundingBox(events: TimelineEvent[]): GeoBoundingBox | null {
    const geoEvents = events.filter(event => event.location);
    
    if (geoEvents.length === 0) return null;
    
    // Initialize with first location
    const firstLoc = geoEvents[0].location!;
    let north = firstLoc.lat;
    let south = firstLoc.lat;
    let east = firstLoc.lng;
    let west = firstLoc.lng;
    
    // Expand bounding box to include all locations
    for (const event of geoEvents) {
      const loc = event.location!;
      north = Math.max(north, loc.lat);
      south = Math.min(south, loc.lat);
      east = Math.max(east, loc.lng);
      west = Math.min(west, loc.lng);
    }
    
    return { north, south, east, west };
  }
  
  /**
   * Find most frequently mentioned locations
   */
  getTopLocations(events: TimelineEvent[], limit: number = 10): LocationFrequency[] {
    const locationCounts = new Map<string, LocationFrequency>();
    
    for (const event of events) {
      if (!event.location) continue;
      
      const key = `${event.location.lat},${event.location.lng}`;
      
      if (locationCounts.has(key)) {
        locationCounts.get(key)!.count += 1;
      } else {
        locationCounts.set(key, {
          location: event.location,
          count: 1
        });
      }
    }
    
    // Sort by count descending and take top 'limit'
    return Array.from(locationCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  
  /**
   * Generate GeoJSON for mapping
   */
  generateGeoJSON(events: TimelineEvent[]): any {
    const features = [];
    
    for (const event of events) {
      if (!event.location) continue;
      
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [event.location.lng, event.location.lat]
        },
        properties: {
          id: event.id,
          title: event.title,
          platform: event.platform,
          category: event.category,
          timestamp: event.timestamp.toISO(),
          locationName: event.location.name || 'Unknown Location',
          username: event.username,
          url: event.url
        }
      });
    }
    
    return {
      type: 'FeatureCollection',
      features
    };
  }
  
  /**
   * Initialize a simple location database with major cities and countries
   * In a production environment, this would be replaced with a proper geocoding service
   */
  private initializeLocationDatabase(): Map<string, GeoLocation> {
    const db = new Map<string, GeoLocation>();
    
    // Major cities
    const cities = [
      { name: 'new york', lat: 40.7128, lng: -74.0060, country: 'US' },
      { name: 'los angeles', lat: 34.0522, lng: -118.2437, country: 'US' },
      { name: 'chicago', lat: 41.8781, lng: -87.6298, country: 'US' },
      { name: 'houston', lat: 29.7604, lng: -95.3698, country: 'US' },
      { name: 'phoenix', lat: 33.4484, lng: -112.0740, country: 'US' },
      { name: 'philadelphia', lat: 39.9526, lng: -75.1652, country: 'US' },
      { name: 'san antonio', lat: 29.4241, lng: -98.4936, country: 'US' },
      { name: 'san diego', lat: 32.7157, lng: -117.1611, country: 'US' },
      { name: 'dallas', lat: 32.7767, lng: -96.7970, country: 'US' },
      { name: 'san francisco', lat: 37.7749, lng: -122.4194, country: 'US' },
      { name: 'seattle', lat: 47.6062, lng: -122.3321, country: 'US' },
      { name: 'boston', lat: 42.3601, lng: -71.0589, country: 'US' },
      { name: 'atlanta', lat: 33.7490, lng: -84.3880, country: 'US' },
      { name: 'miami', lat: 25.7617, lng: -80.1918, country: 'US' },
      { name: 'london', lat: 51.5074, lng: -0.1278, country: 'GB' },
      { name: 'paris', lat: 48.8566, lng: 2.3522, country: 'FR' },
      { name: 'tokyo', lat: 35.6762, lng: 139.6503, country: 'JP' },
      { name: 'beijing', lat: 39.9042, lng: 116.4074, country: 'CN' },
      { name: 'sydney', lat: -33.8688, lng: 151.2093, country: 'AU' },
      { name: 'rio de janeiro', lat: -22.9068, lng: -43.1729, country: 'BR' },
      { name: 'mexico city', lat: 19.4326, lng: -99.1332, country: 'MX' },
      { name: 'cairo', lat: 30.0444, lng: 31.2357, country: 'EG' },
      { name: 'moscow', lat: 55.7558, lng: 37.6173, country: 'RU' },
      { name: 'berlin', lat: 52.5200, lng: 13.4050, country: 'DE' },
      { name: 'madrid', lat: 40.4168, lng: -3.7038, country: 'ES' },
      { name: 'rome', lat: 41.9028, lng: 12.4964, country: 'IT' },
      { name: 'toronto', lat: 43.6532, lng: -79.3832, country: 'CA' },
      { name: 'mumbai', lat: 19.0760, lng: 72.8777, country: 'IN' },
      { name: 'singapore', lat: 1.3521, lng: 103.8198, country: 'SG' },
      { name: 'dubai', lat: 25.2048, lng: 55.2708, country: 'AE' }
    ];
    
    // Add cities to database
    for (const city of cities) {
      db.set(city.name, {
        lat: city.lat,
        lng: city.lng,
        name: city.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        countryCode: city.country
      });
    }
    
    // Major countries
    const countries = [
      { name: 'united states', lat: 37.0902, lng: -95.7129, code: 'US' },
      { name: 'usa', lat: 37.0902, lng: -95.7129, code: 'US' },
      { name: 'uk', lat: 55.3781, lng: -3.4360, code: 'GB' },
      { name: 'united kingdom', lat: 55.3781, lng: -3.4360, code: 'GB' },
      { name: 'canada', lat: 56.1304, lng: -106.3468, code: 'CA' },
      { name: 'australia', lat: -25.2744, lng: 133.7751, code: 'AU' },
      { name: 'germany', lat: 51.1657, lng: 10.4515, code: 'DE' },
      { name: 'france', lat: 46.2276, lng: 2.2137, code: 'FR' },
      { name: 'italy', lat: 41.8719, lng: 12.5674, code: 'IT' },
      { name: 'spain', lat: 40.4637, lng: -3.7492, code: 'ES' },
      { name: 'japan', lat: 36.2048, lng: 138.2529, code: 'JP' },
      { name: 'china', lat: 35.8617, lng: 104.1954, code: 'CN' },
      { name: 'india', lat: 20.5937, lng: 78.9629, code: 'IN' },
      { name: 'brazil', lat: -14.2350, lng: -51.9253, code: 'BR' },
      { name: 'russia', lat: 61.5240, lng: 105.3188, code: 'RU' },
      { name: 'mexico', lat: 23.6345, lng: -102.5528, code: 'MX' }
    ];
    
    // Add countries to database
    for (const country of countries) {
      db.set(country.name, {
        lat: country.lat,
        lng: country.lng,
        name: country.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        countryCode: country.code
      });
    }
    
    return db;
  }
  
  /**
   * Perform reverse geocoding (coordinates to location name)
   * This is a stub - in a production environment, would call a geocoding service
   */
  private async reverseGeocode(lat: number, lng: number): Promise<GeoLocation | null> {
    // This would use a real geocoding service like Google Maps, OpenStreetMap, etc.
    // For now, we'll just return the coordinates with a generic name
    return {
      lat,
      lng,
      name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    };
  }
}