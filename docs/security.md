# Security

What protects the app, what was checked and how, and what is knowingly left open. Written after a review against the usual weak spots of a small login-based app: where the session is kept, whether admin rights are really enforced, two-factor login, rate limiting and password rules.

- [The short version](#the-short-version)
- [What protects what](#what-protects-what)
- [Settings that must stay as they are](#settings-that-must-stay-as-they-are)
- [The content-security policy](#the-content-security-policy)
- [Known gaps](#known-gaps)
- [Checking it again](#checking-it-again)

## The short version

- **Anyone can read** the club's data (fines, debts, the box). That is deliberate and documented. Only **admins can write**.
- That rule is enforced **by the database**, not by the screens. Hiding a button protects nothing; row level security does.
- Admins are added by invitation only. Sign-up is switched off.
- The one significant gap is that there is **no two-factor login** yet.

## What protects what

| Concern | What is in place | Where |
| --- | --- | --- |
| **Who can write** | Row level security on every table, and every admin function checks the caller. A signed-in person who is not an admin is refused, and so is a visitor. Checked on the live project, not just in tests. | [data model](data-model.md#who-can-read-and-write-what) |
| **Admin check in the browser** | Only decides which screens are shown. The offline feature remembers the last answer in the browser, so it can be edited, but the server still refuses anything an impostor sends. | [auth and admins](auth-and-admins.md), [offline](offline.md) |
| **Who can become admin** | Sign-up is off. An invitation gives no rights until the person signs in or chooses a password. The main admin cannot be removed. | [auth and admins](auth-and-admins.md) |
| **Passwords** | At least 10 characters with letters and numbers. Checked in the app for a clear message, and **enforced by the server**, which is what counts. | below, and `lib/password.ts` |
| **Guessing passwords and codes** | Supabase limits sign-in attempts and code checks per IP address, and a new code can be requested about once a minute per email. Codes are 8 digits. | [Settings](#settings-that-must-stay-as-they-are) |
| **Sessions** | Kept in the browser's local storage (the Supabase default). The access token lasts an hour and refresh tokens rotate. | below |
| **Script injection** | The app renders no raw HTML, uses no `eval`, loads no outside scripts, and ships a strict content-security policy. | [policy](#the-content-security-policy) |
| **Finding out who is an admin** | Asking for a code gives the same answer for an address that was not invited, so the list cannot be probed. | [auth and admins](auth-and-admins.md#the-persons-first-access) |
| **Money entered offline** | Kept on the phone with no secrets in it, sent by id so a repeat creates nothing twice, and checked by the server entry by entry. | [offline](offline.md) |

**On the session in local storage.** It is true that a script running on the page could read it, which is why the points above matter: there is no way found for such a script to get in, and the policy would stop it from sending anything out. The usual alternative, cookies the page cannot read, needs a server of our own. This is a static site on GitHub Pages, so it has none. The risk is accepted.

## Settings that must stay as they are

These live in the Supabase dashboard (Authentication), not in the code, so a code change cannot undo them but a click can. They are also listed in [operations](operations.md#supabase-dashboard-settings).

| Setting | Value | Why |
| --- | --- | --- |
| Allow new users to sign up | **Off** | Admins come only by invitation. |
| Minimum password length | **10** | The app asks for 10, but only the server can enforce it against someone calling the API directly. |
| Password requirements | **Letters and digits** | Same. |
| Rate limit for sign-ups and sign-ins | **10 per 5 minutes per IP** (default 30) | A club has a handful of admins; 10 is plenty and slows guessing. |
| Email OTP length | 8 (as it is) | 100 million combinations. The app's code box takes any length, so it follows this setting. |
| Email OTP expiration | `86400` (24 hours) | So an invitation code does not run out the same hour. With 8 digits and the rate limits, guessing it is not realistic. |
| Refresh token rotation | **On** (as it is) | A stolen refresh token stops working once the real one is used. |

The app's rule in `lib/password.ts` and the server's must say the same thing. If you change one, change the other, or the person gets the server's English message (the app translates only the "too weak" refusal).

## The content-security policy

A meta tag in the published page, added by [`vite.config.ts`](../vite.config.ts) at build time only (the dev server needs inline scripts for hot reload). It says the page may run only its own scripts and may talk only to itself and to the Supabase project:

| Rule | Allows |
| --- | --- |
| `script-src 'self'` | Only the site's own script files. No inline script, no `eval`. |
| `connect-src 'self'` + the Supabase address | Requests to the site and to the project, nothing else. The address is taken from `VITE_SUPABASE_URL` at build time, so the policy follows the project. |
| `style-src 'self' 'unsafe-inline'` | Own stylesheets, plus inline styles, which React uses. |
| `img-src`, `font-src` | Own files and `data:` images and fonts. |
| `object-src 'none'`, `base-uri`, `form-action` | No plugins, no `<base>` tricks, forms only back to the site. |

**If something stops loading after a change**, the policy is the first suspect. Adding a script, a font from a CDN, an analytics tool or another API means adding its address in the plugin on purpose. Changing the Supabase URL in the workflow needs no edit: the policy is rebuilt from it.

**How it was tested.** In a real browser (headless Chrome) against a production-style build:

- the normal build loaded the season name and the box amount, with **no** violations;
- a copy with an injected inline script (what an attacker would try) did **not** run it, and the browser logged the refusal;
- a copy with the Supabase address removed from the policy had every data request refused (36), so the test does detect a wrong policy.

Limits: a meta tag cannot set `frame-ancestors`, so it does not stop the site being shown inside another page. GitHub Pages cannot send headers.

## Known gaps

| Gap | Risk | What it would take |
| --- | --- | --- |
| **No two-factor login.** The authenticator-app option is switched on in Supabase but the app has no screens to enrol or use it, and nothing requires it. | A stolen or guessed admin password is enough. Moderate for a club box with few admins. | An enrolment screen (QR code), a code step at sign-in, a decision on whether admin writes should require it, and a recovery plan if an admin loses their phone. A feature of its own. |
| **No per-account lockout and no CAPTCHA.** Limits are per IP address. | An attacker with many addresses can keep guessing a password slowly. | A free CAPTCHA (Cloudflare Turnstile or hCaptcha) on sign-in and first access. |
| **Everyone can read all the data**, including who owes what. | By design, but a link leaked is a list of debts. | Would need a login for visitors, which is a different app. |
| **A "too weak" server refusal is the only one translated.** | A cosmetic English message. | Map more error codes in `lib/password.ts`. |

## Checking it again

Everything below only reads. Do it after changing access rules or auth settings.

**The live auth settings** (pulled into a scratch copy so the project is untouched; it prints what differs from `supabase/config.toml`):

```bash
mkdir -p /tmp/cfg/supabase && cp supabase/config.toml /tmp/cfg/supabase/
npx supabase config pull --remote=<project ref> --workdir /tmp/cfg
grep -E 'enable_signup|minimum_password_length|password_requirements|otp_|sign_in_sign_ups|token_verifications' /tmp/cfg/supabase/config.toml
```

**Who can do what in the database**, as visitor and as signed-in user:

```bash
npx supabase db query --remote --read-only "select c.relname, c.relrowsecurity,
  has_table_privilege('anon', c.oid, 'insert') as visitor_can_insert,
  has_table_privilege('authenticated', c.oid, 'insert') as signed_in_can_insert
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by 1"
```

Every table should show row security on and no visitor insert. Never test by calling the admin functions on production, `close_season` above all: read the permissions instead.

**The policy**: build with a Supabase URL, serve the build, open it in a browser with the console visible, and look for "Refused to…" messages on the pages you changed.
