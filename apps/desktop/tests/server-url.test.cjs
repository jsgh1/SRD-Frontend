const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveServerUrl } = require('../server-url.cjs');

test('uses the deployed HTTPS server by default and accepts an explicit safe override', () => {
  assert.equal(resolveServerUrl([], {}), 'https://srd-jsgh1.duckdns.org');
  assert.equal(resolveServerUrl([], { SRD_DESKTOP_SERVER_URL: 'https://srd.example.test:8443' }), 'https://srd.example.test:8443');
  assert.equal(resolveServerUrl(['--server-url=https://intranet.example.test'], {}), 'https://intranet.example.test');
  assert.equal(resolveServerUrl(['--server-url=http://127.0.0.1:8080'], {}), 'http://127.0.0.1:8080');
});

test('rejects nonlocal HTTP, embedded credentials and ambiguous URLs', () => {
  for (const value of [
    'http://srd.example.test', 'http://localhost.evil.test', 'file:///tmp/index.html',
    'https://user:secret@srd.example.test', 'https://srd.example.test/other',
    'https://srd.example.test/?x=1', 'https://srd.example.test/#frag',
  ]) assert.throws(() => resolveServerUrl([`--server-url=${value}`], {}));
  assert.throws(() => resolveServerUrl(['--server-url=https://a.test', '--server-url=https://b.test'], {}));
});
