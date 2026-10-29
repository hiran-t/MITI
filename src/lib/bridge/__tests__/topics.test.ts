import { topicNameError, topicTypeMismatch } from '../topics';

test('invalid ROS topic names are reported', () => {
  expect(topicNameError('')).toBeNull();
  expect(topicNameError('/livox/lidar')).toBeNull();
  expect(topicNameError('/camera/color/image_raw/compressed')).toBeNull();
  expect(topicNameError('/')).not.toBeNull();
  expect(topicNameError('/livox/')).not.toBeNull();
  expect(topicNameError('livox/lidar')).not.toBeNull();
  expect(topicNameError('/a//b')).not.toBeNull();
  expect(topicNameError('/a-b')).not.toBeNull();
  expect(topicNameError('/2d_scan')).not.toBeNull();
});

test('type mismatches use the live topic list and ignore the /msg/ spelling', () => {
  const topics = [{ topic: '/livox/lidar', type: 'sensor_msgs/msg/PointCloud2' }];
  expect(topicTypeMismatch(topics, '/livox/lidar', 'sensor_msgs/msg/LaserScan')).toBe(
    'sensor_msgs/msg/PointCloud2'
  );
  expect(topicTypeMismatch(topics, '/livox/lidar', 'sensor_msgs/PointCloud2')).toBeNull();
  expect(topicTypeMismatch(topics, '/livox/lidar', ['a/B', 'sensor_msgs/PointCloud2'])).toBeNull();
  expect(topicTypeMismatch(topics, '/unknown', 'sensor_msgs/msg/LaserScan')).toBeNull();
});
