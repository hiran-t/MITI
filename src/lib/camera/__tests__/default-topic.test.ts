import { publishedCameraTopic } from '../default-topic';

const image = (topic: string) => ({ topic, type: 'sensor_msgs/msg/Image' });
const realsense = [
  image('/manipulation_camera/color/image_raw'),
  image('/camera/camera/color/image_raw'),
  image('/camera/camera/aligned_depth_to_color/image_raw'),
  { topic: '/camera/camera/color/camera_info', type: 'sensor_msgs/msg/CameraInfo' },
  { topic: '/rosout', type: 'rcl_interfaces/msg/Log' },
];

describe('publishedCameraTopic', () => {
  test('moves default panels to the robot’s camera topics', () => {
    expect(publishedCameraTopic('/camera/color/image_raw', realsense)).toBe(
      '/camera/camera/color/image_raw'
    );
    expect(publishedCameraTopic('/camera/depth/image_raw', realsense)).toBe(
      '/camera/camera/aligned_depth_to_color/image_raw'
    );
  });

  test('prefers a raw image, then a compressed one', () => {
    expect(
      publishedCameraTopic('/camera/color/image_raw', [
        { topic: '/cam/color/image_raw/compressed', type: 'sensor_msgs/msg/CompressedImage' },
        image('/cam/color/image_raw'),
      ])
    ).toBe('/cam/color/image_raw');
  });

  test('keeps topics the user chose, topics that are published, and unmatched ones', () => {
    expect(publishedCameraTopic('/front/image', realsense)).toBeUndefined();
    expect(
      publishedCameraTopic('/camera/color/image_raw', [
        image('/camera/color/image_raw'),
        ...realsense,
      ])
    ).toBeUndefined();
    expect(publishedCameraTopic('/camera/ir/image_raw', realsense)).toBeUndefined();
    expect(publishedCameraTopic('/camera/color/image_raw', [])).toBeUndefined();
  });
});
