import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createServerApp } from '../server/app.mjs';

test('SPA routes fall back to index while missing asset-like paths return 404', async () => {
  const distDir = await mkdtemp(join(tmpdir(), 'protocap-static-'));
  await writeFile(join(distDir, 'index.html'), '<!doctype html><title>ProtoCap test shell</title>');

  const { app } = createServerApp({
    distDir,
    logger: { error() {} },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const spaRoute = await fetch(`${baseUrl}/shiftguide/celine`);
    assert.equal(spaRoute.status, 200);
    assert.match(await spaRoute.text(), /ProtoCap test shell/);

    const missingAsset = await fetch(`${baseUrl}/missing-preview.png`);
    assert.equal(missingAsset.status, 404);
    assert.equal(await missingAsset.text(), 'Asset introuvable.');
  } finally {
    server.close();
    await once(server, 'close');
    await rm(distDir, { recursive: true, force: true });
  }
});
