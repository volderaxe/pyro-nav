# Pyro Nav feedback API

The Worker stores improvement-request text and status in Cloudflare D1. The public GitHub Pages app calls the Worker; request details are not sent by email or exposed in a public list. Submitting a request does not require an account or contact information. The owner inbox and review actions require GitHub sign-in from the configured owner account. The app does not store submitter IP addresses in D1; Cloudflare uses the connecting IP for transient rate limiting.

## Authentication

GitHub OAuth signs the owner in without placing a reusable owner password or API key in the browser. The Worker exchanges GitHub's short-lived authorization code, verifies the returned account login against `OWNER_GITHUB_LOGIN`, and issues a random 12-hour session. Only a SHA-256 hash of that session is stored in D1. The app keeps the session in the current browser tab's `sessionStorage`, removes the callback fragment from the address bar, and offers a sign-out action that revokes the session.

The OAuth app uses no repository permissions or private data scopes. Its exact callback URL is:

`https://pyro-nav-feedback-api.pyronav-feedback.workers.dev/auth/callback`

Set its client ID in `wrangler.jsonc` as `GITHUB_OAUTH_CLIENT_ID`, and set the matching `PYRONAV_OAUTH_CLIENT_SECRET` as a GitHub Actions repository secret. The repository owner account is configured as `OWNER_GITHUB_LOGIN`. Never commit the client secret or place it in the static app.

## Free-plan setup and deployment

The Cloudflare Workers Free plan currently includes 100,000 Worker requests per day. D1's free limits currently include 5 million rows read and 100,000 rows written per day and 5 GB total storage. If a limit is reached, writes may stop until the daily limit resets. Limits and pricing can change; check Cloudflare's current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) before launch.

1. The `pyro-nav-feedback` D1 database is already created in the account. Its ID is in `wrangler.jsonc`.
2. Keep the Cloudflare API token in the `CLOUDFLARE_API_TOKEN` GitHub Actions repository secret. The deploy token needs only Workers Scripts: Edit and D1: Edit for this account.
3. Keep the OAuth app's client secret in `PYRONAV_OAUTH_CLIENT_SECRET` in the same repository's Actions secrets. `GITHUB_OAUTH_CLIENT_ID`, `OWNER_GITHUB_LOGIN`, and `OWNER_APP_URL` are public application configuration in `wrangler.jsonc`.
4. `ALLOWED_ORIGINS` is set to `https://volderaxe.github.io`. If the app is hosted from another origin, update this Worker variable; the origin excludes the `/pyro-nav/` path.
5. Run **Deploy Pyro Nav feedback API** from GitHub Actions. It applies D1 migrations and deploys the Worker with the OAuth client secret.
6. `feedback-config.js` contains the public Worker URL. Keep it pointed to the deployed Worker, then publish the static app.

The application remains static on GitHub Pages and station/route data remains local to each browser. The feedback form reports an error, rather than claiming success, if the API URL or backend is unavailable.

## API

- `POST /api/requests` accepts `{ "title": "...", "details": "..." }` without requiring a submitter account.
- `GET /auth/login` begins GitHub OAuth sign-in; `/auth/callback` accepts the provider response and returns to the app.
- `GET /api/session` requires an owner session and reports the authorized login and session expiry.
- `GET /api/requests` requires an owner session.
- `PATCH /api/requests/{uuid}` with an owner session accepts `{ "status": "reviewed" }`.
- `POST /auth/logout` revokes the current owner session.

The API restricts browser origins, uses one-time OAuth state, verifies the exact configured GitHub login, validates request sizes and fields, applies a per-IP edge rate limit, and never stores submitter IP addresses.

## Local checks

With Node.js 20 or newer, run `node --test worker/feedback/tests/worker.test.mjs`. The tests use Node's built-in test runner and need no third-party packages.
