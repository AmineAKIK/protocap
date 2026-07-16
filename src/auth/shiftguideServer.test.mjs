import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.SHIFTGUIDE_ACCESS_CODE = 'atelier-42';
process.env.SHIFTGUIDE_SESSION_SECRET = 'test-session-secret-with-more-than-32-characters';
process.env.SG_MODULES = '[]';
process.env.SG_LEXIQUE = '[]';

const { app } = await import('../../server.mjs');

async function withServer(run) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    await run(origin);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('unlock creates an HttpOnly session that can be checked and logged out', async () => {
  await withServer(async (origin) => {
    const unlock = await fetch(`${origin}/api/shiftguide/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ code: 'atelier-42' }),
    });

    assert.equal(unlock.status, 200);
    const payload = await unlock.json();
    assert.equal(payload.session.idleTimeoutMs > 0, true);

    const setCookie = unlock.headers.get('set-cookie');
    assert.match(setCookie, /shiftguide_session=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(';', 1)[0];

    const session = await fetch(`${origin}/api/shiftguide/session`, {
      headers: { Cookie: cookie },
    });
    assert.equal(session.status, 200);
    assert.equal((await session.json()).ok, true);

    const logout = await fetch(`${origin}/api/shiftguide/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, Origin: origin },
      body: '{}',
    });
    assert.equal(logout.status, 204);
    assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  });
});

test('unlock rejects an untrusted origin and session rejects forged cookies', async () => {
  await withServer(async (origin) => {
    const crossOrigin = await fetch(`${origin}/api/shiftguide/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.invalid' },
      body: JSON.stringify({ code: 'atelier-42' }),
    });
    assert.equal(crossOrigin.status, 403);

    const forged = await fetch(`${origin}/api/shiftguide/session`, {
      headers: { Cookie: 'shiftguide_session=forged.payload' },
    });
    assert.equal(forged.status, 401);
  });
});
