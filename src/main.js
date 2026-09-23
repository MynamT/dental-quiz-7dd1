import {
  createAuthController,
} from "./auth.js";

import {
  createAdminPanel,
} from "./admin.js";

const $ = (id) =>
  document.getElementById(id);

let appLoaded = false;

let admin = null;

let banks = null;

let lastDeviceId = null;

let currentUserId = null;

/* =========================================================
   HIDE QUIZ
========================================================= */

function hideQuiz() {
  $("setupView").classList.add(
    "hidden",
  );

  $("quizView").classList.add(
    "hidden",
  );

  $("resultView").classList.add(
    "hidden",
  );

  $("restartBtn").classList.add(
    "hidden",
  );

  $("adminView").classList.add(
    "hidden",
  );
}

/* =========================================================
   LOAD QUESTIONS
========================================================= */

async function loadQuestions(
  deviceId,
) {
  if (banks) {
    return banks;
  }

  const response =
    await fetch(
      "/.netlify/functions/get-questions",
      {
        headers: {
          "x-device-id":
            deviceId,
        },

        credentials:
          "same-origin",
      },
    );

  const data =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.message ||
        "Unable to load questions.",
    );
  }

  banks = data.banks;

  return banks;
}

/* =========================================================
   OPEN QUIZ
========================================================= */

async function openQuiz(
  deviceId,
  user = null,
) {
  lastDeviceId =
    deviceId;

  if (user?.id) {
    currentUserId =
      user.id;
  }

  hideQuiz();

  const loadedBanks =
    await loadQuestions(
      deviceId,
    );

  window.QUIZ_BANKS =
    loadedBanks;

  /*
    IMPORTANT

    Quiz progress is keyed by the permanent
    Netlify Identity user ID.

    We intentionally do NOT use email because
    email may be changed later.
  */

  window.QUIZ_USER_ID =
    currentUserId;

  if (!appLoaded) {
    await import(
      "./app.js"
    );

    appLoaded = true;
  }

  /*
    app.js exposes this controller.

    This is important if one user logs out
    and another user signs in without
    reloading the browser page.
  */

  if (
    window.DENTAL_QUIZ_APP
      ?.setUser
  ) {
    window.DENTAL_QUIZ_APP.setUser(
      currentUserId,
    );
  }

  $("restartBtn")
    .classList.remove(
      "hidden",
    );
}

/* =========================================================
   AUTH CONTROLLER
========================================================= */

const auth =
  createAuthController({
    /* -------------------------
       NORMAL USER
    ------------------------- */

    async onAllowed({
      user,
      deviceId,
    }) {
      currentUserId =
        user?.id || null;

      await openQuiz(
        deviceId,
        user,
      );
    },

    /* -------------------------
       BLOCKED USER
    ------------------------- */

    onBlocked() {
      hideQuiz();
    },

    /* -------------------------
       LOG OUT
    ------------------------- */

    onLoggedOut() {
      banks = null;

      lastDeviceId =
        null;

      currentUserId =
        null;

      if (
        window.DENTAL_QUIZ_APP
          ?.setUser
      ) {
        window.DENTAL_QUIZ_APP.setUser(
          null,
        );
      }

      hideQuiz();
    },

    /* -------------------------
       ADMIN
    ------------------------- */

    async onAdmin({
      user,
      deviceId,
    }) {
      currentUserId =
        user?.id || null;

      lastDeviceId =
        deviceId;

      hideQuiz();

      $("adminView")
        .classList.remove(
          "hidden",
        );

      admin ||=
        createAdminPanel();

      await admin.load();
    },
  });

/* =========================================================
   ADMIN OPEN QUIZ
========================================================= */

$("adminQuizBtn")
  .addEventListener(
    "click",
    () => {
      openQuiz(
        lastDeviceId,
        {
          id: currentUserId,
        },
      ).catch(
        (error) =>
          alert(
            error.message,
          ),
      );
    },
  );

/* =========================================================
   START AUTH
========================================================= */

auth.init();
