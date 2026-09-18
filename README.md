# Dental Quiz — Netlify Identity + One Device Approval

This project contains the 1,530-question dental quiz plus:

- Netlify Identity login
- Invite-only accounts
- One approved browser/device token per user
- Manual admin approval for the first device
- Admin device reset
- Netlify Blobs persistent device records
- Protected question data served only after authentication + device approval
- Vite build for Netlify

## Deploy

1. Push this whole folder to your GitHub repository.
2. In Netlify, import that repository.
3. Netlify reads `netlify.toml` automatically:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Functions: `netlify/functions`
4. Enable **Identity** in Netlify.
5. Set Identity registration to **Invite only**.
6. In Netlify environment variables, create:
   - `ADMIN_EMAIL` = your own email address
7. Redeploy after adding `ADMIN_EMAIL`.
8. Invite users from **Identity → Users → Invite users**.

## User flow

1. User receives Netlify invite email.
2. They open the link and create a password.
3. Their first browser/device becomes **pending**.
4. You sign in with the email stored in `ADMIN_EMAIL`.
5. The admin panel shows the pending user.
6. Click **Approve**.
7. User clicks **Check again**.
8. Quiz opens.

If the same account signs in from another browser/device, it is blocked.
Use **Reset device** in the admin panel if a user changes device.

## Important device note

A normal website cannot securely read a physical device serial number. This project creates a cryptographically random browser token with `crypto.randomUUID()` and stores it in `localStorage`. The server, not the browser, decides whether the token is approved. Clearing browser storage or changing browser profiles creates a new device token and requires admin reset/approval.

## Protected questions

The question bank is stored in:

`netlify/functions/data/questions-data.js`

It is not deployed as a public static `questions.js`. The browser receives it only from `get-questions.js` after Netlify Identity and device approval checks succeed.

## Local development

Use Netlify's local runtime because Identity, Functions, and Blobs are Netlify services:

```bash
npm install
npm run dev
```

## Folder structure

```text
dental-quiz-netlify-auth/
├── index.html
├── style.css
├── package.json
├── netlify.toml
├── assets/
├── src/
│   ├── main.js
│   ├── auth.js
│   ├── app.js
│   └── admin.js
└── netlify/
    └── functions/
        ├── _utils.js
        ├── check-device.js
        ├── get-questions.js
        ├── admin-users.js
        ├── approve-device.js
        ├── reset-device.js
        └── data/
            └── questions-data.js
```

The quiz answer keys are preserved from the supplied source banks; this project does not independently correct the medical/dental content.

## Admin access controls in this version

The admin dashboard now supports:

- **Approve** — approve a pending first device.
- **Reject** — reject the current pending device request.
- **Allow new request** — let a rejected user submit a new device on the next sign-in.
- **Reset device** — remove the approved device so the user can register a replacement device.
- **Suspend** — temporarily block an approved account while preserving its approved device.
- **Reactivate** — restore a suspended account on the same approved device.
- **Delete access** — permanently block quiz access in this app and clear registered devices.
- **Restore access** — restore a deleted quiz-access record to the reset state.

### Important distinction: Delete access vs. Delete Netlify Identity user

The **Delete access** button is intentionally a safe app-level delete. It blocks the user from this quiz but does **not** delete the underlying Netlify Identity account. If you want to permanently remove the Identity account itself, delete that user from the Netlify Identity dashboard as well.
