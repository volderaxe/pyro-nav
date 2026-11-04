const MAX_BODY_BYTES = 8192;
const MAX_TITLE_LENGTH = 100;
const MAX_DETAILS_LENGTH = 3000;
const MAX_INBOX_ITEMS = 100;
const AUTH_STATE_LIFETIME_SECONDS = 600;
const OWNER_SESSION_LIFETIME_SECONDS = 43200;

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
      'Cache-Control': 'no-store',
      Vary: 'Origin',
    },
  });
}

function randomHex(byteLength) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function ownerToken(request) {
  const authorization = request.headers.get('Authorization') || '';
  const match = authorization.match(/^Bearer ([a-f0-9]{64})$/i);
  return match?.[1] || '';
}

async function getOwnerSession(request, env) {
  const token = ownerToken(request);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await env.DB.prepare(
    'SELECT expires_at AS expiresAt FROM owner_sessions WHERE token_hash = ?1',
  ).bind(tokenHash).first();
  if (!session || Number(session.expiresAt) <= Math.floor(Date.now() / 1000)) return null;
  return { expiresAt: Number(session.expiresAt) };
}

async function requireOwner(request, env, origin) {
  const session = await getOwnerSession(request, env);
  if (!session) {
    return {
      session: null,
      denied: response({ error: 'Sign in with the authorized GitHub account to access owner tools.' }, 401, origin),
    };
  }
  return { session, denied: null };
}

