const MAX_BODY_BYTES = 8192;
const MAX_TITLE_LENGTH = 100;
const MAX_DETAILS_LENGTH = 3000;
const MAX_INBOX_ITEMS = 100;

function allowedOrigin(origin, env) {
  return (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(origin);
}

function response(body, status, origin) {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function optionsResponse(origin) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}

async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function isAdmin(request, env) {
  const expected = env.ADMIN_TOKEN;
  const supplied = request.headers.get('Authorization') || '';
  if (!expected || !supplied.startsWith('Bearer ')) return false;
  return constantTimeEqual(supplied.slice(7), expected);
}

async function parseJson(request) {
  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_BODY_BYTES) return { error: 'Request is too large.' };
  if (!(request.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    return { error: 'Send the request as JSON.' };
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return { error: 'Request is too large.' };
  }
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: 'The request could not be read.' };
  }
}

async function createRequest(request, env, origin) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return response({ error: 'Unable to verify this request.' }, 400, origin);
  const { success } = await env.FEEDBACK_LIMITER.limit({ key: ip });
  if (!success) return response({ error: 'Too many requests. Please try again in a minute.' }, 429, origin);

  const parsed = await parseJson(request);
  if (parsed.error) return response({ error: parsed.error }, 400, origin);
  const title = typeof parsed.value?.title === 'string' ? parsed.value.title.trim() : '';
  const details = typeof parsed.value?.details === 'string' ? parsed.value.details.trim() : '';
  if (!title || title.length > MAX_TITLE_LENGTH) {
    return response({ error: `Enter a title of 1-${MAX_TITLE_LENGTH} characters.` }, 400, origin);
  }
  if (!details || details.length > MAX_DETAILS_LENGTH) {
    return response({ error: `Enter details of 1-${MAX_DETAILS_LENGTH} characters.` }, 400, origin);
  }

  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO requests (id, title, details) VALUES (?1, ?2, ?3)",
  ).bind(id, title, details).run();
  return response({ id }, 201, origin);
}

async function listRequests(request, env, origin) {
  if (!(await isAdmin(request, env))) {
    return response({ error: 'The owner key was not accepted.' }, 401, origin);
  }
  const result = await env.DB.prepare(
    `SELECT id, title, details, created_at AS createdAt, status
     FROM requests ORDER BY created_at DESC LIMIT ${MAX_INBOX_ITEMS}`,
  ).all();
  return response({ requests: result.results }, 200, origin);
}

async function reviewRequest(request, env, origin, id) {
  if (!(await isAdmin(request, env))) {
    return response({ error: 'The owner key was not accepted.' }, 401, origin);
  }
  const parsed = await parseJson(request);
  if (parsed.error) return response({ error: parsed.error }, 400, origin);
  if (parsed.value?.status !== 'reviewed') {
    return response({ error: 'Only the reviewed status is supported.' }, 400, origin);
  }
  const result = await env.DB.prepare(
    "UPDATE requests SET status = 'reviewed' WHERE id = ?1",
  ).bind(id).run();
  if (!result.meta.changes) return response({ error: 'This request was not found.' }, 404, origin);
  return response({ status: 'reviewed' }, 200, origin);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (!allowedOrigin(origin, env)) {
      return response({ error: 'This origin is not allowed.' }, 403);
    }
    if (request.method === 'OPTIONS') return optionsResponse(origin);

    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/requests' && request.method === 'POST') {
        return await createRequest(request, env, origin);
      }
      if (url.pathname === '/api/requests' && request.method === 'GET') {
        return await listRequests(request, env, origin);
      }
      const itemMatch = url.pathname.match(/^\/api\/requests\/([a-f0-9-]{36})$/i);
      if (itemMatch && request.method === 'PATCH') {
        return await reviewRequest(request, env, origin, itemMatch[1]);
      }
      return response({ error: 'Not found.' }, 404, origin);
    } catch (error) {
      console.error('Feedback API request failed.', error);
      return response({ error: 'The service could not complete this request. Please try again.' }, 500, origin);
    }
  },
};
