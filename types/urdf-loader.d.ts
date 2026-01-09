declare module 'urdf-loader' {
  import { Object3D, LoadingManager } from 'three';

  interface MeshLoadDoneFunc {
    (mesh: Object3D, err?: Error): void;
  }

  interface MeshLoadFunc {
    (url: string, manager: LoadingManager, onLoad: MeshLoadDoneFunc): void;
  }

  export default class URDFLoader {
    constructor(manager?: LoadingManager);
    packages: string | { [key: string]: string } | ((targetPkg: string) => string);
    loadMeshCb: MeshLoadFunc;
    parse(urdfString: string): Object3D;
    load(
      url: string,
      onLoad: (robot: Object3D) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: Error) => void
    ): void;
  }
}

// URDF Source Types
export type URDFSourceMode = 'topic' | 'url';

export interface URDFTopicSource {
  mode: 'topic';
  topic: string;
}

export interface URDFUrlSource {
  mode: 'url';
  urdfUrl: string;
  meshBaseUrl?: string;
  packageMapping?: Record<string, string>;
}

export type URDFSource = URDFTopicSource | URDFUrlSource;

export interface URDFConfig {
  source: URDFSource;
  // Optional display settings
  displaySettings?: {
    showJoints?: boolean;
    showCollisions?: boolean;
    wireframe?: boolean;
  };
}

export interface URDFLoaderOptions {
  urdfUrl: string;
  meshBaseUrl?: string;
  packageMapping?: Record<string, string>;
}

export interface URDFLoadProgress {
  total: number;
  loaded: number;
  currentFile?: string;
}

export interface URDFLoadError {
  type: 'network' | 'parse' | 'mesh' | 'cors';
  message: string;
  details?: string;
  url?: string;
}