function redirectToApp(env, params) {
  const destination = new URL(env.OWNER_APP_URL);
  destination.hash = new URLSearchParams(params).toString();
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function startGitHubLogin(request, env) {
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.PYRONAV_OAUTH_CLIENT_SECRET
      || !env.OWNER_GITHUB_LOGIN || !env.OWNER_APP_URL) {
    return redirectToApp(env, { owner_error: 'unavailable' });
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return redirectToApp(env, { owner_error: 'failed' });
  const { success } = await env.FEEDBACK_LIMITER.limit({ key: `owner-auth:${ip}` });
  if (!success) return redirectToApp(env, { owner_error: 'rate-limited' });

  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('DELETE FROM owner_auth_states WHERE expires_at <= ?1').bind(now).run();
  await env.DB.prepare('DELETE FROM owner_sessions WHERE expires_at <= ?1').bind(now).run();
  const state = randomHex(32);
  await env.DB.prepare(
    'INSERT INTO owner_auth_states (state_hash, expires_at) VALUES (?1, ?2)',
  ).bind(await sha256Hex(state), now + AUTH_STATE_LIFETIME_SECONDS).run();

  const callback = new URL('/auth/callback', new URL(request.url).origin);
  const authorization = new URL('https://github.com/login/oauth/authorize');
  authorization.searchParams.set('client_id', env.GITHUB_OAUTH_CLIENT_ID);
  authorization.searchParams.set('redirect_uri', callback.toString());
  authorization.searchParams.set('state', state);
  authorization.searchParams.set('allow_signup', 'false');
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorization.toString(),
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

async function completeGitHubLogin(request, env) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const now = Math.floor(Date.now() / 1000);
  if (!state || !code) return redirectToApp(env, { owner_error: 'cancelled' });

  const stateHash = await sha256Hex(state);
  const savedState = await env.DB.prepare(
    'SELECT state_hash FROM owner_auth_states WHERE state_hash = ?1 AND expires_at > ?2',
  ).bind(stateHash, now).first();
  if (!savedState) return redirectToApp(env, { owner_error: 'expired' });
  await env.DB.prepare('DELETE FROM owner_auth_states WHERE state_hash = ?1').bind(stateHash).run();

  const callback = new URL('/auth/callback', url.origin).toString();
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.PYRONAV_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: callback,
    }),
  });
  if (!tokenResponse.ok) return redirectToApp(env, { owner_error: 'failed' });
  const tokenPayload = await tokenResponse.json();
  if (typeof tokenPayload.access_token !== 'string' || !tokenPayload.access_token) {
    return redirectToApp(env, { owner_error: 'failed' });
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenPayload.access_token}`,
      'User-Agent': 'Pyro-Nav-Owner-Login',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!userResponse.ok) return redirectToApp(env, { owner_error: 'failed' });
  const user = await userResponse.json();
  if (typeof user.login !== 'string'
      || user.login.toLowerCase() !== env.OWNER_GITHUB_LOGIN.toLowerCase()) {
    return redirectToApp(env, { owner_error: 'not-owner' });
  }

  const sessionToken = randomHex(32);
  const expiresAt = now + OWNER_SESSION_LIFETIME_SECONDS;
  await env.DB.prepare(
    'INSERT INTO owner_sessions (token_hash, expires_at) VALUES (?1, ?2)',
  ).bind(await sha256Hex(sessionToken), expiresAt).run();
  return redirectToApp(env, { owner_session: sessionToken });
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
    'INSERT INTO requests (id, title, details) VALUES (?1, ?2, ?3)',
  ).bind(id, title, details).run();
  return response({ id }, 201, origin);
}

async function listRequests(request, env, origin) {
  const access = await requireOwner(request, env, origin);
  if (access.denied) return access.denied;
  const result = await env.DB.prepare(
    `SELECT id, title, details, created_at AS createdAt, status
     FROM requests ORDER BY created_at DESC LIMIT ${MAX_INBOX_ITEMS}`,
  ).all();
  return response({ requests: result.results }, 200, origin);
}

async function ownerSession(request, env, origin) {
  const access = await requireOwner(request, env, origin);
  if (access.denied) return access.denied;
  return response({
    login: env.OWNER_GITHUB_LOGIN,
    expiresAt: access.session.expiresAt,
  }, 200, origin);
}

async function logoutOwner(request, env, origin) {
  const token = ownerToken(request);
  if (!token) {
    return response({ error: 'Sign in with the authorized GitHub account to access owner tools.' }, 401, origin);
  }
  await env.DB.prepare('DELETE FROM owner_sessions WHERE token_hash = ?1')
    .bind(await sha256Hex(token)).run();
  return response({ signedOut: true }, 200, origin);
}

async function reviewRequest(request, env, origin, id) {
  const access = await requireOwner(request, env, origin);
  if (access.denied) return access.denied;
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const isOAuthNavigation = request.method === 'GET'
      && (url.pathname === '/auth/login' || url.pathname === '/auth/callback');
    if (!isOAuthNavigation && !allowedOrigin(origin, env)) {
      return response({ error: 'This origin is not allowed.' }, 403);
    }
    if (request.method === 'OPTIONS') return optionsResponse(origin);

    try {
      if (url.pathname === '/auth/login' && request.method === 'GET') {
        return await startGitHubLogin(request, env);
      }
      if (url.pathname === '/auth/callback' && request.method === 'GET') {
        if (url.searchParams.has('error')) return redirectToApp(env, { owner_error: 'cancelled' });
        return await completeGitHubLogin(request, env);
      }
      if (url.pathname === '/api/requests' && request.method === 'POST') {
        return await createRequest(request, env, origin);
      }
      if (url.pathname === '/api/requests' && request.method === 'GET') {
        return await listRequests(request, env, origin);
      }
      if (url.pathname === '/api/session' && request.method === 'GET') {
        return await ownerSession(request, env, origin);
      }
      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        return await logoutOwner(request, env, origin);
      }
      const itemMatch = url.pathname.match(/^\/api\/requests\/([a-f0-9-]{36})$/i);
      if (itemMatch && request.method === 'PATCH') {
        return await reviewRequest(request, env, origin, itemMatch[1]);
      }
      return response({ error: 'Not found.' }, 404, origin);
    } catch {
      console.error('Feedback API request failed.');
      return response({ error: 'The service could not complete this request. Please try again.' }, 500, origin);
    }
  },
};
