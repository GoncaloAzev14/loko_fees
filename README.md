# FC Lokomotiv · fines and box

Fines and box (caixa) tracker for a club's players and staff. A single responsive React PWA:

- **Anyone, no login** – dashboard (box, total owed, overdue, credit), pick a player to see their debt/credit, filter fines by date / player / reason / status, and a Caixa tab listing every payment, income and expense.
- **Admins (login)** – the same app plus (on phones the centre button of the tab bar logs in; once signed in it becomes a Menu whose options swing up as a stack): register fines (one or many players at once), record payments, income and expenses, manage the fine catalog, the roster and the settings.

Phones get a bottom tab bar, wide screens a sidebar – same code, same screens. The look is the black-and-orange "Locomotiva" direction (Sora font, self-hosted so it works offline). Installable as a PWA, and the last data seen stays readable offline.

## Rules implemented

| Rule | Behaviour |
| --- | --- |
| Due date | A fine is due on **day 7 of the following month** (October fine → 7 Nov). Day is configurable. |
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

## Stack

React 19 + TypeScript + Vite, `vite-plugin-pwa`, TanStack Query, Supabase (Postgres, Auth, row level security).

Security model: row level security lets everyone (including anonymous visitors) **read**; only users listed in `public.admins` can **write**. The anon key in the frontend is therefore safe to ship, but note that anyone with the link can see every member's fines and debts.

## Run locally

Needs Node 20+ and Docker.

```bash
npm install
npx supabase start          # local Postgres + Auth; applies migrations and the demo seed
cp .env.example .env        # then paste the "anon key" (or publishable key) printed by `supabase start`
npm run dev
```

No Docker? `npm run dev:fake` serves a stand-in backend on the same port (in-process Postgres running the same migration and seed, logins `admin@loko.test` / `admin123` and `viewer@loko.test` / `viewer123`; use any value as the anon key). It is only a smoke-test aid, not a replacement for Supabase.

Create an admin (local):

```bash
# 1. create the user (signup is disabled, so use the admin API with the service_role key from `npx supabase status`)
curl -s http://127.0.0.1:54321/auth/v1/admin/users \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"change-me","email_confirm":true}'
# 2. make them an admin
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  -c "insert into admins select id from auth.users where email = 'admin@example.com'"
```

## Deploy

1. Create a Supabase project, then `npx supabase link --project-ref <ref>` and `npx supabase db push`.
2. In Authentication settings, **disable sign-ups** and create your admins under Authentication → Users, then add them to `admins` as above (SQL editor).
3. Optional but recommended: enable the `pg_cron` extension and run `supabase/cron.sql` so late fees are applied daily. Without it they are applied whenever an admin opens the app.
4. Host the `dist/` folder (`npm run build`) on any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages…) with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set, and an SPA fallback to `index.html`.

## Inviting admins from the app

Admin → **Administradores** lets an admin invite someone by email (they get a link to choose a password) and remove admins. This needs a one-time setup on the hosted project:

1. Run `supabase/migrations/20261113000000_admin_management.sql` in the SQL Editor (or `npx supabase db push`).
2. **Authentication → URL Configuration**: set *Site URL* to where the app is hosted and add `<that URL>/set-password` (and `http://localhost:5173/set-password` for local use) to *Redirect URLs*.
3. **Authentication → Emails → SMTP Settings**: connect an email provider (e.g. Resend, free tier). Supabase's built-in sender only delivers to members of your own Supabase organization and is heavily rate limited, so invitations to other people won't arrive without this.
4. Deploy the function (needs a one-time `npx supabase login`):
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase functions deploy invite-admin
   ```

The function (`supabase/functions/invite-admin`) checks that the caller is an admin, then uses the service role key, which Supabase injects on the server and never reaches the browser. If the email already has an account it is promoted instead of invited.

Do not load `supabase/seed.sql` in production: it is demo data.

## Demo data

`supabase/seed.sql` is generated from `Lokomotiv 26-27.xlsx`:

```bash
pip install openpyxl
python scripts/build_seed.py "Lokomotiv 26-27.xlsx"
```

Conversions are documented at the top of `scripts/build_seed.py`. In short: each paid row becomes a payment, prizes/referee gift become income, the sheet's hand-typed box value (124 €) is not reproduced (paid rows add up to 284 € and the sheet lists no expenses, so the demo box shows 284 €), and the typo "Marcus" is fixed to "Marcos".

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run dev:fake`
