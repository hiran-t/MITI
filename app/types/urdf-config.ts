/**
 * URDF Configuration types
 */

export type URDFMode = 'topic' | 'url';

export interface URDFConfig {
  mode: URDFMode;
  topic: string;
  urdfUrl: string;
  meshBaseUrl: string;
  packageMapping: Record<string, string>;
}

export const DEFAULT_URDF_CONFIG: URDFConfig = {
  mode: 'topic',
  topic: '/robot_description',
  urdfUrl: '',
  meshBaseUrl: '',
  packageMapping: {},
};
