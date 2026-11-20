# Development

How to run, test and change the project locally.

- [Testing without touching production](#testing-without-touching-production)
- [Running it](#running-it)
- [Tests](#tests)
- [Changing things](#changing-things)
- [Scripts and generated files](#scripts-and-generated-files)
- [Working with git](#working-with-git)

## Testing without touching production

For day-to-day work use the dummy database. One command starts it and the app together:

```bash
npm run dev:test
```

- The app opens at http://localhost:5174, backed by an in-memory Postgres that runs the real migrations and the demo seed. Production is not involved and cannot be reached: the test address is handed to the app directly, so no `.env` file is read.
- It is **fresh on every start**. Break things freely, press Ctrl+C, run it again.
- A blue strip across the top says "Ambiente de teste · dados fictícios", so a test window is never mistaken for the real one.
- It starts with [demo data](#what-is-in-the-dummy-data) and three test accounts, listed in [the stand-in backend section](#3-the-stand-in-backend-no-docker). "Emails" are printed in the terminal instead of being sent.

### What is in the dummy data

The dummy database starts from [`supabase/seed.sql`](../supabase/seed.sql). **Everything in it is invented**: the names are made up, and the fines, payments and income are produced by a script with a fixed random seed. It describes no real person or club, so it can be shared freely. (Any resemblance to a real name is a coincidence.)

| What | Starting content |
| --- | --- |
| People | 23: 21 players and 2 technical staff, all active |
| Fine types | 9, the club's catalog of rules with default amounts (rules, not personal data) |
| Fines | 71 regular fines and 8 late fees, dated 1 October to 8 November 2026 |
| Payments | 46, adding up to 171 € |
| Income | 2 entries (a prize and a gift), adding up to 140 € |
| Expenses | none |
| Credit | one player has 2 € of credit |
| Settings | late fee 5 €, due day 7, season 2026/27 |
| The box | 311 € in, 0 € out, so 311 € |
| Owed | 117 € in total, of which 43 € overdue, from 15 players |

Three things to know when you look at it:

- **Amounts are fixed, statuses are not.** Whether a fine is *pending* or *overdue* is worked out against today's date, so the split between them changes as time passes. The totals above do not change.
- **Late fees are already in.** The last line of the seed applies the late fees due on 8 November with the real rule, so the demo is consistent with the app. As time passes, opening the app as an admin adds the next ones when they fall due (for November's fines, after 7 December).
- **Everything resets on restart.** Entries you add, fines you cancel and seasons you close are all lost when you stop `npm run dev:test`, which is the point.

To change the starting point, edit the lists at the top of [`scripts/build_seed.py`](../scripts/build_seed.py) or its seed number, and run `python3 scripts/build_seed.py`. The figures above come from the current seed, so regenerating may change them; the tests in `supabase/tests/seed.test.ts` check that the data is consistent, not exact numbers. The test accounts are not in the seed: they are created by `scripts/fake-supabase.mjs`.

### If you run the app against the real project by mistake

`npm run dev` uses whatever is in `.env`. If that points at the hosted Supabase project, the app shows a red strip, **"Atenção: a usar a base de dados REAL"**: everything clicked in that window changes the real data. The published site never shows either strip.

### What the dummy database cannot show you

It imitates Supabase, it is not Supabase. Real email delivery, the exact behaviour of Supabase Auth (codes, invitation links, rate limits) and the Edge Function cannot be tested on it. For those, use a second Supabase project.

### A second Supabase project for realistic testing (optional)

A free Supabase account has allowed two active projects (check the current limit). A second one, kept only for testing, behaves exactly like production but holds nothing real.

1. Create a new project in Supabase (name it for example `loko-fees-test`). Never put real members in it.
2. In its SQL Editor run every file in `supabase/migrations/`, in order, once each. Add the demo data with `supabase/seed.sql` if you want some (never do this in production).
3. Create a user (Authentication, Users, Add user, tick Auto Confirm) and make it the main admin: `insert into admins (user_id, is_owner) select id, true from auth.users where email = 'you@example.com';`
4. Authentication, URL Configuration: set **Site URL** to `http://localhost:5175` and add `http://localhost:5175/set-password` to **Redirect URLs**.
5. To test real emails, set up SMTP and the four email templates here too ([operations](operations.md#supabase-dashboard-settings)). Using your own address as the only invited person keeps it harmless.
6. Deploy the function to it: `npx supabase functions deploy invite-admin --no-verify-jwt --remote=<test project ref>`. Take care to give the **test** project's reference, not production's.
7. Create `.env.staging` (git-ignored) with that project's URL and publishable key:

   ```
   VITE_SUPABASE_URL=https://<test project ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<its publishable key>
   ```

8. Run `npm run dev:staging`. The app opens at http://localhost:5175 with a blue "Ambiente de teste · projeto de teste" strip.

Keep the test project's migrations in step with production: when you add a migration, run it in both.

## Running it

Needs Node 20 or newer. Install once:

```bash
npm install
```

There are three ways to have a backend. For normal work, prefer `npm run dev:test` above, which is the third one set up for you.

### 1. The real Supabase project

Copy `.env.example` to `.env` and fill in the project URL and the publishable key (Supabase, Project Settings, API). Then:

```bash
npm run dev
```

This talks to **production data** if you point it at the live project. Be careful what you press.

### 2. A local Supabase (needs Docker)

```bash
npx supabase start       # Postgres and Auth, applies the migrations and the demo seed
cp .env.example .env     # then paste the key printed by `supabase start`
npm run dev
```

The README's [Run locally](../README.md#run-locally) section shows how to create an admin there.

### 3. The stand-in backend (no Docker)

[`scripts/fake-supabase.mjs`](../scripts/fake-supabase.mjs) is a small server that imitates the parts of Supabase the app uses, on top of an in-process Postgres (PGlite) that runs the real migrations and the demo seed. It is a smoke-test aid, not proof that the hosted setup works: it is not PostgREST and not GoTrue.

```bash
npm run dev:fake         # backend on http://127.0.0.1:54321
npm run dev:fake:web     # the app on http://localhost:5174, in Vite's "fake" mode

# or both in one go, without needing .env.fake:
npm run dev:test
```

`dev:fake:web` reads `.env.fake` (git-ignored) so it never touches your real `.env` or the server on port 5173. Put these two lines in it (the key can be any text):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=anything
```

Accounts it knows:

| Login | Password | What it is |
| --- | --- | --- |
| `admin@loko.test` | `admin123` | The main admin |
| `viewer@loko.test` | `viewer123` | Signed in, not an admin |
| `daniel@loko.test` | none | An invited admin with a pending invitation. On **Primeiro acesso** the emailed code is always `12345678`. |

"Emails" are printed in the backend's console instead of being sent. Inviting a new address creates a pending admin you can then finish through **Primeiro acesso** with the same code.

## Tests

```bash
npm test                 # everything
npm run typecheck        # types only
```

| Where | What | How |
| --- | --- | --- |
| `supabase/tests/` | The database: ledger, late fees (and a deleted one staying deleted), access rules, seasons, admins and invitations, the change record and restoring from it, the demo seed | An in-memory Postgres (PGlite) loads every migration, with a stand-in for Supabase's `auth` schema and roles (`db.ts`). Tests act as `anon` or as a given user. |
| `src/**/*.test.ts` | Pure helpers and the API layer (formatting, seasons, the access-code calls with a mocked client), and the offline queue: its folding rules, saving and sending in order, retries and refusals, what lists show | Plain Vitest, with a stand-in for the Supabase client. |

Nothing tests the screens themselves or the Edge Function against real Supabase. The function has been checked with scripted stand-ins for the Supabase client, but that script is not part of the repository, and the real email behaviour has only been confirmed by using it.

The database tests are heavy. If they time out when run together on a busy machine, run them one file at a time or serially:

```bash
npx vitest run --maxWorkers=1 --testTimeout=120000
```

The workflow runs the tests on every push to `main` and only publishes if they pass.

## Changing things

| To change | Touch |
| --- | --- |
| A rule about money, dates, late fees, seasons | A **new migration** (never edit an old one), and tests in `supabase/tests/` |
| What a screen shows | The page in `src/pages/`, and the hook or `lib/api.ts` function it uses |
| A table or a view's columns | The migration, `src/lib/types.ts`, `lib/api.ts`, then the pages |
| Colours, spacing, layout | `src/styles.css`, which is the whole theme (tokens at the top) |
| Admin menu entries | `src/components/adminLinks.tsx`, which feeds both the sidebar and the phone menu |
| Who can do what | Row level security and functions in a migration. The route guard in the app is only a convenience. |

Two traps:

- **A new migration must also be added in two places** that load them by name: `supabase/tests/db.ts` and `scripts/fake-supabase.mjs`. See [operations](operations.md#writing-a-new-one).
- **Keep rules in the database.** If a number on screen has to be computed, add or extend a view rather than calculating it in the browser, so there is one source of truth.

Notes on the front end:

- The app is mobile first and must not scroll the page itself; only `#root` scrolls. Keep new pages inside that structure.
- Test layouts at phone width, including a short phone, and mind the bottom tab bar and the iPhone safe area. Date inputs need special care on iOS Safari (see the rules at the top of `styles.css`).
- Text shown to people is in European Portuguese.

## Scripts and generated files

| Command | Does |
| --- | --- |
| `npm run backup` | Saves a read-only copy of the live data into `backups/` (git-ignored, private). See [operations](operations.md#backups). |
| `npm run logo` | Rebuilds the logo, app icons and favicon from `branding/original.png` (the club crest). Writes into `public/` and `branding/`. |
| `python3 scripts/build_seed.py` | Regenerates `supabase/seed.sql`, the invented demo data. No dependencies. |

`supabase/seed.sql` is invented demo data. **Never run it on a real club's database.**

## Working with git

- `main` is deployed: every push publishes the website. Work on a branch, merge when it is ready.
- Branch names: `feat/...`, `fix/...`, `docs/...`.
- Commit messages are short, one subject line, no body.
- A merge that needs a migration or a function deploy is not finished until those are done too: see [releasing a change](operations.md#releasing-a-change).
