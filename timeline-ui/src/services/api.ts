import axios from 'axios';
import type { User, TimelineEvent } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

interface ScrapeUserRequest {
  platform: 'github' | 'twitter' | 'reddit';
  username: string;
}

interface ScrapeResponse {
  success: boolean;
  message: string;
  user?: User;
  events?: TimelineEvent[];
}

export const api = {
  // Scrape user data from a specific platform
  scrapeUser: async (request: ScrapeUserRequest): Promise<ScrapeResponse> => {
    try {
      const response = await axios.post(`${BASE_URL}/scrape/user`, request);
      return response.data;
    } catch (error) {
      console.error('Error scraping user:', error);
      throw error;
    }
  },

  // Get all scraped users
  getUsers: async (): Promise<User[]> => {
    try {
      const response = await axios.get(`${BASE_URL}/users`);
      return response.data;
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  },

  // Get user events
  getUserEvents: async (userId: string): Promise<TimelineEvent[]> => {
    try {
      const response = await axios.get(`${BASE_URL}/users/${userId}/events`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user events:', error);
      throw error;
    }
  },

  // Search users
  searchUsers: async (query: string): Promise<User[]> => {
    try {
      const response = await axios.get(`${BASE_URL}/users/search`, {
        params: { q: query }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  },

  // Get platform-specific user data
  getPlatformData: async (platform: string, username: string): Promise<any> => {
    try {
      const response = await axios.get(`${BASE_URL}/platforms/${platform}/users/${username}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${platform} data:`, error);
      throw error;
    }
  }
}; 