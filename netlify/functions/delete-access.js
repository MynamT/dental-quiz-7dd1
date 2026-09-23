import {
  isAdmin,
  json,
  now,
  read,
  requireUser,
  save,
} from "./_utils.js";

export default async (
  request,
) => {
  /* =======================================================
     METHOD
  ======================================================= */

  if (
    request.method !==
    "POST"
  ) {
    return json(
      {
        message:
          "Method not allowed",
      },

      405,
    );
  }

  /* =======================================================
     AUTH
  ======================================================= */

  const auth =
    await requireUser();

  if (auth.error) {
    return auth.error;
  }

  /* =======================================================
     ADMIN ONLY
  ======================================================= */

  if (
    !isAdmin(
      auth.user,
    )
  ) {
    return json(
      {
        message:
          "Forbidden",
      },

      403,
    );
  }

  /* =======================================================
     BODY
  ======================================================= */

  const {
    userId,
  } =
    await request
      .json()
      .catch(
        () => ({}),
      );

  if (!userId) {
    return json(
      {
        message:
          "userId is required",
      },

      400,
    );
  }

  /* =======================================================
     RECORD
  ======================================================= */

  const record =
    await read(userId);

  if (!record) {
    return json(
      {
        message:
          "User device record not found",
      },

      404,
    );
  }

  /* =======================================================
     ALREADY DELETED
  ======================================================= */

  if (
    record.status ===
    "deleted"
  ) {
    return json({
      ok: true,

      alreadyDeleted:
        true,
    });
  }

  /* =======================================================
     SAVE PREVIOUS INFORMATION

     Useful if you want more advanced restore later.
  ======================================================= */

  record.previousStatus =
    record.status || null;

  record.previousApprovedDeviceId =
    record.approvedDeviceId ||
    null;

  record.previousPendingDeviceId =
    record.pendingDeviceId ||
    null;

  /* =======================================================
     SOFT DELETE
  ======================================================= */

  record.status =
    "deleted";

  /*
    Block existing device immediately.
  */

  record.approvedDeviceId =
    null;

  record.pendingDeviceId =
    null;

  record.rejectedDeviceId =
    null;

  record.deletedAt =
    now();

  record.updatedAt =
    now();

  await save(
    userId,
    record,
  );

  return json({
    ok: true,

    status:
      "deleted",
  });
};
