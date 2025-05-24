import { useState, useCallback } from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

interface CacheConfig {
  /** Cache expiration time in milliseconds */
  expirationTime?: number;
}

export const useDataCache = <T>(config: CacheConfig = {}) => {
  const { expirationTime = 5 * 60 * 1000 } = config; // Default 5 minutes
  const [cache, setCache] = useState<Record<string, CacheItem<T>>>({});

  const set = useCallback((key: string, data: T) => {
    setCache(prev => ({
      ...prev,
      [key]: {
        data,
        timestamp: Date.now()
      }
    }));
  }, []);

  const get = useCallback((key: string): T | null => {
    const item = cache[key];
    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > expirationTime;
    if (isExpired) {
      // Remove expired item
      setCache(prev => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
      return null;
    }

    return item.data;
  }, [cache, expirationTime]);

  const remove = useCallback((key: string) => {
    setCache(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const clear = useCallback(() => {
    setCache({});
  }, []);

  return {
    set,
    get,
    remove,
    clear
  };
}; 