import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { versionStatus, reportFromHeaders } from '../public/checker.js';
import worker, { validateTarget, requirePublicDNS, checkWebsite } from '../src/worker.js';

test('classification matches explicit upstream patch boundaries and unknown cases', () => {
  const cases = [
    ['8.2.34', 'potentially_vulnerable'], ['8.2.35', 'ok'],
    ['8.3.35', 'potentially_vulnerable'], ['8.3.36', 'ok'],
    ['8.4.26', 'potentially_vulnerable'], ['8.4.27', 'ok'],
    ['8.5.11', 'potentially_vulnerable'], ['8.5.12', 'ok'],
    ['8.1.99', 'potentially_vulnerable'], ['7.4.33', 'potentially_vulnerable'],
    ['8.4.27-1ubuntu1', 'ok'], ['8.4.27RC1', 'unknown'],
    ['8.4.27-rc1', 'unknown'], ['8.6.0', 'unknown'], ['8.4', 'unknown'],
  ];
  for (const [version, expected] of cases) assert.equal(versionStatus(version), expected, version);
});

test('web adapter preserves the actual upstream classifier', async () => {
  const original = await readFile(new URL('../vendor/phpcheck.cjs', import.meta.url), 'utf8');
  const code = original.slice(original.indexOf('const FIXED_IN'), original.indexOf('async function urlHeaders'));
  const upstream = vm.runInNewContext(`${code}; versionStatus;`);
  for (const version of ['8.2.34', '8.2.35', '8.3.36', '8.4.27', '8.5.12', '8.1.99', '5.6.40', '8.4.27~beta1', '9.0.0']) {
    assert.equal(versionStatus(version), upstream(version));
  }
});

test('missing and conflicting headers never overstate the outcome', () => {
  assert.equal(reportFromHeaders('nginx\nExpress').php_version, null);
  assert.equal(reportFromHeaders('PHP/8.4.27\nApache PHP/8.4.26').patch_status, 'potentially_vulnerable');
  assert.equal(reportFromHeaders('PHP/8.4.26\nPHP/8.4.27').php_version, '8.4.26');
  assert.equal(reportFromHeaders('PHP/9.0.0\nPHP/8.4.27').patch_status, 'unknown');
  assert.equal(reportFromHeaders('PHP/8.4.27\nPHP/9.0.0').patch_status, 'unknown');
});

test('URL validation accepts public hostnames and rejects private, credential, and protocol tricks', () => {
  assert.equal(validateTarget('example.com').href, 'https://example.com/');
  assert.equal(validateTarget('https://Example.com:443/path?a=1').href, 'https://example.com/path?a=1');
  for (const value of ['http://127.0.0.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]', 'https://localhost', 'http://printer.local', 'file:///etc/passwd', 'https://user:secret@example.com', 'https://example.com:8080', 'https://example.com/#secret', 'https://example.com/a b']) {
    assert.throws(() => validateTarget(value), undefined, value);
  }
});

function dnsResponse(address = '93.184.216.34') {
  return Response.json({ Status: 0, Answer: [{ type: 1, data: address }] });
}

test('DNS validation rejects private and reserved answers before a website request', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '2001:db8::1']) {
    await assert.rejects(requirePublicDNS('example.com', async () => dnsResponse(address), AbortSignal.timeout(1000)), /private|reserved/);
  }
  await requirePublicDNS('example.com', async () => dnsResponse(), AbortSignal.timeout(1000));
});

test('HEAD 405 falls back to GET, cancels bodies, and does not forward credentials', async () => {
  const methods = [];
  let cancelled = 0;
  const report = await checkWebsite(new URL('https://example.com'), async (address, options) => {
    if (address.startsWith('https://cloudflare-dns.com/')) return dnsResponse();
    methods.push(options.method);
    assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Cookie, undefined);
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), {
      status: options.method === 'HEAD' ? 405 : 200,
      headers: options.method === 'GET' ? { 'X-Powered-By': 'PHP/8.4.27' } : {},
    });
  });
  assert.deepEqual(methods, ['HEAD', 'GET']);
  assert.equal(cancelled, 2);
  assert.equal(report.patch_status, 'ok');
  assert.equal(report.responses.length, 2);
});

test('redirect is reported without following its destination or making GET requests', async () => {
  let requests = 0;
  const report = await checkWebsite(new URL('https://example.com'), async (address, options) => {
    if (address.startsWith('https://cloudflare-dns.com/')) return dnsResponse();
    requests++;
    assert.equal(options.method, 'HEAD');
    return new Response(null, { status: 301, headers: { Location: 'http://127.0.0.1/' } });
  });
  assert.equal(requests, 1);
  assert.equal(report.redirected, true);
  assert.equal(report.patch_status, 'unknown');
});

test('API rejects cross-origin, malformed, oversized and rate-limited requests', async () => {
  const request = (body, headers = {}) => new Request('https://phpchecker.org/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  assert.equal((await worker.fetch(request('{}', { Origin: 'https://other.example' }), {})).status, 403);
  assert.equal((await worker.fetch(request('not json'), {})).status, 400);
  assert.equal((await worker.fetch(request('x'.repeat(5000)), {})).status, 400);
  assert.equal((await worker.fetch(request('{"url":"http://127.0.0.1"}'), {})).status, 400);
  const limited = await worker.fetch(request('{}'), { CHECK_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('Retry-After'), '60');
});
