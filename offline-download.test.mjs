import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const worker = readFileSync(new URL('./service-worker.js', import.meta.url), 'utf8');

test('offline prompt uses the active cache version and does not download until requested', () => {
  const version = worker.match(/const CACHE_NAME = '([^']+)'/)[1];
  assert.ok(html.includes(`names.includes('${version}')`));
  assert.ok(html.includes("id=\"downloadOfflineButton\""));
  assert.ok(html.includes('Not now'));
  assert.ok(html.includes('Online reading remains available without downloading'));
  assert.ok(html.includes("confirmDownload.addEventListener('click', () => installForPlatform('offline'))"));
});

for (const failed of [false, true]) {
  test(`offline completion ${failed ? 'fails explicitly when required files cannot download' : 'verifies required shell files before reporting success'}`, async () => {
    const handlers = {};
    let requiredDownload = false;
    let reply;
    let completion;
    vm.runInNewContext(worker, {
      URL,
      self: {
        location: { origin: 'https://reader.example' },
        registration: { scope: 'https://reader.example/' },
        addEventListener(type, callback) { handlers[type] = callback; }
      },
      caches: {
        open: async () => ({
          async addAll(urls) {
            assert.ok(urls.some(url => url.endsWith('/kjv-scripture.js')));
            assert.ok(urls.some(url => url.endsWith('/reading-progress.js')));
            if (failed) throw new Error('Download unavailable');
            requiredDownload = true;
          },
          keys: async () => []
        })
      },
      console: { error() {} }
    });
    handlers.message({
      data: { type: 'PREPARE_OFFLINE', urls: [] },
      ports: [{ postMessage(value) { reply = value; } }],
      waitUntil(promise) { completion = promise; }
    });
    await completion;
    assert.equal(reply.success, !failed);
    assert.equal(requiredDownload, !failed);
    if (failed) assert.match(reply.error, /could not be downloaded/);
  });
}
