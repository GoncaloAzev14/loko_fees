# Development

How to run, test and change the project locally.

- [Running it](#running-it)
- [Tests](#tests)
- [Changing things](#changing-things)
- [Scripts and generated files](#scripts-and-generated-files)
- [Working with git](#working-with-git)

## Running it

Needs Node 20 or newer. Install once:

```bash
npm install
```

There are three ways to have a backend. Pick one.

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
| `daniel@loko.test` | none | An invited admin with a pending invitation. On **Primeiro acesso** the emailed code is always `123456`. |

"Emails" are printed in the backend's console instead of being sent. Inviting a new address creates a pending admin you can then finish through **Primeiro acesso** with the same code.

## Tests

```bash
npm test                 # everything
npm run typecheck        # types only
```

| Where | What | How |
| --- | --- | --- |
| `supabase/tests/` | The database: ledger, late fees, access rules, seasons, admins and invitations, the demo seed | An in-memory Postgres (PGlite) loads every migration, with a stand-in for Supabase's `auth` schema and roles (`db.ts`). Tests act as `anon` or as a given user. |
| `src/**/*.test.ts` | Pure helpers and the API layer (formatting, seasons, the access-code calls with a mocked client) | Plain Vitest. |

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
| `npm run logo` | Rebuilds the logo, app icons and favicon from `branding/original.png` (the club crest). Writes into `public/` and `branding/`. |
| `python scripts/build_seed.py "Lokomotiv 26-27.xlsx"` | Regenerates `supabase/seed.sql` (demo data) from the club's spreadsheet. Needs `pip install openpyxl`. |

`supabase/seed.sql` is demo data. **Never run it on a real club's database.**

## Working with git

- `main` is deployed: every push publishes the website. Work on a branch, merge when it is ready.
- Branch names: `feat/...`, `fix/...`, `docs/...`.
- Commit messages are short, one subject line, no body.
- A merge that needs a migration or a function deploy is not finished until those are done too: see [releasing a change](operations.md#releasing-a-change).
