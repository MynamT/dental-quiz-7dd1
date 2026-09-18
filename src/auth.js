import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  updateUser,
} from '@netlify/identity';

const DEVICE_KEY = 'dental_quiz_device_id_v1';
const $ = (id) => document.getElementById(id);

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}

function hideAuthViews() {
  [
    'loadingView',
    'loginView',
    'inviteView',
    'recoveryView',
    'pendingView',
    'lockedView',
  ].forEach((id) => $(id).classList.add('hidden'));
}

function show(id) {
  hideAuthViews();
  $(id).classList.remove('hidden');
}

function setMessage(id, text, type = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `status-message${type ? ` ${type}` : ''}`;
  el.classList.remove('hidden');
}

function setLockedMessage(reason) {
  const title = document.querySelector('#lockedView h2');
  const text = document.querySelector('#lockedView .muted');

  if (reason === 'suspended') {
    title.textContent = 'Your quiz access is suspended';
    text.textContent = 'Contact the administrator if you believe this account should be reactivated.';
    return;
  }

  if (reason === 'rejected') {
    title.textContent = 'This device request was rejected';
    text.textContent = 'Contact the administrator if you need permission to submit a new device request.';
    return;
  }

  if (reason === 'deleted') {
    title.textContent = 'Quiz access has been removed';
    text.textContent = 'This account no longer has access to the quiz. Contact the administrator if access should be restored.';
    return;
  }

  title.textContent = 'This account is already registered to another device';
  text.textContent = 'Contact the administrator if you need to move your account to a new phone or computer.';
}

export function createAuthController(callbacks = {}) {
  let inviteToken = null;
  let recovery = false;

  function setAccount(user) {
    $('accountEmail').textContent = user?.email || '';
    $('accountEmail').classList.toggle('hidden', !user);
    $('logoutBtn').classList.toggle('hidden', !user);
  }

  async function check() {
    const user = await getUser();

    if (!user) {
      setAccount(null);
      show('loginView');
      callbacks.onLoggedOut?.();
      return;
    }

    setAccount(user);
    const id = getDeviceId();

    const status = await api('/.netlify/functions/check-device', {
      method: 'POST',
      headers: { 'x-device-id': id },
      body: JSON.stringify({ deviceId: id }),
    });

    if (status.isAdmin) {
      hideAuthViews();
      await callbacks.onAdmin?.({ ...status, user, deviceId: id });
      return;
    }

    if (status.allowed) {
      hideAuthViews();
      await callbacks.onAllowed?.({ user, deviceId: id, ...status });
      return;
    }

    callbacks.onBlocked?.(status);

    if (status.reason === 'pending_approval') {
      show('pendingView');
      return;
    }

    setLockedMessage(status.reason);
    show('lockedView');
  }

  async function processCallback() {
    const hasAuthHash = /#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/.test(location.hash);
    if (!hasAuthHash) return false;

    show('loadingView');

    try {
      const result = await handleAuthCallback();
      if (!result) return false;

      if (result.type === 'invite' && result.token) {
        inviteToken = result.token;
        show('inviteView');
        return true;
      }

      if (result.type === 'recovery') {
        recovery = true;
        show('recoveryView');
        return true;
      }

      await check();
      return true;
    } catch (error) {
      show('loginView');
      setMessage('loginMessage', error.message || 'Authentication link failed.', 'error');
      return true;
    }
  }

  $('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const button = $('loginBtn');
    button.disabled = true;
    button.textContent = 'Signing in…';

    try {
      await login($('emailInput').value.trim(), $('passwordInput').value);
      $('passwordInput').value = '';
      await check();
    } catch (error) {
      setMessage('loginMessage', error.message || 'Unable to sign in.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Sign in';
    }
  });

  $('forgotBtn').addEventListener('click', async () => {
    const email = $('emailInput').value.trim();
    if (!email) {
      setMessage('loginMessage', 'Enter your email first.', 'error');
      return;
    }

    try {
      await requestPasswordRecovery(email);
      setMessage('loginMessage', 'Recovery email sent.', 'good');
    } catch (error) {
      setMessage('loginMessage', error.message || 'Could not send recovery email.', 'error');
    }
  });

  $('inviteForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const password = $('invitePassword').value;
    const confirmPassword = $('invitePasswordConfirm').value;

    if (password !== confirmPassword) {
      setMessage('inviteMessage', 'Passwords do not match.', 'error');
      return;
    }

    try {
      await acceptInvite(inviteToken, password);
      inviteToken = null;
      await check();
    } catch (error) {
      setMessage('inviteMessage', error.message || 'Could not activate account.', 'error');
    }
  });

  $('recoveryForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!recovery) {
      setMessage('recoveryMessage', 'Recovery session expired.', 'error');
      return;
    }

    try {
      await updateUser({ password: $('recoveryPassword').value });
      recovery = false;
      await check();
    } catch (error) {
      setMessage('recoveryMessage', error.message || 'Could not update password.', 'error');
    }
  });

  async function signOut() {
    try {
      await logout();
    } finally {
      setAccount(null);
      callbacks.onLoggedOut?.();
      show('loginView');
    }
  }

  $('logoutBtn').addEventListener('click', signOut);
  $('pendingLogoutBtn').addEventListener('click', signOut);
  $('lockedLogoutBtn').addEventListener('click', signOut);
  $('checkAgainBtn').addEventListener('click', check);

  return {
    deviceId: getDeviceId,
    check,
    async init() {
      show('loadingView');
      if (!(await processCallback())) await check();
    },
  };
}
