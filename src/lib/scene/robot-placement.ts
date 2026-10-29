import * as THREE from 'three';
import type { URDFRobot } from 'urdf-loader';
import { lookupTransform } from './transforms';
import type { TFTree } from '@/types/tf-messages';

/**
 * Place links like Foxglove: every link with a TF frame is drawn at that frame, so the model
 * follows robot_state_publisher. Links without TF keep the pose from URDF joints (and joint
 * states, when published).
 */
export function placeLinks(
  robot: URDFRobot,
  tree: TFTree,
  fixedFrame: string,
  prefix: string
): { rootMissing: boolean; missingLinks: number } {
  const root = prefix + robot.urdfName;
  let rootMissing = false;
  let missingLinks = 0;
  robot.matrixAutoUpdate = false;
  try {
    robot.matrix.copy(lookupTransform(tree, fixedFrame, root));
  } catch {
    robot.matrix.identity();
    rootMissing = true;
  }
  const relative = new Map<THREE.Object3D, THREE.Matrix4>([[robot, new THREE.Matrix4()]]);
  robot.traverse((object) => {
    if (object === robot || !object.parent) return;
    const parent = relative.get(object.parent);
    const link = object as THREE.Object3D & { isURDFLink?: boolean; isURDFJoint?: boolean };
    if (!parent || !(link.isURDFLink || link.isURDFJoint)) return;
    if (link.isURDFLink) {
      link.matrixAutoUpdate = false;
      try {
        const target = lookupTransform(
          tree,
          root,
          prefix + (link as unknown as URDFRobot).urdfName
        );
        link.matrix.copy(parent.clone().invert().multiply(target));
      } catch {
        link.matrix.identity();
        missingLinks += 1;
      }
    } else link.updateMatrix();
    relative.set(link, parent.clone().multiply(link.matrix));
  });
  robot.updateMatrixWorld(true);
  return { rootMissing, missingLinks };
}
