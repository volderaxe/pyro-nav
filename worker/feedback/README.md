# Pyro Nav feedback API

The Worker stores improvement-request text and status in Cloudflare D1. The public GitHub Pages app calls the Worker; request details are not sent by email or exposed in a public list. No account or contact field is collected, and the app does not store submitter IP addresses in D1. Cloudflare necessarily processes connection metadata and uses the connecting IP for transient rate limiting. Configure `ADMIN_TOKEN` as a Worker secret and enter it only in the app's owner inbox. The app must be served from an origin listed in `ALLOWED_ORIGINS`.

## Free-plan setup

The Cloudflare Workers Free plan currently includes 100,000 Worker requests per day. D1's free limits currently include 5 million rows read and 100,000 rows written per day and 5 GB total storage. If a limit is reached, writes may stop until the daily limit resets. Limits and pricing can change; check Cloudflare's current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) before launch.

1. The `pyro-nav-feedback` D1 database is already created in the account. Its ID is in `wrangler.jsonc`.
2. Create a Cloudflare API token limited to this account with Workers Scripts: Edit and D1: Edit permissions. In GitHub repository Settings → Secrets and variables → Actions, add secrets named `CLOUDFLARE_API_TOKEN` and `FEEDBACK_ADMIN_TOKEN`. Choose a strong random owner token. Do not put either in source code or share them in chat.
3. `ALLOWED_ORIGINS` is already set to `https://volderaxe.github.io` for the current GitHub Pages app. If you host the app from a different origin, update this Worker variable before deployment; the origin excludes the `/pyro-nav/` path.
4. Run **Deploy Pyro Nav feedback API** from GitHub Actions. The workflow applies D1 migrations and deploys the Worker, and sets its `ADMIN_TOKEN` from `FEEDBACK_ADMIN_TOKEN`.
5. Copy the Worker's `workers.dev` URL into `feedback-config.js` as the value of `window.PYRONAV_FEEDBACK_API_URL` (base URL, no trailing slash). It must include `https://`; the API paths are appended by the app. Publish the app after this change.

The application remains static on GitHub Pages and station/route data remains local to each browser. The feedback form reports an error, rather than claiming success, if the API URL or backend is unavailable.

## API

- `POST /api/requests` accepts `{ "title": "...", "details": "..." }`.
- `GET /api/requests` requires `Authorization: Bearer <ADMIN_TOKEN>`.
- `PATCH /api/requests/{uuid}` with the same authorization accepts `{ "status": "reviewed" }`.

The API restricts browser origins, validates request sizes and fields, applies a per-IP edge rate limit, and never stores submitter IP addresses.

## Local checks

With Node.js 20 or newer, run `node --test worker/feedback/tests/worker.test.mjs`. The tests use Node's built-in test runner and need no third-party packages.
