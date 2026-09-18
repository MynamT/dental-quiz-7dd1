import { isAdmin, json, now, read, requireUser, save } from './_utils.js';

export default async (request) => {
  if (request.method !== 'POST') {
    return json({ message: 'Method not allowed' }, 405);
  }

  const auth = await requireUser();
  if (auth.error) return auth.error;

  const user = auth.user;

  if (isAdmin(user)) {
    return json({ allowed: true, isAdmin: true, reason: 'admin', email: user.email });
  }

  const deviceId = request.headers.get('x-device-id') || '';
  if (!deviceId || deviceId.length > 200) {
    return json({ allowed: false, reason: 'missing_device' }, 400);
  }

  let record = await read(user.id);

  if (!record) {
    record = {
      userId: user.id,
      email: user.email,
      status: 'pending',
      approvedDeviceId: null,
      pendingDeviceId: deviceId,
      createdAt: now(),
      updatedAt: now(),
    };

    await save(user.id, record);
    return json({ allowed: false, reason: 'pending_approval', status: 'pending' });
  }

  record.email = user.email || record.email;
  record.updatedAt = now();

  if (record.status === 'deleted') {
    await save(user.id, record);
    return json({ allowed: false, reason: 'deleted', status: 'deleted' });
  }

  if (record.status === 'suspended') {
    await save(user.id, record);
    return json({ allowed: false, reason: 'suspended', status: 'suspended' });
  }

  if (record.status === 'rejected') {
    await save(user.id, record);
    return json({ allowed: false, reason: 'rejected', status: 'rejected' });
  }

  if (
    record.status === 'approved' &&
    record.approvedDeviceId === deviceId
  ) {
    await save(user.id, record);
    return json({ allowed: true, reason: 'approved', status: 'approved' });
  }

  if (record.status === 'reset') {
    record.pendingDeviceId = deviceId;
    record.status = 'pending';
    await save(user.id, record);
    return json({ allowed: false, reason: 'pending_approval', status: 'pending' });
  }

  if (record.status === 'pending') {
    if (!record.pendingDeviceId) {
      record.pendingDeviceId = deviceId;
      await save(user.id, record);
    }

    if (record.pendingDeviceId === deviceId) {
      return json({ allowed: false, reason: 'pending_approval', status: 'pending' });
    }
  }

  return json({ allowed: false, reason: 'different_device', status: 'locked' });
};
