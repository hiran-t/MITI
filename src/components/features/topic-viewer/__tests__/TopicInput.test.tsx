import { fireEvent, render, screen } from '@testing-library/react';
import TopicInput from '../TopicInput';

const topics = [
  { topic: '/livox/lidar', type: 'sensor_msgs/msg/PointCloud2' },
  { topic: '/scan', type: 'sensor_msgs/msg/LaserScan' },
];

function setup(value = '') {
  const onCommit = jest.fn();
  render(
    <TopicInput
      aria-label="Topic"
      value={value}
      onCommit={onCommit}
      topics={topics}
      messageType="sensor_msgs/msg/LaserScan"
    />
  );
  return { onCommit, input: screen.getByRole('combobox', { name: 'Topic' }) };
}

test('typing does not commit until Enter or blur', () => {
  const { onCommit, input } = setup();
  for (const partial of ['/', '/l', '/li', '/livox/', '/livox/scan'])
    fireEvent.change(input, { target: { value: partial } });
  expect(onCommit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onCommit).toHaveBeenCalledWith('/livox/scan');
  fireEvent.change(input, { target: { value: '/other' } });
  fireEvent.blur(input);
  expect(onCommit).toHaveBeenLastCalledWith('/other');
});

test('choosing a suggestion commits immediately', () => {
  const { onCommit, input } = setup();
  fireEvent.change(input, { target: { value: '/scan' } });
  expect(onCommit).toHaveBeenCalledWith('/scan');
});

test('invalid names are not committed and explain why', () => {
  const { onCommit, input } = setup('/scan');
  fireEvent.change(input, { target: { value: '/livox/' } });
  fireEvent.blur(input);
  expect(onCommit).not.toHaveBeenCalled();
  expect(screen.getByText('Topic names cannot end with /')).toBeInTheDocument();
});

test('Escape restores the committed topic', () => {
  const { onCommit, input } = setup('/scan');
  fireEvent.change(input, { target: { value: '/sc' } });
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(input).toHaveValue('/scan');
  fireEvent.blur(input);
  expect(onCommit).not.toHaveBeenCalled();
});

test('suggestions are filtered by type and a mismatched topic is flagged', () => {
  const onCommit = jest.fn();
  const { container } = render(
    <TopicInput
      value="/livox/lidar"
      onCommit={onCommit}
      topics={topics}
      messageType="sensor_msgs/msg/LaserScan"
    />
  );
  const options = Array.from(container.querySelectorAll('option')).map((o) => o.value);
  expect(options).toEqual(['/scan']);
  expect(screen.getByText(/publishes sensor_msgs\/msg\/PointCloud2/)).toBeInTheDocument();
});
