import { isAdmin, json, now, read, requireUser, save } from './_utils.js';

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ message: 'Method not allowed' }, 405);
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.user)) return json({ message: 'Forbidden' }, 403);

  const { userId } = await request.json().catch(() => ({}));
  if (!userId) return json({ message: 'userId is required' }, 400);

  const record = await read(userId);
  if (!record) return json({ message: 'User device record not found' }, 404);
  if (!record.pendingDeviceId) return json({ message: 'No pending device' }, 400);

  /*
    This works for both:
    1. first-time device approval, and
    2. an approved account requesting a replacement device.

    For a replacement, the old approved device stays valid
    until this action is performed.
  */
  if (record.approvedDeviceId) {
    record.previousApprovedDeviceId = record.approvedDeviceId;
  }

  record.approvedDeviceId = record.pendingDeviceId;
  record.pendingDeviceId = null;
  record.status = 'approved';
  record.deviceChangeRequestedAt = null;
  record.approvedAt = now();
  record.updatedAt = now();

  await save(userId, record);

  return json({ ok: true, status: 'approved' });
};
