import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const origin = 'https://volderaxe.github.io';

function createEnv({ limited = false } = {}) {
  const rows = [];
  return {
    rows,
    env: {
      ALLOWED_ORIGINS: origin,
      ADMIN_TOKEN: 'test-admin-token',
      FEEDBACK_LIMITER: { limit: async () => ({ success: !limited }) },
      DB: {
        prepare(sql) {
          return {
            values: [],
            bind(...values) {
              this.values = values;
              return this;
            },
            async run() {
              if (sql.startsWith('INSERT INTO requests')) {
                rows.push({
                  id: this.values[0],
                  title: this.values[1],
                  details: this.values[2],
                  createdAt: '2026-11-04T00:00:00.000Z',
                  status: 'new',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("UPDATE requests SET status = 'reviewed'")) {
                const row = rows.find((item) => item.id === this.values[0]);
                if (row) row.status = 'reviewed';
                return { meta: { changes: row ? 1 : 0 } };
              }
              throw new Error(`Unexpected SQL: ${sql}`);
            },
            async all() {
              return { results: rows };
            },
          };
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

test('rejects browser requests from an unlisted origin', async () => {
  const { env } = createEnv();
  const response = await worker.fetch(new Request('https://feedback.test/api/requests', {
    method: 'POST',
    headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test', details: 'Details' }),
  }), env);
  assert.equal(response.status, 403);
});

test('stores a valid anonymous request and lists it only for the owner', async () => {
  const { env, rows } = createEnv();
  const request = makeRequest('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ title: 'A feature', details: 'Please add this.' }),
  });
  const created = await worker.fetch(request, env);
  assert.equal(created.status, 201);
  const { id } = await created.json();
  assert.equal(rows[0].title, 'A feature');

  const denied = await worker.fetch(makeRequest('/api/requests'), env);
  assert.equal(denied.status, 401);

  const listed = await worker.fetch(makeRequest('/api/requests', {
    headers: { Authorization: 'Bearer test-admin-token' },
  }), env);
  assert.equal(listed.status, 200);
  assert.deepEqual((await listed.json()).requests.map((item) => item.id), [id]);
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

test('allows the owner to mark a request reviewed', async () => {
  const { env, rows } = createEnv();
  rows.push({ id: '00000000-0000-4000-8000-000000000001', status: 'new' });
  const response = await worker.fetch(makeRequest(`/api/requests/${rows[0].id}`, {
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer test-admin-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: 'reviewed' }),
  }), env);
  assert.equal(response.status, 200);
  assert.equal(rows[0].status, 'reviewed');
});
