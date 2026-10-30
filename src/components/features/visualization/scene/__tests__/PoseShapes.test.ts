import { covarianceShape } from '../PoseShapes';
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

test('pose display types default like Foxglove', () => {
  expect(defaultPoseType('pose')).toBe('axis');
  expect(defaultPoseType('posecov')).toBe('axis');
  expect(defaultPoseType('poses')).toBe('arrow');
  expect(defaultPoseType('odometry')).toBe('arrow');
  expect(defaultPoseType('path')).toBe('line');
});
