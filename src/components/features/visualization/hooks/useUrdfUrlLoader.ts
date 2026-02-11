'use client';

import { useState, useCallback, useMemo } from 'react';
import { loadURDFFromURL, formatURDFError } from '@/lib/parsers/urdf-parser/urdf-url-loader';
import type { URDFLoadError } from '@/types/urdf-loader';

const STORAGE_KEY_RECENT_URLS = 'miti_urdf_recent';
const MAX_RECENT_URLS = 5;

interface UseUrdfUrlLoaderOptions {
  urdfUrl: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
}

/**
 * Custom hook for loading URDF from URL with error handling and recent URLs tracking
 */
export function useUrdfUrlLoader() {
  const [urdfContent, setUrdfContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<{ loaded: number; total: number } | null>(null);

  const loadFromUrl = useCallback(async (options: UseUrdfUrlLoaderOptions) => {
    const { urdfUrl, meshBaseUrl, packageMapping } = options;

    if (!urdfUrl) {
      setError('Please enter a URDF URL');
      return;
    }

    setLoading(true);
    setError(null);
    setUrdfContent(null);
    setLoadProgress(null);

    try {
      const content = await loadURDFFromURL({
        urdfUrl,
        meshBaseUrl,
        packageMapping,
      });

      setUrdfContent(content);
      setLoading(false);

      // Save to recent URLs
      saveRecentUrl(urdfUrl);
    } catch (err: any) {
      console.error('Failed to load URDF from URL:', err);
      const errorMsg = err.type ? formatURDFError(err) : err.message || 'Failed to load URDF';
      setError(errorMsg);
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUrdfContent(null);
    setError(null);
    setLoading(false);
    setLoadProgress(null);
  }, []);

  // Memoize the return object to prevent unnecessary re-renders
  // Only recreate when the actual values change, not on every render
  return useMemo(
    () => ({
      urdfContent,
      loading,
      error,
      loadProgress,
      setLoadProgress,
      loadFromUrl,
      reset,
    }),
    [urdfContent, loading, error, loadProgress, setLoadProgress, loadFromUrl, reset]
  );
}

/**
 * Save URL to recent URLs list in localStorage
 */
function saveRecentUrl(url: string): void {
  if (typeof window === 'undefined') return;

  try {
    const storedRecent = localStorage.getItem(STORAGE_KEY_RECENT_URLS);
    const recent = storedRecent ? JSON.parse(storedRecent) : [];

    if (Array.isArray(recent)) {
      const updated = [url, ...recent.filter((u: string) => u !== url)].slice(0, MAX_RECENT_URLS);
      localStorage.setItem(STORAGE_KEY_RECENT_URLS, JSON.stringify(updated));
    } else {
      localStorage.setItem(STORAGE_KEY_RECENT_URLS, JSON.stringify([url]));
    }
  } catch (e) {
    console.error('Failed to save recent URLs:', e);
  }
}
