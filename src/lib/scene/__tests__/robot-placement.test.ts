import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { placeLinks } from '../robot-placement';
import { lookupTransform } from '../transforms';
import type { TFFrame, TFTree } from '@/types/tf-messages';

const URDF = `<robot name="arm">
  <link name="base_link"/><link name="arm_link"/><link name="tool_link"/>
  <joint name="arm_joint" type="revolute">
    <parent link="base_link"/><child link="arm_link"/>
    <origin xyz="0 0 0.1"/><axis xyz="0 0 1"/><limit lower="-3" upper="3" effort="1" velocity="1"/>
  </joint>
  <joint name="tool_joint" type="fixed">
    <parent link="arm_link"/><child link="tool_link"/><origin xyz="0.6 0 0"/>
  </joint>
</robot>`;

const yaw = (angle: number) => ({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) });
const frame = (
  name: string,
  parent: string,
  x: number,
  y: number,
  z: number,
  angle = 0
): TFFrame => ({
  name,
  parent,
  transform: { translation: { x, y, z }, rotation: yaw(angle) },
  timestamp: 0,
  children: [],
  isStatic: true,
});
const tree = (frames: TFFrame[]): TFTree => ({
  frames: new Map(frames.map((f) => [f.name, f])),
  rootFrame: 'odom',
});

/** World pose of a link inside a fixed-frame scene root. */
function worldOf(robot: THREE.Object3D, name: string) {
  const scene = new THREE.Group();
  scene.add(robot);
  scene.updateMatrixWorld(true);
  return robot.getObjectByName(name)!.matrixWorld;
}

function expectMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4) {
  actual.elements.forEach((value, index) => expect(value).toBeCloseTo(expected.elements[index], 6));
}

test('every link with a TF frame is drawn at that frame, like Foxglove', () => {
  const robot = new URDFLoader().parse(URDF);
  const t = tree([
    frame('base_link', 'odom', 1, 2, 0, Math.PI / 2),
    frame('arm_link', 'base_link', 0, 0, 0.1, Math.PI / 6),
    frame('tool_link', 'arm_link', 0.6, 0, 0),
  ]);
  expect(placeLinks(robot, t, 'odom', '')).toEqual({ rootMissing: false, missingLinks: 0 });
  for (const link of ['base_link', 'arm_link', 'tool_link'])
    expectMatrix(worldOf(robot, link), lookupTransform(t, 'odom', link));
});

test('links without TF follow the URDF joints and joint states', () => {
  const robot = new URDFLoader().parse(URDF);
  robot.setJointValues({ arm_joint: 0.5 });
  const t = tree([frame('base_link', 'odom', 1, 2, 0)]);
  expect(placeLinks(robot, t, 'odom', '')).toEqual({ rootMissing: false, missingLinks: 2 });
  const expected = lookupTransform(t, 'odom', 'base_link')
    .multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.1))
    .multiply(new THREE.Matrix4().makeRotationZ(0.5));
  expectMatrix(worldOf(robot, 'arm_link'), expected);
  expectMatrix(
    worldOf(robot, 'tool_link'),
    expected.clone().multiply(new THREE.Matrix4().makeTranslation(0.6, 0, 0))
  );
});

test('a robot whose root has no transform is drawn at the fixed frame origin', () => {
  const robot = new URDFLoader().parse(URDF);
  expect(placeLinks(robot, tree([]), 'map', 'robot1/')).toEqual({
    rootMissing: true,
    missingLinks: 2,
  });
  expectMatrix(worldOf(robot, 'base_link'), new THREE.Matrix4());
});

test('manual control poses links from URDF joints even where TF exists', () => {
  const robot = new URDFLoader().parse(URDF);
  robot.setJointValues({ arm_joint: Math.PI / 2 });
  const t = tree([
    frame('base_link', 'odom', 1, 0, 0),
    // TF says the arm is unrotated; manual control must ignore it.
    frame('arm_link', 'base_link', 0, 0, 0.1),
    frame('tool_link', 'arm_link', 0.6, 0, 0),
  ]);
  expect(placeLinks(robot, t, 'odom', '', false)).toEqual({
    rootMissing: false,
    missingLinks: 0,
  });
  const tool = new THREE.Vector3().setFromMatrixPosition(worldOf(robot, 'tool_link'));
  expect(tool.x).toBeCloseTo(1);
  expect(tool.y).toBeCloseTo(0.6);
  expect(tool.z).toBeCloseTo(0.1);
});
