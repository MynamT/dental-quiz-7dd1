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

  /*
    If an already-approved account is requesting a device
    change, reject only the new request. Do not revoke the
    currently approved device.
  */
  if (
    record.status === 'approved' &&
    record.approvedDeviceId &&
    record.pendingDeviceId
  ) {
    record.rejectedDeviceId = record.pendingDeviceId;
    record.pendingDeviceId = null;
    record.deviceChangeRequestedAt = null;
    record.deviceChangeRejectedAt = now();
    record.updatedAt = now();
    await save(userId, record);

    return json({
      ok: true,
      status: 'approved',
      deviceChangeRejected: true,
    });
  }

  record.status = 'rejected';
  record.rejectedDeviceId = record.pendingDeviceId || null;
  record.pendingDeviceId = null;
  record.updatedAt = now();
  record.rejectedAt = now();
  await save(userId, record);

  return json({ ok: true });
};
