import questions from "./data/questions-data.js";
import { json, requireUser, verify } from "./_utils.js";

/* =========================================================
   FIX QUESTION IMAGE PATHS
========================================================= */

function normalizeImagePath(image) {
  if (!image) {
    return null;
  }

  // Remove accidental backslashes before underscores
  let fixed = image.replace(/\\_/g, "_");

  // Make assets path absolute from website root
  if (fixed.startsWith("assets/")) {
    fixed = `/${fixed}`;
  }

  return fixed;
}

/* =========================================================
   NORMALIZE ALL QUESTION BANKS
========================================================= */

function normalizeQuestionBanks(banks) {
  const normalizedBanks = {};

  Object.entries(banks).forEach(([bankKey, bank]) => {
    normalizedBanks[bankKey] = {
      ...bank,

      questions: (bank.questions || []).map((question) => ({
        ...question,

        image: normalizeImagePath(question.image),
      })),
    };
  });

  return normalizedBanks;
}

/* =========================================================
   NETLIFY FUNCTION
========================================================= */

export default async (request) => {
  /* -------------------------------------------------------
     METHOD CHECK
  ------------------------------------------------------- */

  if (request.method !== "GET") {
    return json(
      {
        message: "Method not allowed",
      },
      405,
    );
  }

  /* -------------------------------------------------------
     REQUIRE LOGGED-IN USER
  ------------------------------------------------------- */

  const auth = await requireUser();

  if (auth.error) {
    return auth.error;
  }

  /* -------------------------------------------------------
     CHECK DEVICE ACCESS
  ------------------------------------------------------- */

  const deviceId = request.headers.get("x-device-id") || "";

  const access = await verify(auth.user, deviceId);

  if (!access.allowed) {
    return json(
      {
        message:
          access.reason === "pending_approval"
            ? "This device is waiting for approval."
            : "This account is not approved for this device.",

        reason: access.reason,
      },
      403,
    );
  }

  /* -------------------------------------------------------
     FIX ALL IMAGE PATHS
  ------------------------------------------------------- */

  const banks = normalizeQuestionBanks(questions);

  /* -------------------------------------------------------
     SEND QUESTIONS TO FRONTEND
  ------------------------------------------------------- */

  return json({
    banks,
  });
};
