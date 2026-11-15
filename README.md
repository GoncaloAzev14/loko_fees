# FC Lokomotiv · fines and box

[![Deploy](https://github.com/GoncaloAzev14/loko_fees/actions/workflows/deploy.yml/badge.svg)](https://github.com/GoncaloAzev14/loko_fees/actions/workflows/deploy.yml)

Fines and box (caixa) tracker for a club's players and staff: a single responsive web app that installs on a phone like an app.
Anyone can look things up without logging in; admins log in to register fines and payments.

**Live site:** https://goncaloazev14.github.io/loko_fees/

**Documentation:** [docs/](docs/README.md): [architecture](docs/architecture.md) · [data model](docs/data-model.md) · [sign-in and admins](docs/auth-and-admins.md) · [operations](docs/operations.md) · [development](docs/development.md) · [offline](docs/offline.md)

**Contents:** [Deploy, step by step](#deploy-step-by-step) · [Updating later](#updating-later) · [Starting with real data](#starting-with-real-data) · [Troubleshooting](#troubleshooting) · [What the app does](#what-the-app-does) · [Rules implemented](#rules-implemented) · [Run locally](#run-locally) · [Demo data](#demo-data) · [Scripts](#scripts)

---

## Deploy, step by step

The app has two halves, and you set up both:

| Half | Lives on | Holds |
| --- | --- | --- |
| **Backend** | [Supabase](https://supabase.com) (free plan is enough) | database, admin login, invitation emails |
| **Website** | **GitHub Pages** (free) | the app itself, rebuilt and published by a GitHub Action on every push to `main` |

First time takes about 30 minutes. You need a GitHub account, a Supabase account, and Node 20+ on your computer (only for steps 5 and the optional local run).
Below, `<ref>` is your Supabase project reference (the part before `.supabase.co`), `<user>` your GitHub user and `<repo>` the repository name.

### 1. Create the Supabase project

1. On supabase.com choose **New project**. Pick a name, a region close to you (e.g. West EU) and a database password (**save it**; you need it in step 5).
2. In the creation form leave **Enable Data API** ticked. It is fine to untick *Automatically expose new tables*: the SQL below grants exactly the access it needs.
3. Wait about 2 minutes until the project is ready.

### 2. Create the database

Open **SQL Editor → New query**, paste the **whole contents** of each file below, and click **Run**. Run them **in this order, each only once**:

| # | File in `supabase/migrations/` | What it does |
| --- | --- | --- |
| 1 | `20261112000000_init.sql` | tables, access rules (everyone reads, only admins write), the fines ledger views, late-fee function |
| 2 | `20261113000000_admin_management.sql` | list, remove and promote admins from the app |
| 3 | `20261114000000_season_archive_and_reset.sql` | the season name, closing a season with an archive, deleting unused players and fine types |
| 4 | `20261115000000_admin_pending.sql` | the helpers behind the pending-invitation list and resending a code |
| 5 | `20261116000000_admin_accept_invite.sql` | an invited person is only an admin after their first sign-in or after choosing a password; until then the invitation is pending |
| 6 | `20261117000000_main_admin.sql` | the first admin is marked as the main admin and cannot be removed from the app |

(Prefer the command line? `npx supabase link --project-ref <ref>` then `npx supabase db push` applies the same files.)

Check it worked by running this in a new query. You should get `2026/27`, `0`, and `true`:

```sql
select season from settings;
select count(*) from season_archive;
select has_table_privilege('authenticated', 'public.players', 'DELETE');
```

> **Do not run `supabase/seed.sql` for a real club.** It is invented demo data for development and tests. See [Starting with real data](#starting-with-real-data).

### 3. Login: admins and URLs

1. **Authentication → Sign In / Providers**: turn **off** *Allow new users to sign up*. Admins are created by you, never by visitors.
2. **Authentication → Users → Add user → Create new user**: enter your email and a password and tick **Auto Confirm User**.
3. Make that user an admin. In the **SQL Editor** run (with your email):

   ```sql
   insert into admins (user_id, is_owner) select id, true from auth.users where email = 'you@example.com';
   ```

   `is_owner` makes you the main admin, who can never be removed from the app.

   A person who can log in but is not in `admins` sees the public screens only and cannot change anything.
4. **Authentication → URL Configuration**:
   - **Site URL**: `https://<user>.github.io/<repo>/`
   - **Redirect URLs**: add `https://<user>.github.io/<repo>/set-password` (and `http://localhost:5173/set-password` if you also run it locally).

   These make the link in admin invitation emails open the right page.

### 4. Emails for admin invitations

Supabase's built-in sender only delivers to members of your own Supabase organization and is heavily rate limited, so connect your own SMTP: **Authentication → Emails → SMTP Settings → Enable custom SMTP**, fill in the form, **Save**.

**Option A: a Gmail account** (simplest, no domain needed). Turn on 2-Step Verification, then create an app password at https://myaccount.google.com/apppasswords (a 16-character code; it only works for normal `@gmail.com` accounts).

| Field | Value |
| --- | --- |
| Sender email / Username | the Gmail address |
| Sender name | FC Lokomotiv |
| Host / Port | `smtp.gmail.com` / `465` |
| Password | the 16-character app password |

**Option B: Resend** (needs a domain you own, verified with a DNS record): host `smtp.resend.com`, port `465`, username `resend`, password = your Resend API key, sender = an address on the verified domain.

You can skip this step if you never invite admins from the app (you can always add one by hand as in step 3).

### 4b. Put a code in the invitation emails

An invitation link works only once, and email scanners (Outlook is known for it) sometimes use it up before the person clicks. So the app also has a **Primeiro acesso** page (reached from the login screen) where anyone can ask for a **code** and choose a password with it, as many times as needed. For that, the emails must show the code.

**Authentication → Emails → Templates.** Open each of **Invite user**, **Confirm signup**, **Magic link** and **Reset password**, replace the body with the text below, and **Save**:

```html
<h2>FC Lokomotiv</h2>
<p>O seu código de acesso:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p>Na app, escolha <b>Entrar → Primeiro acesso</b>, escreva o seu email e este código, e escolha a palavra-passe.</p>
<p>Em alternativa, <a href="{{ .ConfirmationURL }}">abra esta ligação</a> (só funciona uma vez).</p>
```

Also open **Authentication → Sign In / Providers → Email** and raise **Email OTP Expiration** to `86400` (24 hours) so a code does not run out the same hour.

### 5. Deploy the invite function

This small server-side function sends the invitation. Run it once from the project folder:

```bash
npm install
npx supabase login                                  # opens the browser once
npx supabase link --project-ref <ref>               # asks for the database password from step 1
npx supabase functions deploy invite-admin
```

Docker is not needed for this. If inviting later fails with *Invalid JWT*, deploy again with `--no-verify-jwt`.

### 6. Optional: apply late fines every day

Late fines are always applied when an admin opens the app. To have them applied daily even if nobody opens it: **Database → Extensions → enable `pg_cron`**, then run `supabase/cron.sql` once in the SQL Editor.

### 7. Point the website at your Supabase project

In Supabase open **Project Settings → API Keys** and copy:

- the **Project URL** (`https://<ref>.supabase.co`) and
- the **Publishable key** (`sb_publishable_…`; the older "anon" key also works).

Put them in `.github/workflows/deploy.yml`, in the build step:

```yaml
VITE_SUPABASE_URL: https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY: sb_publishable_xxxxxxxx
```

These two values are public by design: they ship inside the website, and what visitors may do is enforced by the database's access rules. **Never** put the **secret** / `service_role` key anywhere in this repository.

### 8. Publish on GitHub Pages

1. Create the GitHub repository and push this project to its `main` branch.
2. In the repo go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. (Do this before the first run; otherwise the first run fails and you re-run it afterwards.)
3. Push to `main` (or **Actions → Deploy to GitHub Pages → Run workflow**). The workflow runs the tests, builds the site and publishes it. Follow it in the **Actions** tab; it takes about 2 minutes.
4. Your site is at `https://<user>.github.io/<repo>/`. The workflow sets the base path from the repository name automatically.

Good to know: GitHub Pages has no single-page-app fallback, so the workflow copies `index.html` to `404.html`; that is what makes refreshing on a sub-page work.

### 9. Check that it all works

- [ ] The home page opens without logging in and shows the box total.
- [ ] The header says **FC Lokomotiv 2026/27**.
- [ ] You can log in (centre button **Entrar**) and the centre button becomes **Menu**.
- [ ] Menu → **Registar multa**: register a test fine; it shows up under **Multas**.
- [ ] Menu → **Pagamentos**: record a payment; the player's debt drops.
- [ ] Menu → **Administradores**: invite a second email and check the email arrives (also look in spam).
- [ ] On a phone, open the site and use *Add to Home Screen* (or *Install app*).

---

## Updating later

| You changed | Do this |
| --- | --- |
| The app (anything under `src/`) | Push to `main`. The Action rebuilds and republishes in about 2 minutes. On phones, reload twice (or reinstall the app) to see a new icon. |
| The database (a new file in `supabase/migrations/`) | Run that file once in the Supabase **SQL Editor**, **before** pushing the app code that needs it. |
| The invite function (`supabase/functions/`) | `npx supabase functions deploy invite-admin` |
| Which Supabase project to use | Edit the two `VITE_SUPABASE_*` lines in `.github/workflows/deploy.yml` and push. |
| The repository name | Nothing: the base path follows the name. If you use a `<user>.github.io` repository (no sub-path), set `BASE_PATH: /` in the workflow. |

## Starting with real data

If you loaded the demo seed while testing, clear it before the club starts using the app. In the **SQL Editor**:

```sql
truncate public.fines, public.payments, public.incomes, public.expenses, public.players, public.fine_types;
```

This keeps your settings, admins and season. Then add the real fine types (**Menu → Tipos de multa**) and members (**Menu → Plantel**).

At the end of each season use **Menu → Definições → Fechar época**: it archives a summary, clears fines and payments, and starts the next season while the cash in the box carries over.

## Troubleshooting

| What you see | Why and what to do |
| --- | --- |
| Login says *Email ou palavra-passe incorretos* with the right password | The site is talking to a different backend than you think (open the browser console and look at the URL of the failing request; it must be your `https://<ref>.supabase.co`). Check the two `VITE_SUPABASE_*` values; for local runs check `.env`, then restart `npm run dev`. |
| You log in but there is no **Menu** / admin screens | The account is not in `admins`. Run the `insert into admins …` from step 3. |
| Console shows `400` on `settings?select=…season…` or `404` on `season_archive` | Migration 3 has not been run yet (step 2). The app keeps working meanwhile, but the season name, **Fechar época** and the archive stay inactive. |
| *Não foi possível carregar os dados* everywhere after a quiet period | Free Supabase projects pause after about a week without activity. Open the Supabase dashboard and click **Restore project**. |
| The invitation email never arrives | Check the SMTP settings (step 4), look in spam, and remember the limit of 30 emails per hour. Without custom SMTP only members of your Supabase organization receive mail. |
| The invitation link says expired or opens the wrong page | Links are single-use and can be used up by email scanners. The person opens the app, chooses **Entrar → Primeiro acesso**, asks for a code and sets the password there. Or an admin presses **Reenviar convite** on **Administradores**. Also check **Site URL** and **Redirect URLs** (step 3.4). |
| An invited person shows as *Convite pendente* and cannot see admin screens | By design: an invitation only becomes admin access when the person signs in with their password or chooses one on **Primeiro acesso**. Use **Reenviar convite** to send a new code, or **Cancelar convite** to withdraw it. |
| The email has a link but no code | The email templates were not updated: step 4b. |
| *Código inválido ou expirado* | The code is only valid for a limited time and only the latest one works. Ask for a new one on **Primeiro acesso**. |
| Inviting says *O convite foi enviado, mas não foi possível dar acesso de administrador* (older versions: *falhou a atribuição*) | The invitation email went out but the account was not added to `admins`. Redeploy the function (`npx supabase functions deploy invite-admin --no-verify-jwt`) and make sure migration 2 (`…_admin_management.sql`) was run. To fix a person already invited, run `insert into admins select id from auth.users where email = 'their@email' on conflict do nothing;` in the SQL Editor. |
| Inviting fails with *Invalid JWT* | Redeploy the function with `npx supabase functions deploy invite-admin --no-verify-jwt`. |
| The deploy Action fails at *Get Pages site* | Pages is not enabled for Actions. Settings → Pages → Source: **GitHub Actions**, then **Re-run all jobs**. |
| The deploy Action fails at the tests | Fix the failing test first; the workflow only publishes when `npm test` passes. |
| White page, or files not found, after deploying | The base path does not match the URL. Project sites live under `/<repo>/` (automatic); a `<user>.github.io` repository needs `BASE_PATH: /`. |
| The phone still shows the old icon or version | The installed app caches aggressively: reload twice, or remove it from the home screen and add it again. |

---

## What the app does

- **Anyone, no login:** dashboard (box, total owed, overdue, credit); open a player in the **Jogadores** tab to see their debt and credit; filter fines by date, player, reason and status; a **Caixa** tab listing every payment, income and expense.
- **Admins (login):** the same app plus register fines (one or many players at once), record payments, income and expenses, manage the fine catalog, the roster, admins and the settings, close a season and browse the archive. On phones the centre button of the tab bar logs in; once signed in it becomes a **Menu** whose options swing up as a stack.

Phones get a bottom tab bar, wide screens a sidebar: same code, same screens. The look is the black-and-orange "Locomotiva" direction (Sora font, self-hosted so it works offline). Installable as a PWA. It works offline: the last data seen stays readable, and an admin's fines, payments, income and expenses are saved on the phone and sent when the connection returns (see [docs/offline.md](docs/offline.md)).

**Stack:** React 19 + TypeScript + Vite, `vite-plugin-pwa`, TanStack Query, Supabase (Postgres, Auth, Edge Functions, row level security).

**Security model:** row level security lets everyone (including anonymous visitors) **read**; only users listed in `public.admins` can **write**. The publishable key in the website is therefore safe to ship, but note that anyone with the link can see every member's fines and debts.

## Rules implemented

| Rule | Behaviour |
| --- | --- |
| Due date | A fine is due on **day 7 of the following month** (October fine → 7 Nov). The day is configurable in Definições. |
| Late fine | Once per player per month, a flat fee (default 5 €, configurable) is added automatically after the due date if the player still owes any of that month's fines. |
| Statuses | `pending`, `overdue` (automatic after the due date), `paid`, `cancelled` (admin correction). |
| Payments | Recorded per player, any amount. They settle the player's **oldest fines first**; partial payments are possible and any surplus is **credit**. |
| Box | payments + income (prizes, donations) − expenses. |
| Catalog | Each fine type has a default amount; it can be changed on each individual fine. |
| Season | The app is called "FC Lokomotiv <season>" (e.g. 2026/27). Definições → Época only edits that name. |
| Closing a season | Definições → *Fechar época* (typed confirmation) archives a summary, then clears fines, payments, income and expenses and starts the next season. The cash in the box carries over; unpaid fines and player credit do **not** (they are in the archive). Players and fine types stay. |
| Archive | *Arquivo de épocas* (admins only) keeps, per closed season, the totals, one line per player and one per fine type. Not every individual fine. |
| Deleting | Admins can delete players and fine types, but only while nothing uses them (a player with fines or payments, or a fine type used by a fine, is refused). Otherwise mark them inactive, or close the season and then delete. Single fines and payments can always be deleted. |

The ledger logic lives in SQL views (`supabase/migrations`), so the app has a single source of truth and no duplicated calculations. The SQL is tested in-process with PGlite (`npm test`).

## Run locally

Needs Node 20+ and Docker.

```bash
npm install
npx supabase start          # local Postgres + Auth; applies migrations and the demo seed
cp .env.example .env        # then paste the "anon key" (or publishable key) printed by `supabase start`
npm run dev
```

Create an admin (local):

```bash
# 1. create the user (signup is disabled, so use the admin API with the service_role key from `npx supabase status`)
curl -s http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"change-me","email_confirm":true}'
# 2. make them an admin
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "insert into admins (user_id, is_owner) select id, true from auth.users where email = 'admin@example.com'"
```

**Just want to try things safely?** `npm run dev:test` starts a dummy database and the app together, with no access to production data (see [docs/development.md](docs/development.md#testing-without-touching-production)).

**No Docker?** `npm run dev:fake` serves a stand-in backend on the same port (an in-process Postgres running the same migrations and seed; logins `admin@loko.test` / `admin123` and `viewer@loko.test` / `viewer123`; use any value as the key). It is only a smoke-test aid, not a replacement for Supabase. To point a second copy of the app at it without touching your real `.env`, put the same two variables in `.env.fake` (git-ignored) and run `npm run dev:fake:web` (port 5174, `--mode fake`).

## Demo data

`supabase/seed.sql` is **invented**: made-up names and a random (fixed-seed) set of fines, payments and income, so it describes no real person. It is generated by a script with no dependencies:

```bash
python3 scripts/build_seed.py
```

The last line of the seed applies the late fees with the real rule, so the demo matches what the app does. Regenerating can give slightly different figures; the tests check that the data is consistent, not exact numbers. Never load it into a real club's database.

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run dev:fake` · `npm run dev:fake:web` · `npm run logo`

`npm run logo` rebuilds the logo and app icons from `branding/original.png` (the club crest): it cuts the crest out of its black background, upscales it, and writes `branding/logo-source.png`, `public/logo.png` and the PWA/favicon icons in `public/`.
