import { lookup } from 'node:dns/promises';

export class UnsafeDownstreamUrlError extends Error {}

const IPV4_PRIVATE_RANGES: Array<[base: string, bits: number]> = [
  ['10.0.0.0', 8], // private
  ['172.16.0.0', 12], // private
  ['192.168.0.0', 16], // private
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, includes the 169.254.169.254 cloud metadata address
  ['0.0.0.0', 8], // "this network"
];

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isIpv4InRange(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (ip.includes(':')) {
    const normalized = ip.toLowerCase();
    // ::1 (loopback), fc00::/7 (unique local), fe80::/10 (link-local)
    return normalized === '::1' || /^f[cd]/.test(normalized) || normalized.startsWith('fe80');
  }
  return IPV4_PRIVATE_RANGES.some(([base, bits]) => isIpv4InRange(ip, base, bits));
}

// Guards against SSRF when a user submits a downstream server URL: resolves
// the hostname via DNS (not a string match — a hostname can be made to
// resolve to an internal address) and rejects private/reserved IPs. Private
// addresses are allowed outside production since our own dev fixture server
// runs on localhost.
export async function assertSafeDownstreamUrl(rawUrl: string): Promise<void> {
  const allowPrivate = process.env.NODE_ENV !== 'production';

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new UnsafeDownstreamUrlError('not a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeDownstreamUrlError('only http/https URLs are allowed');
  }

  if (allowPrivate) {
    return;
  }

  const { address } = await lookup(url.hostname);
  if (isPrivateOrReservedIp(address)) {
    throw new UnsafeDownstreamUrlError(`${url.hostname} resolves to a private/reserved address`);
  }
}
