import {
  calibrationTopicOf,
  DEFAULT_CAMERA_MAX_FPS,
  defaultCalibrationTopic,
  normalizeImageConfig,
} from '../image-config';

test('MITI 3.0 camera props keep their topic; an unset Max FPS takes the new default', () => {
  const config = normalizeImageConfig({ topic: '/camera/camera/color/image_raw' });
  expect(config.version).toBe(2);
  expect(config.topic).toBe('/camera/camera/color/image_raw');
  expect(config.maxFps).toBe(DEFAULT_CAMERA_MAX_FPS);
  expect(config.maxFps).toBe(15);
  expect(config.rectify).toBe(false);
  expect(config.rotation).toBe(0);
  expect(config.topics).toEqual({});
});

test('a Max FPS the user chose is kept, including every frame', () => {
  expect(normalizeImageConfig({ topic: '/a', maxFps: 5 }).maxFps).toBe(5);
  expect(normalizeImageConfig({ topic: '/a', maxFps: 0 }).maxFps).toBe(0);
});

test('saved image panels round-trip; invalid values fall back', () => {
  const saved = normalizeImageConfig({
    topic: '/a',
    rotation: 270,
    flipHorizontal: true,
    colorMode: 'colormap',
    colorMap: 'rainbow',
    valueMax: 4000,
    calibrationTopic: '',
    topics: { '/livox/lidar': { visible: true, type: 'pointcloud' } },
  });
  expect(normalizeImageConfig(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  expect(saved.calibrationTopic).toBe('');
  const broken = normalizeImageConfig({
    topic: '/a',
    rotation: 45,
    gradient: ['#fff'],
    maxFps: -1,
  });
  expect(broken.rotation).toBe(0);
  expect(broken.gradient).toEqual(['#000000', '#ffffff']);
  expect(broken.maxFps).toBe(15);
  expect(normalizeImageConfig(null, '/fallback').topic).toBe('/fallback');
});

test('calibration follows the image topic until set', () => {
  expect(defaultCalibrationTopic('/camera/camera/color/image_raw')).toBe(
    '/camera/camera/color/camera_info'
  );
  expect(defaultCalibrationTopic('/camera/color/image_raw/compressed')).toBe(
    '/camera/color/camera_info'
  );
  expect(calibrationTopicOf(normalizeImageConfig({ topic: '/cam/image' }))).toBe(
    '/cam/camera_info'
  );
  expect(
    calibrationTopicOf(normalizeImageConfig({ topic: '/cam/image', calibrationTopic: '' }))
  ).toBe('');
});
