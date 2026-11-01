/** @jest-environment node */
import { downloadPackage, isPublicAddress } from '../download';

test.each([
  ['8.8.8.8', true],
  ['140.82.112.3', true],
  ['2606:4700::1111', true],
  ['10.1.2.3', false],
  ['127.0.0.1', false],
  ['100.99.81.13', false], // Tailscale
  ['169.254.169.254', false], // cloud metadata
  ['172.16.0.1', false],
  ['172.31.255.255', false],
  ['172.32.0.1', true],
  ['192.168.10.27', false],
  ['0.0.0.0', false],
  ['224.0.0.1', false],
  ['::1', false],
  ['::', false],
  ['fd00::1', false],
  ['fe80::1', false],
  ['::ffff:192.168.1.1', false],
  ['::ffff:8.8.8.8', true],
  ['not an ip', false],
])('%s is public: %s', (address, expected) => {
  expect(isPublicAddress(address)).toBe(expected);
});

test.each([
  ['nonsense', 'not a URL'],
  ['http://example.com/w.miti-widget', 'Only https'],
  ['https://user:pass@example.com/w.miti-widget', 'must not hold a password'],
  ['https://10.0.0.5/w.miti-widget', '10.0.0.5 is not on the public internet'],
  ['https://[::1]/w.miti-widget', '::1 is not on the public internet'],
  ['https://localhost/w.miti-widget', 'localhost is not on the public internet'],
])('refuses %s', async (address, message) => {
  await expect(downloadPackage(address, 1024)).rejects.toThrow(message);
});
