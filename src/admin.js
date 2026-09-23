const $ = (id) => document.getElementById(id);

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed (${response.status})`,
    );
  }

  return data;
}

function actionButton(label, className, handler) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = className;
  button.textContent = label;

  button.addEventListener("click", handler);

  return button;
}

export function createAdminPanel() {
  let allUsers = [];
  let currentView = "active";

  /* =========================================================
     CREATE ACTIVE / TRASH SWITCH
  ========================================================= */

  function ensureAdminNavigation() {
    let navigation = document.getElementById(
      "adminUserNavigation",
    );

    if (navigation) {
      return navigation;
    }

    navigation = document.createElement("div");

    navigation.id = "adminUserNavigation";
    navigation.className = "admin-user-navigation";

    const activeButton =
      document.createElement("button");

    activeButton.id = "activeUsersBtn";
    activeButton.type = "button";
    activeButton.className =
      "primary-btn small";

    const trashButton =
      document.createElement("button");

    trashButton.id = "trashUsersBtn";
    trashButton.type = "button";
    trashButton.className =
      "ghost-btn small";

    activeButton.addEventListener(
      "click",
      () => {
        currentView = "active";

        updateNavigation();
        render();
      },
    );

    trashButton.addEventListener(
      "click",
      () => {
        currentView = "trash";

        updateNavigation();
        render();
      },
    );

    navigation.append(
      activeButton,
      trashButton,
    );

    const adminUsers =
      $("adminUsers");

    adminUsers.parentNode.insertBefore(
      navigation,
      adminUsers,
    );

    return navigation;
  }

  /* =========================================================
     UPDATE ACTIVE / TRASH BUTTONS
  ========================================================= */

  function updateNavigation() {
    ensureAdminNavigation();

    const activeUsers =
      allUsers.filter(
        (user) =>
          user.status !== "deleted",
      );

    const deletedUsers =
      allUsers.filter(
        (user) =>
          user.status === "deleted",
      );

    const activeButton =
      $("activeUsersBtn");

    const trashButton =
      $("trashUsersBtn");

    activeButton.textContent =
      `Users (${activeUsers.length})`;

    trashButton.textContent =
      `🗑 Trash (${deletedUsers.length})`;

    if (currentView === "active") {
      activeButton.className =
        "primary-btn small";

      trashButton.className =
        "ghost-btn small";
    } else {
      activeButton.className =
        "ghost-btn small";

      trashButton.className =
        "primary-btn small";
    }
  }

  /* =========================================================
     STATS
  ========================================================= */

  function stats(users) {
    $("adminStats").innerHTML = "";

    const activeUsers =
      users.filter(
        (user) =>
          user.status !== "deleted",
      );

    const deletedUsers =
      users.filter(
        (user) =>
          user.status === "deleted",
      );

    const items = [
      [
        "Active users",
        activeUsers.length,
      ],

      [
        "Pending",
        users.filter(
          (user) =>
            user.status ===
            "pending",
        ).length,
      ],

      [
        "Approved",
        users.filter(
          (user) =>
            user.status ===
            "approved",
        ).length,
      ],

      [
        "Suspended",
        users.filter(
          (user) =>
            user.status ===
            "suspended",
        ).length,
      ],

      [
        "Rejected",
        users.filter(
          (user) =>
            user.status ===
            "rejected",
        ).length,
      ],

      [
        "Trash",
        deletedUsers.length,
      ],
    ];

    items.forEach(
      ([label, value]) => {
        const card =
          document.createElement(
            "div",
          );

        card.className =
          "stat-card";

        const strong =
          document.createElement(
            "strong",
          );

        strong.textContent =
          String(value);

        const span =
          document.createElement(
            "span",
          );

        span.textContent =
          label;

        card.append(
          strong,
          span,
        );

        $("adminStats")
          .appendChild(card);
      },
    );
  }

  /* =========================================================
     RUN ADMIN ACTION
  ========================================================= */

  async function runAction(
    url,
    user,
    confirmText = null,
  ) {
    if (
      confirmText &&
      !confirm(confirmText)
    ) {
      return;
    }

    try {
      await api(url, {
        method: "POST",

        body: JSON.stringify({
          userId: user.userId,
        }),
      });

      await load();
    } catch (error) {
      alert(
        error.message ||
          "Unable to complete action.",
      );
    }
  }

  /* =========================================================
     USER ROW
  ========================================================= */

  function createUserRow(user) {
    const row =
      document.createElement("div");

    row.className = "admin-user";

    /* -------------------------
       USER INFORMATION
    ------------------------- */

    const info =
      document.createElement("div");

    const email =
      document.createElement("div");

    email.className = "email";

    email.textContent =
      user.email ||
      user.userId;

    const meta =
      document.createElement("div");

    meta.className = "meta";

    const pill =
      document.createElement("span");

    pill.className =
      `status-pill ${
        user.status || "reset"
      }`;

    pill.textContent =
      user.status || "reset";

    let preview =
      user.approvedDevicePreview ||
      user.pendingDevicePreview ||
      "not registered";

    const detail =
      document.createTextNode(
        ` · Device ${preview}`,
      );

    meta.append(
      pill,
      detail,
    );

    info.append(
      email,
      meta,
    );

    /* -------------------------
       ACTIONS
    ------------------------- */

    const actions =
      document.createElement("div");

    actions.className =
      "admin-actions";

    /* PENDING */

    if (
      user.status === "pending" &&
      user.hasPending
    ) {
      actions.append(
        actionButton(
          "Approve",
          "primary-btn small",
          () =>
            runAction(
              "/.netlify/functions/approve-device",
              user,
            ),
        ),

        actionButton(
          "Reject",
          "danger-btn small",
          () =>
            runAction(
              "/.netlify/functions/reject-device",
              user,

              `Reject the pending device for ${
                user.email ||
                user.userId
              }?`,
            ),
        ),
      );
    }

    /* APPROVED */

    if (
      user.status === "approved"
    ) {
      actions.append(
        actionButton(
          "Reset device",
          "ghost-btn small",
          () =>
            runAction(
              "/.netlify/functions/reset-device",
              user,

              `Reset the approved device for ${
                user.email ||
                user.userId
              }?`,
            ),
        ),

        actionButton(
          "Suspend",
          "danger-btn small",
          () =>
            runAction(
              "/.netlify/functions/suspend-user",
              user,

              `Suspend quiz access for ${
                user.email ||
                user.userId
              }?`,
            ),
        ),
      );
    }

    /* SUSPENDED */

    if (
      user.status === "suspended"
    ) {
      actions.append(
        actionButton(
          "Reactivate",
          "primary-btn small",
          () =>
            runAction(
              "/.netlify/functions/reactivate-user",
              user,
            ),
        ),

        actionButton(
          "Reset device",
          "ghost-btn small",
          () =>
            runAction(
              "/.netlify/functions/reset-device",
              user,
            ),
        ),
      );
    }

    /* REJECTED */

    if (
      user.status === "rejected"
    ) {
      actions.append(
        actionButton(
          "Allow new request",
          "primary-btn small",
          () =>
            runAction(
              "/.netlify/functions/allow-new-request",
              user,
            ),
        ),
      );
    }

    /* RESET */

    if (
      user.status === "reset"
    ) {
      const note =
        document.createElement(
          "span",
        );

      note.className = "muted";

      note.textContent =
        "Waiting for the user to sign in on a device.";

      actions.appendChild(note);
    }

    /* -------------------------
       TRASH USER
    ------------------------- */

    if (
      user.status === "deleted"
    ) {
      actions.append(
        actionButton(
          "↩ Restore",
          "primary-btn small",
          () =>
            runAction(
              "/.netlify/functions/restore-access",
              user,

              `Restore quiz access for ${
                user.email ||
                user.userId
              }?`,
            ),
        ),
      );
    }

    /* -------------------------
       ACTIVE USER DELETE
    ------------------------- */

    if (
      user.status !== "deleted"
    ) {
      actions.append(
        actionButton(
          "🗑 Delete",
          "danger-btn small",
          () =>
            runAction(
              "/.netlify/functions/delete-access",
              user,

              `Move ${
                user.email ||
                user.userId
              } to Trash?\n\nThey will immediately lose quiz access. Their Netlify Identity account will NOT be deleted.`,
            ),
        ),
      );
    }

    row.append(
      info,
      actions,
    );

    return row;
  }

  /* =========================================================
     RENDER USERS
  ========================================================= */

  function render() {
    $("adminUsers").innerHTML =
      "";

    updateNavigation();

    let visibleUsers;

    if (
      currentView === "trash"
    ) {
      visibleUsers =
        allUsers.filter(
          (user) =>
            user.status ===
            "deleted",
        );
    } else {
      visibleUsers =
        allUsers.filter(
          (user) =>
            user.status !==
            "deleted",
        );
    }

    /* -------------------------
       EMPTY ACTIVE LIST
    ------------------------- */

    if (
      !visibleUsers.length &&
      currentView === "active"
    ) {
      $("adminUsers").innerHTML =
        '<p class="muted">No active user device records yet.</p>';

      return;
    }

    /* -------------------------
       EMPTY TRASH
    ------------------------- */

    if (
      !visibleUsers.length &&
      currentView === "trash"
    ) {
      $("adminUsers").innerHTML =
        '<p class="muted">Trash is empty.</p>';

      return;
    }

    visibleUsers.forEach(
      (user) => {
        $("adminUsers").appendChild(
          createUserRow(user),
        );
      },
    );
  }

  /* =========================================================
     LOAD USERS
  ========================================================= */

  async function load() {
    $("adminUsers").innerHTML =
      '<p class="muted">Loading…</p>';

    try {
      const data =
        await api(
          "/.netlify/functions/admin-users",
        );

      allUsers =
        Array.isArray(data.users)
          ? data.users
          : [];

      stats(allUsers);

      ensureAdminNavigation();

      updateNavigation();

      render();
    } catch (error) {
      $("adminUsers").innerHTML =
        '<p class="status-message error"></p>';

      $("adminUsers").firstChild.textContent =
        error.message;
    }
  }

  $("refreshAdminBtn")
    .addEventListener(
      "click",
      load,
    );

  return {
    load,
  };
}
