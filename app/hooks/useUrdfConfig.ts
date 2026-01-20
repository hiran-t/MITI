'use client';

import { useState, useEffect, useCallback } from 'react';
import type { URDFConfig, URDFMode } from '../types/urdf-config';
import { DEFAULT_URDF_CONFIG } from '../types/urdf-config';

const STORAGE_KEY = 'miti_urdf_config';

/**
 * Get initial URDF config from localStorage or return defaults
 */
function getInitialUrdfConfig(): URDFConfig {
  if (typeof window === 'undefined') {
    return DEFAULT_URDF_CONFIG;
  }

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_URDF_CONFIG;
  }

  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_URDF_CONFIG, ...parsed };
  } catch (error) {
    console.error('Failed to parse URDF config:', error);
    return DEFAULT_URDF_CONFIG;
  }
}

/**
 * Custom hook for managing URDF configuration with localStorage persistence
 */
export function useUrdfConfig() {
  // Use lazy initializer to ensure function is called, not used as state value
  const [config, setConfig] = useState<URDFConfig>(() => getInitialUrdfConfig());

  // Persist config to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
  }, [config]);

  // Update config with a partial update
  const updateConfig = useCallback((updates: Partial<URDFConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Convenience handlers for common updates
  const handlers = {
    setMode: useCallback((mode: URDFMode) => {
      updateConfig({ mode });
    }, [updateConfig]),

    setTopic: useCallback((topic: string) => {
      updateConfig({ topic });
    }, [updateConfig]),

    setUrdfUrl: useCallback((urdfUrl: string) => {
      updateConfig({ urdfUrl });
    }, [updateConfig]),

    setMeshBaseUrl: useCallback((meshBaseUrl: string) => {
      updateConfig({ meshBaseUrl });
    }, [updateConfig]),

    setPackageMapping: useCallback((packageMapping: Record<string, string>) => {
      updateConfig({ packageMapping });
    }, [updateConfig]),
  };

  return {
    config,
    updateConfig,
    ...handlers,
  };
}
