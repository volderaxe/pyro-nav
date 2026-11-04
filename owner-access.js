const ownerSessionStorageKey = 'pyroNavOwnerSession';
let ownerPendingAuthMessage = '';

function readOwnerSession() {
  try {
    return sessionStorage.getItem(ownerSessionStorageKey) || '';
  } catch {
    return '';
  }
}

function saveOwnerSession(token) {
  ownerInboxToken = token;
  try {
    if (token) sessionStorage.setItem(ownerSessionStorageKey, token);
    else sessionStorage.removeItem(ownerSessionStorageKey);
  } catch {
    if (token) ownerPendingAuthMessage = 'This browser could not remember your sign-in. Keep this tab open while using owner tools.';
  }
}

function initializeOwnerAccess() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get('owner_session') || '';
  const error = fragment.get('owner_error') || '';
  if (/^[a-f0-9]{64}$/i.test(token)) saveOwnerSession(token);
  else ownerInboxToken = readOwnerSession();

  const messages = {
    cancelled: 'GitHub sign-in was cancelled.',
    expired: 'The sign-in link expired. Please try again.',
    failed: 'GitHub sign-in could not be completed. Please try again.',
    'not-owner': 'That GitHub account is not authorized to manage Pyro Nav.',
    'rate-limited': 'Too many sign-in attempts. Please wait a minute and try again.',
    unavailable: 'Owner sign-in is not configured yet.',
  };
  ownerPendingAuthMessage = messages[error] || ownerPendingAuthMessage;
  if (token || error) history.replaceState(null, document.title, location.pathname + location.search);
}

function setOwnerSignInMessage(message, state) {
  const status = document.getElementById('ownerSignInStatus');
  status.textContent = message;
  status.className = 'owner-signin-status' + (state ? ' ' + state : '');
  status.hidden = !message;
}

