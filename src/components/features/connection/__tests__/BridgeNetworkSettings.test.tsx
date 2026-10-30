import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import BridgeNetworkSettings from '../BridgeNetworkSettings';

const running = {
  available: true,
  domainId: 0,
  peers: [],
  distro: 'jazzy',
  rmw: 'rmw_fastrtps_cpp',
  port: 8765,
  state: 'running',
  exitCode: null,
  log: [],
};

function reply(body: unknown, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
}

describe('BridgeNetworkSettings', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  test('explains where to change it when MITI did not start the bridge', async () => {
    fetchMock.mockReturnValue(reply({ available: false, reason: 'MITI did not start it' }));
    render(<BridgeNetworkSettings />);
    expect(await screen.findByText('MITI did not start it')).toBeInTheDocument();
    expect(screen.queryByLabelText('ROS_DOMAIN_ID')).toBeNull();
  });

  test('applies a new domain and robot address, then follows the restart', async () => {
    fetchMock.mockReturnValueOnce(reply(running));
    render(<BridgeNetworkSettings />);
    const domain = await screen.findByLabelText('ROS_DOMAIN_ID');
    expect(screen.getByText('foxglove_bridge running')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply and restart bridge' })).toBeDisabled();

    fireEvent.change(domain, { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText('Robot IP addresses'), {
      target: { value: '192.168.10.27' },
    });
    fetchMock
      .mockReturnValueOnce(
        reply({ ...running, domainId: 5, peers: ['192.168.10.27'], state: 'starting' })
      )
      .mockReturnValue(reply({ ...running, domainId: 5, peers: ['192.168.10.27'] }));
    jest.useFakeTimers();
    try {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Apply and restart bridge' }));
      });
      const [, init] = fetchMock.mock.calls[1];
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ domainId: '5', peers: '192.168.10.27' });
      expect(screen.getByText('Starting foxglove_bridge…')).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    } finally {
      jest.useRealTimers();
    }
    await waitFor(() => expect(screen.getByText('foxglove_bridge running')).toBeInTheDocument());
  });

  test('shows why the launcher refused the settings', async () => {
    fetchMock
      .mockReturnValueOnce(reply(running))
      .mockReturnValueOnce(reply({ error: 'robot.local is not an IPv4 address' }, 400));
    render(<BridgeNetworkSettings />);
    fireEvent.change(await screen.findByLabelText('Robot IP addresses'), {
      target: { value: 'robot.local' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply and restart bridge' }));
    expect(await screen.findByText('robot.local is not an IPv4 address')).toBeInTheDocument();
  });
});
