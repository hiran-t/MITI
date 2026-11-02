import { act, render, screen } from '@testing-library/react';
import type { LinkStats } from '@/lib/bridge/types';
import { LinkStatsRows, LinkStatusItem } from '../LinkStats';

function fakeClient(initial: LinkStats | null) {
  let current = initial;
  const listeners = new Set<(stats: LinkStats | null) => void>();
  return {
    getLinkStats: () => current,
    onLinkStats: (callback: (stats: LinkStats | null) => void) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    report(stats: LinkStats | null) {
      current = stats;
      listeners.forEach((callback) => callback(stats));
    },
  };
}

const stats = (oldestQueuedMs: number): LinkStats => ({
  bytesPerSecond: 1_520_000,
  droppedPerSecond: 3,
  bufferedBytes: 18_000,
  oldestQueuedMs,
  topics: [
    {
      topic: '/camera/image_raw',
      bytesPerSecond: 1_500_000,
      sentPerSecond: 10,
      droppedPerSecond: 3,
    },
  ],
});

test('the status bar shows what miti_bridge sends, and warns when messages wait too long', () => {
  const client = fakeClient(null);
  const { container } = render(<LinkStatusItem client={client} />);
  expect(container).toBeEmptyDOMElement();
  act(() => client.report(stats(40)));
  const item = screen.getByText('1.5 MB/s');
  expect(item).not.toHaveClass('is-behind');
  act(() => client.report(stats(900)));
  expect(screen.getByText('1.5 MB/s')).toHaveClass('is-behind');
  act(() => client.report(null));
  expect(container).toBeEmptyDOMElement();
});

test('the source details list the link and its busiest topics', () => {
  render(
    <dl>
      <LinkStatsRows client={fakeClient(stats(40))} />
    </dl>
  );
  expect(screen.getByText('1.5 MB/s · 3 dropped/s')).toBeInTheDocument();
  expect(screen.getByText('18 KB · oldest 40 ms')).toBeInTheDocument();
  expect(screen.getByTitle('/camera/image_raw')).toBeInTheDocument();
  expect(screen.getByText('1.5 MB/s · 10 msg/s · 3 dropped')).toBeInTheDocument();
});
