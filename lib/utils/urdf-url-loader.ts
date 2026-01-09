import * as THREE from 'three';
import { URDFLoaderOptions, URDFLoadError } from '@/types/urdf-loader';
import { resolvePackagePath } from './package-path-resolver';

/**
 * Loads URDF content from a URL
 * 
 * @param options - Loading options including URL and mesh base URL
 * @returns Promise that resolves to the URDF string content
 * @throws URDFLoadError if loading fails
 */
export async function loadURDFFromURL(
  options: URDFLoaderOptions
): Promise<string> {
  const { urdfUrl, meshBaseUrl, packageMapping } = options;

  try {
    console.log('Loading URDF from URL:', urdfUrl);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(urdfUrl, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, text/plain, */*',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error: URDFLoadError = {
        type: 'network',
        message: `Failed to load URDF: ${response.status} ${response.statusText}`,
        details: `URL: ${urdfUrl}`,
        url: urdfUrl,
      };
      throw error;
    }

    const urdfContent = await response.text();
    
    if (!urdfContent || urdfContent.trim().length === 0) {
      const error: URDFLoadError = {
        type: 'parse',
        message: 'URDF file is empty',
        url: urdfUrl,
      };
      throw error;
    }

    console.log('Successfully loaded URDF, size:', urdfContent.length);
    return urdfContent;

  } catch (err: any) {
    // Handle specific error types
    if (err.name === 'AbortError') {
      const error: URDFLoadError = {
        type: 'network',
        message: 'Request timeout after 30 seconds',
        details: 'The server did not respond in time',
        url: urdfUrl,
      };
      throw error;
    }

    if (err.message && err.message.includes('CORS')) {
      const error: URDFLoadError = {
        type: 'cors',
        message: 'CORS error: Cannot access the URL',
        details: 'The server needs to allow cross-origin requests. See documentation for CORS configuration.',
        url: urdfUrl,
      };
      throw error;
    }

    if (err.type) {
      // Already a URDFLoadError
      throw err;
    }

    // Generic network error
    const error: URDFLoadError = {
      type: 'network',
      message: 'Failed to load URDF from URL',
      details: err.message || 'Unknown error occurred',
      url: urdfUrl,
    };
    throw error;
  }
}

/**
 * Creates a custom THREE.LoadingManager for handling mesh paths in URDF
 * 
 * @param baseUrl - Base URL for resolving mesh paths
 * @param packageMapping - Optional mapping of package names to URLs
 * @param onProgress - Optional callback for progress updates
 * @param onError - Optional callback for error handling
 * @returns Configured THREE.LoadingManager
 */
export function createMeshLoadManager(
  baseUrl: string,
  packageMapping?: Record<string, string>,
  onProgress?: (url: string, loaded: number, total: number) => void,
  onError?: (url: string) => void
): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();

  // Track loading progress
  let itemsLoaded = 0;
  let itemsTotal = 0;

  manager.onStart = (url, loaded, total) => {
    itemsLoaded = loaded;
    itemsTotal = total;
    console.log(`Started loading: ${url}. Progress: ${loaded}/${total}`);
  };

  manager.onLoad = () => {
    console.log('All meshes loaded successfully');
  };

  manager.onProgress = (url, loaded, total) => {
    itemsLoaded = loaded;
    itemsTotal = total;
    console.log(`Loading: ${url}. Progress: ${loaded}/${total}`);
    if (onProgress) {
      onProgress(url, loaded, total);
    }
  };

  manager.onError = (url) => {
    console.error(`Error loading: ${url}`);
    if (onError) {
      onError(url);
    }
  };

  // Override URL resolution to handle package:// paths
  const originalResolveURL = manager.resolveURL.bind(manager);
  manager.resolveURL = function(url: string): string {
    // If it's a package:// path, resolve it
    if (url.startsWith('package://')) {
      const resolved = resolvePackagePath(url, baseUrl, packageMapping);
      console.log(`Resolved package path: ${url} -> ${resolved}`);
      return resolved;
    }
    
    // If it's already an absolute URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }

    // If it's a relative path, resolve against base URL
    const resolved = resolvePackagePath(url, baseUrl, packageMapping);
    console.log(`Resolved relative path: ${url} -> ${resolved}`);
    return resolved;
  };

  return manager;
}

/**
 * Validates URDF content
 * 
 * @param urdfContent - URDF XML string
 * @returns true if valid, throws URDFLoadError if invalid
 */
export function validateURDF(urdfContent: string): boolean {
  if (!urdfContent || urdfContent.trim().length === 0) {
    const error: URDFLoadError = {
      type: 'parse',
      message: 'URDF content is empty',
    };
    throw error;
  }

  // Basic XML validation - check if it looks like XML
  const trimmed = urdfContent.trim();
  if (!trimmed.startsWith('<')) {
    const error: URDFLoadError = {
      type: 'parse',
      message: 'URDF content does not appear to be valid XML',
      details: 'Content should start with an XML tag',
    };
    throw error;
  }

  // Check for robot tag
  if (!trimmed.includes('<robot')) {
    const error: URDFLoadError = {
      type: 'parse',
      message: 'URDF does not contain a <robot> tag',
      details: 'Valid URDF files must have a root <robot> element',
    };
    throw error;
  }

  return true;
}

/**
 * Formats a URDFLoadError for display
 */
export function formatURDFError(error: URDFLoadError): string {
  let message = error.message;
  
  if (error.details) {
    message += `\n${error.details}`;
  }
  
  if (error.url) {
    message += `\nURL: ${error.url}`;
  }

  // Add helpful suggestions based on error type
  if (error.type === 'cors') {
    message += '\n\nTo fix CORS issues:\n';
    message += '1. Configure your web server to allow CORS\n';
    message += '2. Use a CORS proxy for development\n';
    message += '3. Host Vizzy on the same domain as your URDF files';
  }

  if (error.type === 'network') {
    message += '\n\nCheck:\n';
    message += '1. The URL is correct and accessible\n';
    message += '2. The server is running\n';
    message += '3. Your network connection';
  }

  return message;
}
