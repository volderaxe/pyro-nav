import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const origin = 'https://volderaxe.github.io';
const ownerLogin = 'volderaxe';

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createEnv({ limited = false } = {}) {
  const rows = [];
  const sessions = new Map();
  const states = new Map();
  return {
    rows,
    sessions,
    states,
    env: {
      ALLOWED_ORIGINS: origin,
      GITHUB_OAUTH_CLIENT_ID: 'test-client-id',
      PYRONAV_OAUTH_CLIENT_SECRET: 'test-client-secret',
      OWNER_GITHUB_LOGIN: ownerLogin,
      OWNER_APP_URL: `${origin}/pyro-nav/`,
      FEEDBACK_LIMITER: { limit: async () => ({ success: !limited }) },
      DB: {
        prepare(sql) {
          let values = [];
          const query = {
            bind(...bindings) {
              values = bindings;
              return query;
            },
            async run() {
              if (sql.startsWith('INSERT INTO requests')) {
                rows.push({
                  id: values[0],
                  title: values[1],
                  details: values[2],
                  createdAt: '2026-11-04T00:00:00.000Z',
                  status: 'new',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE requests SET status = 'reviewed'")) {
                const row = rows.find((item) => item.id === values[0]);
                if (row) row.status = 'reviewed';
                return { meta: { changes: row ? 1 : 0 } };
              }
              if (sql.startsWith('INSERT INTO owner_sessions')) {
                sessions.set(values[0], values[1]);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('DELETE FROM owner_sessions')) {
                if (sql.includes('expires_at')) {
                  for (const [tokenHash, expiresAt] of sessions) {
                    if (expiresAt <= values[0]) sessions.delete(tokenHash);
                  }
                  return { meta: { changes: 1 } };
                }
                const deleted = sessions.delete(values[0]);
                return { meta: { changes: deleted ? 1 : 0 } };
              }
              if (sql.startsWith('INSERT INTO owner_auth_states')) {
                states.set(values[0], values[1]);
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith('DELETE FROM owner_auth_states WHERE state_hash')) {
                const deleted = states.delete(values[0]);
                return { meta: { changes: deleted ? 1 : 0 } };
              }
              if (sql.startsWith('DELETE FROM owner_auth_states WHERE expires_at')) {
                for (const [stateHash, expiresAt] of states) {
                  if (expiresAt <= values[0]) states.delete(stateHash);
                }
                return { meta: { changes: 1 } };
              }
              throw new Error(`Unexpected SQL: ${sql}`);
            },
            async first() {
              if (sql.includes('FROM owner_sessions')) {
                const expiresAt = sessions.get(values[0]);
                return expiresAt === undefined ? null : { expiresAt };
              }
              if (sql.includes('FROM owner_auth_states')) {
                const expiresAt = states.get(values[0]);
                return expiresAt !== undefined && expiresAt > values[1]
                  ? { state_hash: values[0] }
                  : null;
              }
              throw new Error(`Unexpected SQL: ${sql}`);
            },
            async all() {
              if (sql.includes('FROM requests')) return { results: rows };
              throw new Error(`Unexpected SQL: ${sql}`);
            },
          };
          return query;
        },
      },
    },
  };
}

function makeRequest(path, { method = 'GET', body, headers = {} } = {}) {
  return new Request(`https://feedback.test${path}`, {
    method,
    headers: { Origin: origin, ...headers },
    body,
  });
}

async function addSession(sessions, token = 'a'.repeat(64), expiresAt = Math.floor(Date.now() / 1000) + 3600) {
  sessions.set(await hash(token), expiresAt);
  return token;
}

test('rejects browser requests from an unlisted origin', async () => {
  const { env } = createEnv();
  const response = await worker.fetch(new Request('https://feedback.test/api/requests', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test', details: 'Details' }),
  }), env);
  assert.equal(response.status, 403);
});

test('stores anonymous requests and denies owner tools without an owner session', async () => {
  const { env, rows } = createEnv();
  const request = makeRequest('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ title: 'A feature', details: 'Please add this.' }),
  });
  const created = await worker.fetch(request, env);
  assert.equal(created.status, 201);
  assert.equal(rows[0].title, 'A feature');

  const denied = await worker.fetch(makeRequest('/api/requests'), env);
  assert.equal(denied.status, 401);
  const deniedSession = await worker.fetch(makeRequest('/api/session'), env);
  assert.equal(deniedSession.status, 401);
});

