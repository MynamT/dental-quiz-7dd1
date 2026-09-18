const $ = (id) => document.getElementById(id);

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

function actionButton(label, className, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

export function createAdminPanel() {
  function stats(users) {
    $('adminStats').innerHTML = '';

    const items = [
      ['Total', users.length],
      ['Pending', users.filter((u) => u.status === 'pending').length],
      ['Approved', users.filter((u) => u.status === 'approved').length],
      ['Suspended', users.filter((u) => u.status === 'suspended').length],
      ['Rejected', users.filter((u) => u.status === 'rejected').length],
      ['Deleted', users.filter((u) => u.status === 'deleted').length],
    ];

    items.forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'stat-card';

      const strong = document.createElement('strong');
      strong.textContent = String(value);

      const span = document.createElement('span');
      span.textContent = label;

      card.append(strong, span);
      $('adminStats').appendChild(card);
    });
  }

  async function runAction(url, user, confirmText = null) {
    if (confirmText && !confirm(confirmText)) return;

    await api(url, {
      method: 'POST',
      body: JSON.stringify({ userId: user.userId }),
    });

    await load();
  }

  function render(users) {
    $('adminUsers').innerHTML = '';

    if (!users.length) {
      $('adminUsers').innerHTML = '<p class="muted">No user device records yet.</p>';
      return;
    }

    users.forEach((user) => {
      const row = document.createElement('div');
      row.className = 'admin-user';

      const info = document.createElement('div');
      const email = document.createElement('div');
      email.className = 'email';
      email.textContent = user.email || user.userId;

      const meta = document.createElement('div');
      meta.className = 'meta';

      const pill = document.createElement('span');
      pill.className = `status-pill ${user.status || 'reset'}`;
      pill.textContent = user.status || 'reset';

      const preview = user.approvedDevicePreview || user.pendingDevicePreview || 'not registered';
      const detail = document.createTextNode(` · Device ${preview}`);

      meta.append(pill, detail);
      info.append(email, meta);

      const actions = document.createElement('div');
      actions.className = 'admin-actions';

      if (user.status === 'pending' && user.hasPending) {
        actions.append(
          actionButton('Approve', 'primary-btn small', () =>
            runAction('/.netlify/functions/approve-device', user),
          ),
          actionButton('Reject', 'danger-btn small', () =>
            runAction(
              '/.netlify/functions/reject-device',
              user,
              `Reject the pending device for ${user.email || user.userId}?`,
            ),
          ),
        );
      }

      if (user.status === 'approved') {
        actions.append(
          actionButton('Reset device', 'ghost-btn small', () =>
            runAction(
              '/.netlify/functions/reset-device',
              user,
              `Reset the approved device for ${user.email || user.userId}?`,
            ),
          ),
          actionButton('Suspend', 'danger-btn small', () =>
            runAction(
              '/.netlify/functions/suspend-user',
              user,
              `Suspend quiz access for ${user.email || user.userId}?`,
            ),
          ),
        );
      }

      if (user.status === 'suspended') {
        actions.append(
          actionButton('Reactivate', 'primary-btn small', () =>
            runAction('/.netlify/functions/reactivate-user', user),
          ),
          actionButton('Reset device', 'ghost-btn small', () =>
            runAction('/.netlify/functions/reset-device', user),
          ),
        );
      }

      if (user.status === 'rejected') {
        actions.append(
          actionButton('Allow new request', 'primary-btn small', () =>
            runAction('/.netlify/functions/allow-new-request', user),
          ),
        );
      }

      if (user.status === 'reset') {
        const note = document.createElement('span');
        note.className = 'muted';
        note.textContent = 'Waiting for the user to sign in on a device.';
        actions.appendChild(note);
      }

      if (user.status === 'deleted') {
        actions.append(
          actionButton('Restore access', 'primary-btn small', () =>
            runAction('/.netlify/functions/restore-access', user),
          ),
        );
      } else {
        actions.append(
          actionButton('Delete access', 'danger-btn small', () =>
            runAction(
              '/.netlify/functions/delete-access',
              user,
              `Delete quiz access for ${user.email || user.userId}?\n\nThis blocks the account from this quiz. The Netlify Identity account itself remains in Netlify Identity.`,
            ),
          ),
        );
      }

      row.append(info, actions);
      $('adminUsers').appendChild(row);
    });
  }

  async function load() {
    $('adminUsers').innerHTML = '<p class="muted">Loading…</p>';

    try {
      const data = await api('/.netlify/functions/admin-users');
      stats(data.users || []);
      render(data.users || []);
    } catch (error) {
      $('adminUsers').innerHTML = '<p class="status-message error"></p>';
      $('adminUsers').firstChild.textContent = error.message;
    }
  }

  $('refreshAdminBtn').addEventListener('click', load);
  return { load };
}
