import { fireEvent, render, screen } from '@testing-library/react';
import ImageTopicSelect, { imageTopics } from '../ImageTopicSelect';

const topics = [
  { topic: '/scene_camera/depth', type: 'sensor_msgs/msg/Image' },
  { topic: '/scene_camera/color', type: 'sensor_msgs/msg/Image' },
  { topic: '/wrist/image/compressed', type: 'sensor_msgs/CompressedImage' },
  { topic: '/scene_camera/camera_info', type: 'sensor_msgs/msg/CameraInfo' },
  { topic: '/livox/lidar', type: 'sensor_msgs/msg/PointCloud2' },
];

function setup(value: string) {
  const onChange = jest.fn();
  render(<ImageTopicSelect value={value} topics={topics} onChange={onChange} />);
  const select = screen.getByRole('combobox', { name: 'Image topic' });
  const options = Array.from((select as HTMLSelectElement).options).map((o) => o.textContent);
  return { onChange, select, options };
}

test('lists the image topics the robot publishes, by name', () => {
  expect(imageTopics(topics)).toEqual([
    '/scene_camera/color',
    '/scene_camera/depth',
    '/wrist/image/compressed',
  ]);
  const { options } = setup('/scene_camera/color');
  expect(options).toEqual([
    '/scene_camera/color',
    '/scene_camera/depth',
    '/wrist/image/compressed',
  ]);
});

test('choosing a topic shows it, without typing its name', () => {
  const { onChange, select } = setup('/scene_camera/color');
  fireEvent.change(select, { target: { value: '/scene_camera/depth' } });
  expect(onChange).toHaveBeenCalledWith('/scene_camera/depth');
});

test('keeps a topic the robot does not publish, marked', () => {
  const { options, select } = setup('/camera/color/image_raw');
  expect(options[0]).toBe('/camera/color/image_raw (not published)');
  expect((select as HTMLSelectElement).value).toBe('/camera/color/image_raw');
});
