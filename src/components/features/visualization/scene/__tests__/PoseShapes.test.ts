import * as THREE from 'three';
import { AXIS_COLORS, axesCapacity, covarianceShape, writeAxes } from '../PoseShapes';
import { defaultPoseType } from '../SceneLayer';

const covariance = (xx: number, xy: number, yy: number, zz: number) => {
  const c = new Array(36).fill(0);
  c[0] = xx;
  c[1] = c[6] = xy;
  c[7] = yy;
  c[14] = zz;
  return c;
};

test('covariance ellipsoid radii are standard deviations along the principal axes', () => {
  const axisAligned = covarianceShape(covariance(4, 0, 1, 0.25))!;
  expect(axisAligned.radii).toEqual([2, 1, 0.5]);
  expect(axisAligned.yaw).toBeCloseTo(0);
  const diagonal = covarianceShape(covariance(1, 0.5, 1, 0))!;
  expect(diagonal.yaw).toBeCloseTo(Math.PI / 4);
  expect(diagonal.radii[0]).toBeCloseTo(Math.sqrt(1.5));
  expect(diagonal.radii[1]).toBeCloseTo(Math.sqrt(0.5));
  expect(diagonal.radii[2]).toBeGreaterThan(0);
  expect(covarianceShape([1, 2, 3])).toBeNull();
});

test('pose display types default to axes, arrows and a line', () => {
  expect(defaultPoseType('pose')).toBe('axis');
  expect(defaultPoseType('posecov')).toBe('axis');
  expect(defaultPoseType('poses')).toBe('arrow');
  expect(defaultPoseType('odometry')).toBe('arrow');
  expect(defaultPoseType('path')).toBe('line');
});

test('axes are three instances per pose along the pose X, Y and Z', () => {
  const mesh = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(1, 1, 1).translate(0, 0.5, 0),
    undefined,
    axesCapacity(2)
  );
  const yawed = new THREE.Matrix4()
    .makeRotationZ(Math.PI / 2)
    .setPosition(new THREE.Vector3(1, 2, 3));
  writeAxes(mesh, [new THREE.Matrix4(), yawed], 0.5);
  expect(mesh.count).toBe(6);
  const tip = (index: number) => {
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(index, m);
    return new THREE.Vector3(0, 1, 0).applyMatrix4(m).toArray();
  };
  const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]));
  close(tip(0), [0.5, 0, 0]);
  close(tip(1), [0, 0.5, 0]);
  close(tip(2), [0, 0, 0.5]);
  // The second pose is turned 90° about Z: its X axis points along the fixed frame's +Y.
  close(tip(3), [1, 2.5, 3]);
  close(tip(4), [0.5, 2, 3]);
  close(tip(5), [1, 2, 3.5]);
  // Thickness follows the length.
  const shaft = new THREE.Matrix4();
  mesh.getMatrixAt(2, shaft);
  close(new THREE.Vector3(1, 0, 0).applyMatrix4(shaft).toArray(), [0.02, 0, 0]);
  const color = new THREE.Color();
  AXIS_COLORS.forEach((hex, axis) => {
    mesh.getColorAt(3 + axis, color);
    expect(color.getHexString()).toBe(hex.slice(1));
  });
  expect(mesh.boundingSphere!.containsPoint(new THREE.Vector3(1, 2.5, 3))).toBe(true);
});

test('axes capacity grows in steps so a changing frame count rarely rebuilds the mesh', () => {
  expect(axesCapacity(0)).toBe(4);
  expect(axesCapacity(1)).toBe(4);
  expect(axesCapacity(40)).toBe(128);
  expect(axesCapacity(42)).toBe(128);
  expect(axesCapacity(43)).toBe(256);
});
