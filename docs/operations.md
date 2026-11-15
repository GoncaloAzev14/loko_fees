# Operations

How the live system is changed and kept healthy. The first-time setup is a step-by-step guide in the [README](../README.md#deploy-step-by-step); this page is the reference for afterwards.

- [What lives where](#what-lives-where)
- [Releasing a change](#releasing-a-change)
- [Database migrations](#database-migrations)
- [The Edge Function](#the-edge-function)
- [Supabase dashboard settings](#supabase-dashboard-settings)
- [Daily late fees](#daily-late-fees)
- [Looking at production](#looking-at-production)

## What lives where

| Thing | Where | Changed by |
| --- | --- | --- |
| The website | GitHub Pages | pushing to `main` (automatic) |
| Tables, views, functions, access rules | Supabase Postgres | running a migration file in the SQL Editor |
| Invitations | Supabase Edge Function `invite-admin` | `npx supabase functions deploy` |
| Logins, email sending, templates, URLs | Supabase Auth settings | the Supabase dashboard |
| The Supabase URL and publishable key used by the site | [`deploy.yml`](../.github/workflows/deploy.yml) | editing the workflow |

Three of these are **not** touched by a push to `main`: the database, the function and the dashboard settings. Forgetting that is the most common way to ship something that half works.

## Releasing a change

Do the parts a change needs, in this order:

1. **Database first.** If the change adds a migration file, run it in the SQL Editor *before* the new app code goes live. The app tolerates a few missing columns (it falls back for `season`, `pending`, `is_owner`) but not a missing function.
2. **Edge Function.** If `supabase/functions/` changed, deploy it.
3. **Push to `main`.** The workflow runs the tests, builds and publishes in about two minutes.
4. **Reopen the app** on phones. An installed iPhone app needs to be closed and reopened twice to load the new version.

A change that only touches `src/` needs step 3 only.

## Database migrations

The database is built from the files in `supabase/migrations/`, which are append-only: **never edit a migration that has been run**, add a new one. The list and what each adds is in [data model](data-model.md#migration-history).

### Applying one

1. Supabase dashboard, **SQL Editor, New query**.
2. Paste the **whole** file and press **Run**. Each file is run once only.
3. Check it, with a query that proves the new thing exists (each migration's README row says what changes).

### Why `supabase db push` does not work here

The project was set up by pasting the files into the SQL Editor, so Supabase's own list of applied migrations is **empty**. `npx supabase db push` would therefore try to run all of them again and fail on the first. If you want to use the command line, first mark the existing files as applied with `npx supabase migration repair --status applied <version>` for each one (this edits production's history table, so do it on purpose). Until then, paste into the SQL Editor.

### Writing a new one

- New file `supabase/migrations/<timestamp>_<name>.sql`, later than the last.
- Add it to the list in `supabase/tests/db.ts` **and** to `scripts/fake-supabase.mjs`. Both load the migrations by name, so a forgotten line means the tests or the stand-in backend silently run on an old schema.
- Changing a function's return type needs `drop function` first; `create or replace` refuses.
- Add a row to the migration table in the README, and to [data model](data-model.md#migration-history).
- Write tests for new rules in `supabase/tests/`.

## The Edge Function

[`supabase/functions/invite-admin/index.ts`](../supabase/functions/invite-admin/index.ts). Behaviour is described in [auth and admins](auth-and-admins.md#inviting-someone).

Deploy from the project folder, after `npx supabase login` and `npx supabase link --project-ref <ref>` once:

```bash
npx supabase functions deploy invite-admin --no-verify-jwt
```

`--no-verify-jwt` matches `verify_jwt = false` in `supabase/config.toml`: the function checks the caller itself. Docker is not needed. Supabase injects the URL and keys the function uses; there are no secrets to set.

Redeploy whenever the file changes, and check afterwards with the logs (below). Deploying changes production, so a run by a script or an agent has to be confirmed with `--yes`.

## Supabase dashboard settings

These live only in the dashboard. If invitations misbehave, check them first.

| Setting | Where | Value |
| --- | --- | --- |
| Allow new users to sign up | Authentication, Sign In / Providers | **Off**. Admins are created only by invitation. |
| Site URL | Authentication, URL Configuration | `https://<user>.github.io/<repo>/` |
| Redirect URLs | Authentication, URL Configuration | `https://<user>.github.io/<repo>/set-password` (and `http://localhost:5173/set-password` for local runs) |
| Custom SMTP | Authentication, Emails, SMTP Settings | Your own sender (Gmail with an app password, or Resend). Without it only members of your Supabase organization receive mail, at a very low rate. |
| Email templates | Authentication, Emails, Templates | **Invite user, Confirm signup, Magic link, Reset password** all show the code. Text in the [README](../README.md#4b-put-a-code-in-the-invitation-emails). |
| Email OTP expiration | Authentication, Sign In / Providers, Email | `86400` (24 hours) so a code does not run out the same hour. |

Why all four templates: which one Supabase uses for a code depends on whether the account has ever been confirmed, so the code must be in each.

Limits to remember: a given address can be sent a new code only about once a minute, and custom SMTP defaults to 30 emails an hour. Hitting either shows an error to the admin.

## Daily late fees

Late fees are added whenever an admin opens the app, so the system works without any job. To also add them every day without anyone opening it, enable the `pg_cron` extension (Database, Extensions) and run [`supabase/cron.sql`](../supabase/cron.sql) once in the SQL Editor.

## Looking at production

The Supabase CLI can read production without changing it. Use these for diagnosis; they need `supabase login` and a linked project.

Read-only SQL (add `--read-only`; without it the CLI treats the statement as a change and asks for confirmation):

```bash
npx supabase db query --remote --read-only "select email from auth.users"
```

Logs for the last day, by service (`auth`, `functions`, `function-edge`, `edge`, `postgres`, ...):

```bash
npx supabase logs --remote --service auth --since 24h --output-format json
```

What to look for:

| Question | Where |
| --- | --- |
| Was an invitation or code email sent? | `auth` logs: `/invite` or `/otp` requests and their status |
| Did the invite function run, and what did it answer? | `function-edge` (request and status) and `functions` (start and errors) |
| Was a link used up before the person clicked? | `auth` logs: repeated `/verify` calls, the later ones failing with "One-time token not found" |
| Is someone an admin, pending, or the main admin? | `select u.email, a.accepted_at, a.is_owner from admins a join auth.users u on u.id = a.user_id` |

Treat anything read this way as private: it contains people's email addresses.

## When something breaks

The README has a [troubleshooting table](../README.md#troubleshooting) with the symptoms seen so far and their fixes.
