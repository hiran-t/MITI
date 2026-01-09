declare module 'urdf-loader' {
  import { Object3D, LoadingManager } from 'three';

  export default class URDFLoader {
    constructor(manager?: LoadingManager);
    packages: Record<string, string>;
    parse(urdfString: string): Object3D;
    load(
      url: string,
      onLoad: (robot: Object3D) => void,
      onProgress?: (event: ProgressEvent) => void,
      onError?: (error: Error) => void
    ): void;
  }
}
