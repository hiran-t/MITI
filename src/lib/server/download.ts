import dns from 'dns';
import https from 'https';
import net from 'net';
import type { LookupFunction } from 'net';

/**
 * Downloads a widget package for "Import from URL". Only public https addresses are fetched:
 * the server must not become a way to reach the machines on MITI's own network (the robot, a
 * PLC, the router), so every address a name resolves to is checked when the connection is made,
 * and again for each redirect.
 */

const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 30000;

const ipv4 = (address: string) => address.split('.').map(Number);

/** Whether an IP address is on the public internet, not a private, local or special range. */
export function isPublicAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = ipv4(address);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT, Tailscale
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (net.isIPv6(address)) {
    const lower = address.toLowerCase();
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicAddress(mapped[1]);
    return !(
      lower === '::' ||
      lower === '::1' ||
      /^f[cd]/.test(lower) || // unique local
      /^fe[89ab]/.test(lower) || // link local
      /^ff/.test(lower) // multicast
    );
  }
  return false;
}

/** dns.lookup that refuses names resolving to an address that is not public. */
const publicLookup: LookupFunction = (hostname, options, callback) =>
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, '', 0);
    const list = addresses as dns.LookupAddress[];
    const blocked = list.find((entry) => !isPublicAddress(entry.address));
    if (blocked || !list.length)
      return callback(
        new Error(
          `${hostname} is not on the public internet (${blocked?.address ?? 'no address'})`
        ),
        '',
        0
      );
    if ((options as dns.LookupOptions).all) return callback(null, list as never, 0);
    callback(null, list[0].address, list[0].family);
  });

function get(url: URL, limit: number): Promise<{ redirect?: string; body?: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { lookup: publicLookup, timeout: TIMEOUT_MS }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        return resolve({ redirect: new URL(response.headers.location, url).toString() });
      }
      if (status !== 200) {
        response.resume();
        return reject(new Error(`${url.host} answered HTTP ${status}`));
      }
      if (Number(response.headers['content-length']) > limit) {
        response.destroy();
        return reject(new Error(`The package is larger than ${limit / 1024 / 1024} MB`));
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) {
          response.destroy();
          reject(new Error(`The package is larger than ${limit / 1024 / 1024} MB`));
        } else chunks.push(chunk);
      });
      response.on('end', () => resolve({ body: new Uint8Array(Buffer.concat(chunks)) }));
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error(`${url.host} did not answer in time`)));
    request.on('error', reject);
  });
}

/** The file at a public https URL, following redirects; at most `limit` bytes. */
export async function downloadPackage(address: string, limit: number): Promise<Uint8Array> {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new Error('The address is not a URL');
  }
  for (let redirects = 0; ; redirects += 1) {
    if (url.protocol !== 'https:') throw new Error('Only https addresses can be imported');
    if (url.username || url.password) throw new Error('The address must not hold a password');
    // An address written as an IP is connected to without a lookup, so it is checked here.
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(host) && !isPublicAddress(host))
      throw new Error(`Cannot download: ${host} is not on the public internet`);
    let result: Awaited<ReturnType<typeof get>>;
    try {
      result = await get(url, limit);
    } catch (error) {
      const message = (error as Error).message;
      throw new Error(message.startsWith('The ') ? message : `Cannot download: ${message}`);
    }
    if (result.body) return result.body;
    if (redirects >= MAX_REDIRECTS) throw new Error('Cannot download: too many redirects');
    url = new URL(result.redirect!);
  }
}
