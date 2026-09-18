import { isAdmin, json, now, read, requireUser, save } from './_utils.js';

export default async (request) => {
  if (request.method !== 'POST') return json({ message: 'Method not allowed' }, 405);
  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.user)) return json({ message: 'Forbidden' }, 403);

  const { userId } = await request.json().catch(() => ({}));
  if (!userId) return json({ message: 'userId is required' }, 400);

  const record = await read(userId);
  if (!record) return json({ message: 'User device record not found' }, 404);

  record.status = 'reset';
  record.approvedDeviceId = null;
  record.pendingDeviceId = null;
  record.rejectedDeviceId = null;
  record.updatedAt = now();
  await save(userId, record);

  return json({ ok: true });
};
