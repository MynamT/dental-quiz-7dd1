import {
  getStore,
} from "@netlify/blobs";

import {
  getUser,
} from "@netlify/identity";

export const STORE =
  "dental-quiz-devices";

/* =========================================================
   JSON RESPONSE
========================================================= */

export const json = (
  data,
  status = 200,
) =>
  Response.json(
    data,
    {
      status,

      headers: {
        "cache-control":
          "no-store",
      },
    },
  );

/* =========================================================
   REQUIRE LOGIN
========================================================= */

export async function requireUser() {
  const user =
    await getUser();

  return user
    ? {
        user,
      }
    : {
        error:
          json(
            {
              message:
                "Unauthorized",
            },
            401,
          ),
      };
}

/* =========================================================
   ADMIN CHECK
========================================================= */

export function isAdmin(
  user,
) {
  const adminEmail =
    (
      process.env
        .ADMIN_EMAIL ||
      ""
    )
      .trim()
      .toLowerCase();

  return (
    !!adminEmail &&
    String(
      user.email ||
        "",
    ).toLowerCase() ===
      adminEmail
  );
}

/* =========================================================
   BLOB STORE
========================================================= */

export const store =
  () =>
    getStore(STORE);

/* =========================================================
   READ USER RECORD
========================================================= */

export async function read(
  userId,
) {
  return store().get(
    `user:${userId}`,
    {
      type: "json",

      consistency:
        "strong",
    },
  );
}

/* =========================================================
   SAVE USER RECORD
========================================================= */

export async function save(
  userId,
  record,
) {
  await store().setJSON(
    `user:${userId}`,
    record,
  );
}

/* =========================================================
   DEVICE PREVIEW
========================================================= */

export function preview(id) {
  return id
    ? `${id.slice(
        0,
        6,
      )}…${id.slice(-4)}`
    : "";
}

/* =========================================================
   TIME
========================================================= */

export function now() {
  return new Date().toISOString();
}

/* =========================================================
   VERIFY QUIZ ACCESS
========================================================= */

export async function verify(
  user,
  deviceId,
) {
  /* ADMIN */

  if (isAdmin(user)) {
    return {
      allowed: true,
      isAdmin: true,
      reason: "admin",
    };
  }

  /* NO DEVICE */

  if (!deviceId) {
    return {
      allowed: false,
      reason:
        "missing_device",
    };
  }

  const record =
    await read(
      user.id,
    );

  /* NO RECORD */

  if (!record) {
    return {
      allowed: false,
      reason:
        "not_registered",
    };
  }

  /* DELETED */

  if (
    record.status ===
    "deleted"
  ) {
    return {
      allowed: false,
      reason:
        "deleted",
      record,
    };
  }

  /* SUSPENDED */

  if (
    record.status ===
    "suspended"
  ) {
    return {
      allowed: false,
      reason:
        "suspended",
      record,
    };
  }

  /* REJECTED */

  if (
    record.status ===
    "rejected"
  ) {
    return {
      allowed: false,
      reason:
        "rejected",
      record,
    };
  }

  /* APPROVED DEVICE */

  if (
    record.status ===
      "approved" &&
    record.approvedDeviceId ===
      deviceId
  ) {
    return {
      allowed: true,
      reason:
        "approved",
      record,
    };
  }

  /* PENDING DEVICE */

  if (
    record.status ===
      "pending" &&
    !record.approvedDeviceId &&
    record.pendingDeviceId ===
      deviceId
  ) {
    return {
      allowed: false,

      reason:
        "pending_approval",

      record,
    };
  }

  /* WRONG DEVICE */

  return {
    allowed: false,

    reason:
      "different_device",

    record,
  };
}
