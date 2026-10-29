import {
  autoFixedFrame,
  normalizeSceneConfig,
  parseParameterName,
  topicLayerType,
} from '../scene-config';
import { DEFAULT_SCENE_CONFIG } from '@/types/scene-config';

test('MITI 2.0 3D Scene props keep their robot, layers and TF settings', () => {
  const config = normalizeSceneConfig({
    mode: 'topic',
    topic: '/robot_description',
    urdfUrl: '',
    meshBaseUrl: 'http://robot:8000',
    packageMapping: {},
    tfTopics: ['/tf'],
    showTF: false,
    fixedFrame: 'odom',
    syncTransforms: true,
    layers: [
      { id: 'a', type: 'pointcloud', topic: '/livox/lidar', enabled: true, size: 0.02 },
      { id: 'b', type: 'scan', topic: '/scan', enabled: false },
    ],
  });
  expect(config.version).toBe(2);
  expect(config.topics['/robot_description']).toMatchObject({
    visible: true,
    type: 'urdf',
    jointStatesTopic: '/joint_states',
    meshBaseUrl: 'http://robot:8000',
  });
  expect(config.topics['/livox/lidar']).toMatchObject({
    visible: true,
    type: 'pointcloud',
    size: 0.02,
  });
  expect(config.topics['/scan']).toMatchObject({ visible: false, type: 'scan' });
  expect(config.frame).toMatchObject({ fixedFrame: 'odom', syncTimestamps: true });
  expect(config.transforms).toMatchObject({ visible: false, tfTopics: ['/tf'] });
  expect(config.layers.map((layer) => layer.type)).toEqual(['grid']);
});

test('URL robot sources become URDF custom layers and empty props get defaults', () => {
  const config = normalizeSceneConfig({ mode: 'url', urdfUrl: 'http://robot/robot.urdf' });
  expect(config.layers.find((layer) => layer.type === 'urdf')).toMatchObject({
    source: 'url',
    url: 'http://robot/robot.urdf',
  });
  expect(normalizeSceneConfig(undefined).frame).toEqual({
    ...DEFAULT_SCENE_CONFIG.frame,
  });
});

test('version 2 configs are completed with defaults and unknown layers dropped', () => {
  const config = normalizeSceneConfig({
    version: 2,
    frame: { displayFrame: 'base_link' },
    layers: [
      { id: 'g', type: 'grid', size: 4 },
      { id: 'x', type: 'unknown' },
    ],
  });
  expect(config.frame).toEqual({ ...DEFAULT_SCENE_CONFIG.frame, displayFrame: 'base_link' });
  expect(config.layers).toHaveLength(1);
  expect(config.layers[0]).toMatchObject({ type: 'grid', size: 4, divisions: 10 });
  expect(config.view).toEqual(DEFAULT_SCENE_CONFIG.view);
});

test('topic types map to scene layers; only robot_description strings are robots', () => {
  expect(topicLayerType('/livox/lidar', 'sensor_msgs/msg/PointCloud2')).toBe('pointcloud');
  expect(topicLayerType('/scan', 'sensor_msgs/LaserScan')).toBe('scan');
  expect(topicLayerType('/robot_description', 'std_msgs/msg/String')).toBe('urdf');
  expect(topicLayerType('/arm/robot_description', 'std_msgs/msg/String')).toBe('urdf');
  expect(topicLayerType('/chatter', 'std_msgs/msg/String')).toBeUndefined();
  expect(topicLayerType('/camera/image_raw', 'sensor_msgs/msg/Image')).toBeUndefined();
});

test('the fixed frame defaults to a world-like TF root', () => {
  expect(autoFixedFrame(['odom', 'map'], ['base_link'], [])).toBe('map');
  expect(autoFixedFrame(['base_footprint'], ['base_link'], [])).toBe('base_footprint');
  expect(autoFixedFrame([], [], ['livox_frame'])).toBe('livox_frame');
  expect(autoFixedFrame([], [], [])).toBeUndefined();
});

test('parameter names split into node and parameter', () => {
  expect(parseParameterName('/robot_state_publisher.robot_description')).toEqual({
    node: '/robot_state_publisher',
    name: 'robot_description',
  });
  expect(parseParameterName('ns/node.group.param')).toEqual({
    node: '/ns/node',
    name: 'group.param',
  });
  expect(parseParameterName('robot_description')).toBeNull();
});