test('allows an owner session to read, review, and sign out', async () => {
  const { env, rows, sessions } = createEnv();
  const token = await addSession(sessions);
  rows.push({
    id: '00000000-0000-4000-8000-000000000001',
    title: 'A feature',
    details: 'Details',
    createdAt: '2026-11-04T00:00:00.000Z',
    status: 'new',
  });
  const headers = { Authorization: `Bearer ${token}` };
  const session = await worker.fetch(makeRequest('/api/session', { headers }), env);
  assert.equal(session.status, 200);
  assert.equal((await session.json()).login, ownerLogin);

  const listed = await worker.fetch(makeRequest('/api/requests', { headers }), env);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).requests[0].id, rows[0].id);

  const reviewed = await worker.fetch(makeRequest(`/api/requests/${rows[0].id}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'reviewed' }),
  }), env);
  assert.equal(reviewed.status, 200);
  assert.equal(rows[0].status, 'reviewed');

  const signedOut = await worker.fetch(makeRequest('/auth/logout', { method: 'POST', headers }), env);
  assert.equal(signedOut.status, 200);
  assert.equal(sessions.size, 0);
  assert.equal((await worker.fetch(makeRequest('/api/requests', { headers }), env)).status, 401);
});

test('creates a one-time GitHub OAuth state and redirects to GitHub', async () => {
  const { env, states } = createEnv();
  const response = await worker.fetch(new Request('https://feedback.test/auth/login', {
    headers: { 'CF-Connecting-IP': '192.0.2.1' },
  }), env);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('Location'));
  assert.equal(location.origin, 'https://github.com');
  assert.equal(location.pathname, '/login/oauth/authorize');
  assert.equal(location.searchParams.get('client_id'), env.GITHUB_OAUTH_CLIENT_ID);
  assert.equal(location.searchParams.get('redirect_uri'), 'https://feedback.test/auth/callback');
  assert.ok(states.size === 1);
  assert.notEqual(states.keys().next().value, location.searchParams.get('state'));
});

test('completes OAuth only for the configured GitHub owner', async () => {
  const { env, sessions, states } = createEnv();
  const state = 'test-state';
  states.set(await hash(state), Math.floor(Date.now() / 1000) + 600);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    if (String(input) === 'https://github.com/login/oauth/access_token') {
      return Response.json({ access_token: 'oauth-access-token' });
    }
    if (String(input) === 'https://api.github.com/user') {
      return Response.json({ login: ownerLogin });
    }
    throw new Error('Unexpected GitHub endpoint');
  };

  try {
    const response = await worker.fetch(new Request(
      `https://feedback.test/auth/callback?code=one-time-code&state=${state}`,
    ), env);
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get('Location'));
    assert.equal(location.origin, origin);
    assert.equal(location.pathname, '/pyro-nav/');
    const token = new URLSearchParams(location.hash.slice(1)).get('owner_session');
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.equal(sessions.size, 1);
    assert.equal(states.size, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('rejects a valid GitHub login for a different account', async () => {
  const { env, sessions, states } = createEnv();
  const state = 'test-state';
  states.set(await hash(state), Math.floor(Date.now() / 1000) + 600);
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => String(input) === 'https://github.com/login/oauth/access_token'
    ? Response.json({ access_token: 'oauth-access-token' })
    : Response.json({ login: 'someone-else' });
  try {
    const response = await worker.fetch(new Request(
      `https://feedback.test/auth/callback?code=one-time-code&state=${state}`,
    ), env);
    assert.equal(response.status, 303);
    assert.match(response.headers.get('Location'), /owner_error=not-owner/);
    assert.equal(sessions.size, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('rejects invalid input and rate-limits submissions', async () => {
  const { env } = createEnv();
  const invalid = await worker.fetch(makeRequest('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ title: ' ', details: 'Details' }),
  }), env);
  assert.equal(invalid.status, 400);

  const limitedEnv = createEnv({ limited: true }).env;
  const limited = await worker.fetch(makeRequest('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ title: 'A feature', details: 'Please add this.' }),
  }), limitedEnv);
  assert.equal(limited.status, 429);
});
