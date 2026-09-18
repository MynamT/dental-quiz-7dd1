import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';

export const STORE = 'dental-quiz-devices';

export const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });

export async function requireUser() {
  const user = await getUser();
  return user ? { user } : { error: json({ message: 'Unauthorized' }, 401) };
}

export function isAdmin(user) {
  const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return !!adminEmail && String(user.email || '').toLowerCase() === adminEmail;
}

export const store = () => getStore(STORE);

export async function read(id) {
  return store().get(`user:${id}`, { type: 'json', consistency: 'strong' });
}

export async function save(id, record) {
  await store().setJSON(`user:${id}`, record);
}

export function preview(id) {
  return id ? `${id.slice(0, 6)}…${id.slice(-4)}` : '';
}

export function now() {
  return new Date().toISOString();
}

export async function verify(user, deviceId) {
  if (isAdmin(user)) return { allowed: true, isAdmin: true, reason: 'admin' };
  if (!deviceId) return { allowed: false, reason: 'missing_device' };

  const record = await read(user.id);
  if (!record) return { allowed: false, reason: 'not_registered' };

  if (record.status === 'deleted') {
    return { allowed: false, reason: 'deleted', record };
  }

  if (record.status === 'suspended') {
    return { allowed: false, reason: 'suspended', record };
  }

  if (record.status === 'rejected') {
    return { allowed: false, reason: 'rejected', record };
  }

  if (
    record.status === 'approved' &&
    record.approvedDeviceId === deviceId
  ) {
    return { allowed: true, reason: 'approved', record };
  }

  if (
    record.status === 'pending' &&
    !record.approvedDeviceId &&
    record.pendingDeviceId === deviceId
  ) {
    return { allowed: false, reason: 'pending_approval', record };
  }

  return { allowed: false, reason: 'different_device', record };
}
