'use client';
import { createContext, useContext } from 'react';
import type { MeshLoadOptions, ResourceSources } from '@/lib/scene/mesh-loader';

/** Scene-wide display settings that individual layers read, provided inside the canvas. */
export interface SceneDisplay {
  labelScale: number;
  mesh: MeshLoadOptions;
  fetchAsset?: ResourceSources['fetchAsset'];
}

export const SceneDisplayContext = createContext<SceneDisplay>({
  labelScale: 1,
  mesh: { ignoreColladaUpAxis: false, meshUpAxis: 'z_up' },
});

export const useSceneDisplay = () => useContext(SceneDisplayContext);