async function ownerApi(path, options = {}) {
  let response;
  try {
    response = await fetch(feedbackApiUrl() + path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${ownerInboxToken}`,
      },
    });
  } catch {
    const error = new Error('Could not reach the owner service. Check your connection and try again.');
    error.status = 0;
    throw error;
  }
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') detail = ' ' + body.error;
    } catch {}
    const error = new Error(`The owner service returned an error (${response.status}).${detail}`);
    error.status = response.status;
    throw error;
  }
  return response;
}

function updateOwnerCounts() {
  document.getElementById('ownerNewCount').textContent =
    ownerRequests.filter((request) => request.status === 'new').length;
  document.getElementById('ownerReviewedCount').textContent =
    ownerRequests.filter((request) => request.status === 'reviewed').length;
  document.getElementById('ownerTotalCount').textContent = ownerRequests.length;
}

window.showOwnerInbox = function showOwnerInbox() {
  ownerInboxToken = readOwnerSession() || ownerInboxToken;
  ownerRequests = [];
  document.getElementById('ownerRequests').innerHTML = '';
  document.getElementById('ownerInboxRefresh').hidden = !ownerInboxToken;
  document.getElementById('requestView').hidden = true;
  document.getElementById('ownerInboxView').hidden = false;
  document.getElementById('ownerSignInView').hidden = Boolean(ownerInboxToken);
  document.getElementById('ownerManagementView').hidden = !ownerInboxToken;
  document.getElementById('ownerSignOut').hidden = !ownerInboxToken;
  document.getElementById('ownerSignedInAs').hidden = !ownerInboxToken;
  document.getElementById('ownerRequestFilter').value = 'all';
  updateOwnerCounts();
  setOwnerStatus('', '');
  if (ownerInboxToken) loadOwnerRequests();
  else {
    setOwnerSignInMessage(ownerPendingAuthMessage || 'Sign in with the Pyro Nav GitHub owner account to access private requests.', ownerPendingAuthMessage === 'You have signed out of owner tools.' ? 'is-success' : ownerPendingAuthMessage ? 'is-error' : '');
    ownerPendingAuthMessage = '';
    document.getElementById('ownerGitHubLogin').focus();
  }
};

window.showRequestForm = function showRequestForm() {
  ownerInboxToken = readOwnerSession();
  ownerRequests = [];
  document.getElementById('requestView').hidden = false;
  document.getElementById('ownerInboxView').hidden = true;
  document.getElementById('ownerRequests').innerHTML = '';
  setOwnerStatus('', '');
  document.getElementById('featureRequestTitle').focus();
};

window.loadOwnerRequests = async function loadOwnerRequests() {
  if (!ownerInboxToken) {
    window.showOwnerInbox();
    return;
  }
  const refresh = document.getElementById('ownerInboxRefresh');
  refresh.disabled = true;
  refresh.textContent = 'Loading…';
  setOwnerStatus('Verifying owner sign-in…', 'is-pending');
  document.getElementById('ownerRequests').innerHTML = '';
  try {
    const sessionResponse = await ownerApi('/api/session');
    const session = await sessionResponse.json();
    if (!session || typeof session.login !== 'string' || !Number.isInteger(session.expiresAt)) {
      throw new Error('The owner service returned an unexpected sign-in response.');
    }
    ownerPendingAuthMessage = '';
    document.getElementById('ownerSignedInAs').textContent = `SIGNED IN AS @${session.login.toUpperCase()}`;
    document.getElementById('ownerSignedInAs').hidden = false;
    document.getElementById('ownerSignOut').hidden = false;
    setOwnerStatus('Loading private requests…', 'is-pending');
    const response = await ownerApi('/api/requests');
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.requests) || payload.requests.some((request) =>
      !request || typeof request.id !== 'string' || typeof request.title !== 'string'
      || typeof request.details !== 'string' || typeof request.createdAt !== 'string'
      || !['new', 'reviewed'].includes(request.status))) {
      throw new Error('The inbox response was not in the expected format. Try refreshing.');
    }
    ownerRequests = payload.requests;
    updateOwnerCounts();
    renderOwnerRequests();
    setOwnerStatus(ownerRequests.length
      ? `${ownerRequests.length} private request${ownerRequests.length === 1 ? '' : 's'} loaded.`
      : 'No requests have been submitted yet.', '');
    refresh.hidden = false;
  } catch (error) {
    ownerRequests = [];
    updateOwnerCounts();
    if (error.status === 401) {
      saveOwnerSession('');
      document.getElementById('ownerSignInView').hidden = false;
      document.getElementById('ownerManagementView').hidden = true;
      document.getElementById('ownerSignOut').hidden = true;
      document.getElementById('ownerSignedInAs').hidden = true;
      setOwnerSignInMessage('Your sign-in expired or is no longer valid. Sign in again to continue.', 'is-error');
    } else {
      setOwnerStatus(error.message, 'is-error');
    }
  } finally {
    refresh.disabled = false;
    refresh.textContent = 'Refresh';
  }
};

window.renderOwnerRequests = function renderOwnerRequests() {
  const list = document.getElementById('ownerRequests');
  const filter = document.getElementById('ownerRequestFilter').value;
  const visibleRequests = ownerRequests.filter((request) => filter === 'all' || request.status === filter);
  list.innerHTML = visibleRequests.length
    ? visibleRequests.map((request) => `<article class="request-card"><div class="request-card-heading"><h4>${esc(request.title)}</h4><span class="badge ${request.status === 'new' ? 'todo' : 'done'}">${request.status === 'new' ? 'NEW' : 'REVIEWED'}</span></div><p>${esc(request.details)}</p><div class="request-card-foot"><time datetime="${esc(request.createdAt)}">${esc(new Date(request.createdAt).toLocaleString())}</time>${request.status === 'new' ? `<button type="button" class="review-request" data-request-id="${esc(request.id)}">Mark reviewed</button>` : ''}</div></article>`).join('')
    : `<div class="empty">${ownerRequests.length ? 'No requests match this filter.' : 'No requests have been submitted yet.'}</div>`;
  list.querySelectorAll('.review-request').forEach((button) => {
    button.onclick = () => window.markRequestReviewed(button.dataset.requestId, button);
  });
};

window.markRequestReviewed = async function markRequestReviewed(id, button) {
  if (!ownerInboxToken) return;
  button.disabled = true;
  button.textContent = 'Updating…';
  setOwnerStatus('Updating request status…', 'is-pending');
  try {
    await ownerApi('/api/requests/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'reviewed' }),
    });
    ownerRequests = ownerRequests.map((request) =>
      request.id === id ? { ...request, status: 'reviewed' } : request);
    updateOwnerCounts();
    renderOwnerRequests();
    setOwnerStatus('Request marked reviewed.', 'is-success');
  } catch (error) {
    if (error.status === 401) {
      saveOwnerSession('');
      window.showOwnerInbox();
      setOwnerSignInMessage('Your sign-in expired or is no longer valid. Sign in again to continue.', 'is-error');
    } else {
      setOwnerStatus(error.message, 'is-error');
      button.disabled = false;
      button.textContent = 'Mark reviewed';
    }
  }
};

async function signOutOwner() {
  const token = ownerInboxToken;
  try {
    if (token) {
      await ownerApi('/auth/logout', { method: 'POST' });
      ownerPendingAuthMessage = 'You have signed out of owner tools.';
    }
  } catch (error) {
    ownerPendingAuthMessage = 'Your sign-in was cleared in this tab, but the service could not revoke it. It expires automatically.';
  }
  saveOwnerSession('');
  ownerRequests = [];
  document.getElementById('ownerRequests').innerHTML = '';
  window.showOwnerInbox();
}

const ownerView = document.getElementById('ownerInboxView');
const ownerIntro = ownerView.querySelector('.inbox-heading').nextElementSibling;
ownerIntro.textContent = 'Sign in with the repository owner’s GitHub account to review private requests and owner tools.';

const ownerLoginForm = document.getElementById('ownerLoginForm');
const ownerSignInView = document.createElement('div');
ownerSignInView.id = 'ownerSignInView';
ownerSignInView.innerHTML = `<a id="ownerGitHubLogin" class="primary owner-github-login" href="${esc(feedbackApiUrl())}/auth/login">Sign in with GitHub</a><p id="ownerSignInStatus" class="owner-signin-status" role="status" aria-live="polite" hidden></p>`;
const hiddenTokenCompatibility = document.createElement('input');
hiddenTokenCompatibility.type = 'hidden';
hiddenTokenCompatibility.id = 'ownerToken';
ownerSignInView.append(hiddenTokenCompatibility);
ownerLoginForm.replaceWith(ownerSignInView);

ownerView.querySelector('.inbox-heading').firstElementChild.insertAdjacentHTML(
  'beforeend',
  '<p id="ownerSignedInAs" class="owner-signed-in" hidden></p>',
);
ownerView.querySelector('.inbox-heading').insertAdjacentHTML(
  'beforeend',
  '<button id="ownerSignOut" type="button" class="owner-link" hidden>Sign out</button>',
);
ownerView.querySelector('.inbox-toolbar').insertAdjacentHTML(
  'beforebegin',
  '<div id="ownerManagementView" hidden><div class="owner-summary"><div><span>NEW</span><strong id="ownerNewCount">0</strong></div><div><span>REVIEWED</span><strong id="ownerReviewedCount">0</strong></div><div><span>INBOX TOTAL</span><strong id="ownerTotalCount">0</strong></div></div><div class="owner-filter"><label for="ownerRequestFilter">SHOW REQUESTS</label><select id="ownerRequestFilter"><option value="all">All requests</option><option value="new">New only</option><option value="reviewed">Reviewed only</option></select></div></div>',
);

document.getElementById('ownerSignOut').addEventListener('click', signOutOwner);
document.getElementById('ownerRequestFilter').addEventListener('change', window.renderOwnerRequests);
initializeOwnerAccess();
