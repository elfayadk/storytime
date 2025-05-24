import { useEffect, useRef, useState } from 'react';

interface UseInfiniteScrollOptions {
  threshold?: number;
  isLoading?: boolean;
}

export const useInfiniteScroll = (
  onLoadMore: () => void,
  options: UseInfiniteScrollOptions = {}
) => {
  const { threshold = 100, isLoading = false } = options;
  const [shouldLoadMore, setShouldLoadMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleIntersect: IntersectionObserverCallback = (entries) => {
      const [entry] = entries;
      setShouldLoadMore(entry.isIntersecting);
    };

    observerRef.current = new IntersectionObserver(handleIntersect, {
      rootMargin: `${threshold}px`,
    });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [threshold]);

  useEffect(() => {
    const currentTarget = targetRef.current;
    const currentObserver = observerRef.current;

    if (currentTarget && currentObserver) {
      currentObserver.observe(currentTarget);
    }

    return () => {
      if (currentTarget && currentObserver) {
        currentObserver.unobserve(currentTarget);
      }
    };
  }, [targetRef.current]);

  useEffect(() => {
    if (shouldLoadMore && !isLoading) {
      onLoadMore();
    }
  }, [shouldLoadMore, isLoading, onLoadMore]);

  return {
    targetRef,
    isLoading,
  };
};

export default useInfiniteScroll; 