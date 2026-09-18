import { isAdmin, json, preview, requireUser, store } from './_utils.js';

export default async (request) => {
  if (request.method !== 'GET') return json({ message: 'Method not allowed' }, 405);

  const auth = await requireUser();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.user)) return json({ message: 'Forbidden' }, 403);

  const s = store();
  const listed = await s.list({ prefix: 'user:' });

  const users = (await Promise.all(
    listed.blobs.map(async ({ key }) => {
      const record = await s.get(key, { type: 'json', consistency: 'strong' });
      if (!record) return null;

      return {
        userId: record.userId,
        email: record.email,
        status: record.status || 'reset',
        hasPending: !!record.pendingDeviceId,
        approvedDevicePreview: preview(record.approvedDeviceId),
        pendingDevicePreview: preview(record.pendingDeviceId),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      };
    }),
  ))
    .filter(Boolean)
    .sort((a, b) => {
      const rank = { pending: 0, approved: 1, suspended: 2, rejected: 3, reset: 4, deleted: 5 };
      const ar = rank[a.status] ?? 9;
      const br = rank[b.status] ?? 9;
      if (ar !== br) return ar - br;
      return String(a.email || '').localeCompare(String(b.email || ''));
    });

  return json({ users });
};
