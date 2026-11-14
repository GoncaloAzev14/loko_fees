import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

/** In-memory Postgres with a minimal stand-in for Supabase's auth schema and roles. */
export async function newDb(opts: { seed?: boolean } = {}) {
  const db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, encrypted_password text);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  await db.exec(read('../migrations/20261112000000_init.sql'))
  await db.exec(read('../migrations/20261113000000_admin_management.sql'))
  await db.exec(read('../migrations/20261114000000_season_archive_and_reset.sql'))
  await db.exec(read('../migrations/20261115000000_admin_pending.sql'))
  if (opts.seed) await db.exec(read('../seed.sql'))
  return db
}

/** Run `fn` as an anonymous visitor or as a given signed-in user. */
export async function as<T>(db: PGlite, who: 'anon' | { uid: string }, fn: () => Promise<T>) {
  await db.exec(`set role ${who === 'anon' ? 'anon' : 'authenticated'}`)
  await db.exec(`select set_config('test.uid', '${who === 'anon' ? '' : who.uid}', false)`)
  try {
    return await fn()
  } finally {
    await db.exec(`reset role; select set_config('test.uid', '', false)`)
  }
}
