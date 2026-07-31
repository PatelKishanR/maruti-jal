# Module 0 — Authentication & Account

**Goal:** keep the business data behind a login, and give the owner control of their own account — without building infrastructure a one-person tool doesn't need.

---

## 1. In plain English

The app holds every rupee, jar and coin the business has moved. It sits on a public URL. So it needs a login.

But there is exactly **one user** (PRD decision D2), so this module deliberately does *not* include sign-up, team invitations, social login, or two-factor authentication. It is one screen to get in, plus the handful of account controls a single admin genuinely needs: change your password, switch your language, switch your theme, sign out.

Everything else in the app assumes you are signed in. This is the only module that renders outside the application shell.

---

## 2. User stories

| # | As the admin, I want to… | So that… |
|---|---|---|
| A1 | sign in with my email and password | my business data isn't open to anyone with the URL |
| A2 | see the login page in Gujarati if I prefer | the app is usable in my language from the very first screen |
| A3 | be told clearly when my details are wrong | I know to try again rather than assume the app is broken |
| A4 | stay signed in on my own device | I'm not retyping a password twenty times a day |
| A5 | be signed out automatically after a long idle period | a phone left on a counter isn't an open till |
| A6 | be returned to the page I wanted after signing in | a bookmarked order link still works when my session has expired |
| A7 | change my password | I can rotate it if I think it's been seen |
| A8 | set my default language and theme | the app opens the way I want it every time |
| A9 | sign out deliberately | I can hand the laptop to someone else |
| A10 | recover access if I forget my password | one forgotten password doesn't lock me out of my own business |

---

## 3. Screens

| Route | Screen | Shell |
|---|---|---|
| `/login` | Sign in | **No app shell** — standalone |
| `/settings/account` | Profile & preferences | Inside the shell |
| Modal | Change password | Inside the shell |
| Dialog | Session expired | Overlays whatever page you were on |
| Dialog | Forgot password | On the login page |

---

## 4. Form — Sign in

| Field | Type | Required | Notes |
|---|---|---|---|
| Email | email | ✅ | Autofocused on load. Trimmed and lower-cased before submission |
| Password | password | ✅ | Show/hide toggle |
| Keep me signed in | checkbox | — | Off by default. On = 30-day session; off = 12 hours |

Submit: `Sign in`.
Below: `Forgot password?`
Top-right of the page: the `EN | ગુ` language toggle.

---

## 5. Business rules

### 5.1 Error messages never reveal whether an account exists

A wrong password and an unknown email produce the **identical** message and the **identical** response time:

> Email or password is incorrect.

Saying "no account with that email" tells an attacker which addresses are worth attacking. The login check performs the same work whether or not the user exists, so timing can't be used to enumerate accounts either ([ARCHITECTURE.md](../ARCHITECTURE.md) §10.3).

### 5.2 Rate limiting

After **5 failed attempts** from one IP within 15 minutes, further attempts are rejected for 15 minutes with a clear message and a countdown. This is the only defence a single-account app has against a password-guessing attack, so it is not optional.

Successful sign-in resets the counter.

### 5.3 Sessions

| Setting | Value |
|---|---|
| Default session | 12 hours |
| With "Keep me signed in" | 30 days |
| Idle timeout | None — the app is used in bursts throughout the day, and a timeout that logs the owner out mid-order is worse than useless |
| Storage | Signed JWT in an `httpOnly`, `secure`, `sameSite=lax` cookie |

Signing out clears the cookie and returns to `/login`.

### 5.4 Redirect after sign-in

If the user hit a protected URL while signed out, the destination is preserved and they land there after signing in. Otherwise they land on the dashboard.

The stored destination must be a **relative path within this app** — an absolute URL is discarded. Otherwise the login page becomes an open redirect that can be used to send someone to a convincing fake.

### 5.5 No self-registration

There is no sign-up screen. The first account is created by the database seed. Additional accounts, if the owner ever wants a manager login, are created from within the app by an existing admin.

### 5.6 Password rules

Minimum 8 characters. No composition requirements — no forced symbol, no forced digit. Those rules push people towards `Password1!` and a sticky note; length is what matters. The change-password form shows a simple strength hint rather than blocking.

Changing a password requires entering the current one, and invalidates all other sessions.

### 5.7 Password recovery

**Version 1 has no email-based reset**, because the app has no email provider configured and adding one is a real infrastructure decision rather than a small feature.

`Forgot password?` therefore opens a dialog explaining that recovery is performed from the server, with the exact command to run. For a single-owner tool where that person has server access, this is honest and sufficient.

> **Open question for the owner:** if you'd rather have a proper "email me a reset link" flow, that needs an email provider (Resend, SES or similar) added to the architecture. Say the word and it becomes a small additive change — a token table, one email template, and two screens.

---

## 6. Profile & preferences

| Field | Type | Notes |
|---|---|---|
| Name | text | Shown in the user menu and stamped on audit records |
| Email | email | Used to sign in. Changing it requires the current password |
| Language | segmented | English / ગુજરાતી. Applies immediately, no reload |
| Theme | segmented | Light / Dark / System |
| Change password | button | Opens the modal |

Also shown, read-only: last sign-in time, and the account's role.

---

## 7. What this module deliberately does not do

| Excluded | Why |
|---|---|
| Sign-up / self-registration | One user. An open sign-up form on a business app is a liability, not a feature |
| Social login (Google, etc.) | Adds a third-party dependency and an OAuth flow to save one password field |
| Two-factor authentication | Reasonable to add later; not worth the setup friction for a single-user internal tool at this stage |
| Email verification | There is nothing to verify — the account is created directly by the owner |
| Team management, roles UI | The role column exists in the schema, but no second user exists to assign one to |

Each of these is additive if the business grows. None of them earns its complexity today.
