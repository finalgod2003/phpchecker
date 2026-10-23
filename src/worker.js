import ipaddr from 'ipaddr.js';
import { reportFromHeaders } from '../public/checker.js';

const TIMEOUT = 10000;
const json = (data, status = 200, headers = {}) => Response.json(data, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
});

export function validateTarget(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\x00-\x20\x7f]/.test(value.trim())) {
    throw new Error('Enter one public website URL, up to 2,048 characters, with no spaces.');
  }
  const address = value.trim();
  let url;
  try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(address) ? address : `https://${address}`); }
  catch { throw new Error('Enter a valid website URL, such as https://example.com.'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS websites are supported.');
  if (url.username || url.password || url.hash) throw new Error('Remove URL credentials and the #fragment before checking.');
  if (url.port) throw new Error('Use the default HTTP or HTTPS port (80 or 443).');
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (host.includes(':') || ipaddr.isValid(host) || !host.includes('.') ||
      /(^|\.)(localhost|local|internal|intranet|home|lan|test|invalid|example|onion|arpa)$/.test(host) ||
      !/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z\d-]{2,63}$/.test(host)) {
    throw new Error('Use a public domain name. IP addresses and private networks are not supported.');
  }
  url.hostname = host;
  return url;
}

export async function requirePublicDNS(host, fetcher, signal) {
  const records = await Promise.all(['A', 'AAAA'].map(async type => {
    const response = await fetcher(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { Accept: 'application/dns-json' }, signal, redirect: 'error',
    });
    if (!response.ok) throw new Error('DNS lookup failed. Try again in a moment.');
    const data = await response.json();
    if (data.Status !== 0) throw new Error('This domain could not be resolved. Check the address and try again.');
    return (data.Answer || []).filter(item => [1, 28].includes(item.type)).map(item => item.data);
  }));
  const addresses = records.flat();
  if (!addresses.length) throw new Error('No public address was found for this domain.');
  if (addresses.some(address => !ipaddr.isValid(address) || ipaddr.parse(address).range() !== 'unicast')) {
    throw new Error('This domain resolves to a private or reserved network and cannot be checked.');
  }
}

export async function checkWebsite(url, fetcher = fetch) {
  const signal = AbortSignal.timeout(TIMEOUT);
  await requirePublicDNS(url.hostname, fetcher, signal);
  const headerValues = [], responses = [];
  for (const method of ['HEAD', 'GET']) {
    const response = await fetcher(url.href, {
      method, redirect: 'manual', signal,
      headers: { 'User-Agent': 'PHPChecker/1.0 (+https://phpchecker.org)', Accept: '*/*' },
    });
    const server = response.headers.get('server') || '';
    const poweredBy = response.headers.get('x-powered-by') || '';
    headerValues.push(server, poweredBy);
    responses.push({ method, status: response.status, server: server.slice(0, 512), x_powered_by: poweredBy.slice(0, 512) });
    await response.body?.cancel();
    if (![405, 501].includes(response.status)) break;
  }
  const last = responses.at(-1);
  return reportFromHeaders(headerValues.join('\n'), {
    mode: 'url', target: url.href, responses,
    redirected: last.status >= 300 && last.status < 400,
    blocked: [401, 403, 429].includes(last.status),
  });
}

async function readBody(request) {
  if (!request.body) throw new Error('Enter a website URL.');
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) { await reader.cancel(); throw new Error('The request is too large. Enter one website URL.'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('Send a valid JSON request with a website URL.'); }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.phpchecker.org') {
      url.hostname = 'phpchecker.org';
      return Response.redirect(url.href, 301);
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (url.pathname !== '/api/check') return json({ error: 'Endpoint not found.' }, 404);
    if (request.method !== 'POST') return json({ error: 'Use POST to check a website.' }, 405, { Allow: 'POST' });
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json({ error: 'Run the checker from this website.' }, 403);
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'Use application/json.' }, 415);
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    if (env.CHECK_LIMITER && !(await env.CHECK_LIMITER.limit({ key: `phpchecker:${ip}` })).success) {
      return json({ error: 'Too many checks. Please wait 60 seconds and try again.' }, 429, { 'Retry-After': '60' });
    }
    let target;
    try { target = validateTarget((await readBody(request)).url); }
    catch (error) { return json({ error: error.message }, 400); }
    try { return json(await checkWebsite(target)); }
    catch (error) {
      const message = ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'The check reached its 10-second timeout. Try again, or enter your PHP version manually.'
        : /domain|DNS|network|address/.test(error.message) ? error.message
          : 'The website could not be reached. Check the URL or enter your PHP version manually.';
      return json({ error: message }, 422);
    }
  },
};
