// Stand-in for a Supabase stack, for trying the UI without Docker.
//
//   node scripts/fake-supabase.mjs        (serves http://127.0.0.1:54321)
//
// Runs supabase/migrations + seed.sql in an in-process Postgres (PGlite) and answers the
// subset of PostgREST / GoTrue the app uses (filters, order, upsert, rpc, password login).
// It enforces the same row level security as the real thing, but it is NOT PostgREST:
// treat it as a smoke-test aid, not as proof the hosted setup works.
//
// Logins: admin@loko.test / admin123 (admin), viewer@loko.test / viewer123 (not admin).
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { PGlite, types } from '@electric-sql/pglite'

const PORT = Number(process.env.PORT ?? 54321)
const sql = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')
const ADMIN = '00000000-0000-0000-0000-00000000000a'
const VIEWER = '00000000-0000-0000-0000-00000000000b'
const USERS = {
  'admin@loko.test': { id: ADMIN, password: 'admin123' },
  'viewer@loko.test': { id: VIEWER, password: 'viewer123' },
}

const db = new PGlite({
  parsers: { [types.NUMERIC]: (v) => parseFloat(v), [types.DATE]: (v) => v },
})
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`)
await db.exec(sql('../supabase/migrations/20261112000000_init.sql'))
await db.exec(sql('../supabase/migrations/20261113000000_admin_management.sql'))
await db.exec(sql('../supabase/migrations/20261114000000_season_and_protected_deletes.sql'))
await db.exec(sql('../supabase/seed.sql'))
await db.exec(`insert into auth.users values ('${ADMIN}', 'admin@loko.test'), ('${VIEWER}', 'viewer@loko.test'); insert into admins values ('${ADMIN}');`)

// --- helpers ---
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (uid, email) =>
  `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`
const userOf = (uid, email) => ({ id: uid, aud: 'authenticated', role: 'authenticated', email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() })
const uidFromAuth = (h) => {
  const t = (h ?? '').replace(/^Bearer /, '')
  const parts = t.split('.')
  if (parts.length !== 3) return null
  try { return JSON.parse(Buffer.from(parts[1], 'base64url').toString()).sub ?? null } catch { return null }
}
const q = (id) => '"' + id.replace(/"/g, '""') + '"'
const ident = (s) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error('bad identifier ' + s); return q(s) }

const OPS = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
function where(params, args) {
  const out = []
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
    const m = /^(\w+)\.(.*)$/.exec(v)
    if (!m) throw new Error('bad filter ' + k + '=' + v)
    const [, op, val] = m
    if (op === 'is') out.push(`${ident(k)} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`)
    else if (op === 'in') { const items = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, '')); out.push(`${ident(k)}::text = any($${args.push(items)})`) }
    else if (OPS[op]) out.push(`${ident(k)} ${OPS[op]} $${args.push(val)}`) // Postgres infers the parameter type from the column
    else throw new Error('unsupported operator ' + op)
  }
  return out.length ? ' where ' + out.join(' and ') : ''
}

// run one request as anon / a signed-in user, under RLS, serialised on the single connection
let chain = Promise.resolve()
const inTx = (uid, fn) => {
  const job = chain.then(() => db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('test.uid', $1, true)`, [uid ?? ''])
    return fn(tx)
  }))
  chain = job.catch(() => {})
  return job
}

async function rest(req, url, body) {
  const [, , , name, fn] = url.pathname.split('/') // /rest/v1/<name>[/<rpc fn>]
  const uid = uidFromAuth(req.headers.authorization)
  const prefer = req.headers.prefer ?? ''
  const wantRows = prefer.includes('return=representation')
  const single = (req.headers.accept ?? '').includes('vnd.pgrst.object')
  const params = [...url.searchParams]

  if (name === 'rpc') {
    const named = Object.entries(body ?? {})
    const argList = named.map(([k], i) => `${ident(k)} => $${i + 1}`).join(', ')
    const r = await inTx(uid, (tx) => tx.query(`select * from public.${ident(fn)}(${argList})`, named.map(([, v]) => v)))
    // scalar functions come back as one column named after the function
    const scalar = r.fields.length === 1 && r.fields[0].name === fn
    return [200, scalar ? r.rows[0][fn] : r.rows]
  }
  const t = `public.${ident(name)}`
  const args = []
  const rows = await inTx(uid, async (tx) => {
    if (req.method === 'GET') {
      const sel = url.searchParams.get('select') ?? '*'
      const cols = sel === '*' ? '*' : sel.split(',').map((c) => ident(c.trim())).join(', ')
      const w = where(params, args)
      const ord = (url.searchParams.get('order') ?? '').split(',').filter(Boolean)
        .map((o) => { const [c, d] = o.split('.'); return `${ident(c)} ${d === 'desc' ? 'desc' : 'asc'}` }).join(', ')
      const lim = url.searchParams.get('limit')
      return (await tx.query(`select ${cols} from ${t}${w}${ord ? ' order by ' + ord : ''}${lim ? ' limit ' + Number(lim) : ''}`, args)).rows
    }
    if (req.method === 'POST') {
      const list = Array.isArray(body) ? body : [body]
      const cols = (url.searchParams.get('columns') ?? '').split(',').filter(Boolean).map((c) => c.replace(/"/g, ''))
      const keys = cols.length ? cols : [...new Set(list.flatMap(Object.keys))]
      const values = list.map((r) => '(' + keys.map((k) => (k in r ? `$${args.push(r[k])}` : 'default')).join(', ') + ')').join(', ')
      let sqlText = `insert into ${t} (${keys.map(ident).join(', ')}) values ${values}`
      if (prefer.includes('resolution=merge-duplicates')) {
        const target = url.searchParams.get('on_conflict') ?? 'id'
        sqlText += ` on conflict (${target.split(',').map(ident).join(', ')}) do update set ${keys.filter((k) => !target.split(',').includes(k)).map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ')}`
      }
      return (await tx.query(sqlText + ' returning *', args)).rows
    }
    if (req.method === 'PATCH') {
      const sets = Object.entries(body).map(([k, v]) => `${ident(k)} = $${args.push(v)}`).join(', ')
      return (await tx.query(`update ${t} set ${sets}${where(params, args)} returning *`, args)).rows
    }
    if (req.method === 'DELETE') return (await tx.query(`delete from ${t}${where(params, args)} returning *`, args)).rows
    throw new Error('unsupported method ' + req.method)
  })
  if (req.method === 'GET' || wantRows) {
    if (single) return rows.length === 1 ? [200, rows[0]] : [406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows` }]
    return [200, rows]
  }
  return [req.method === 'POST' ? 201 : 204, null]
}

createServer(async (req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' }
  const send = (status, payload) => {
    res.writeHead(status, { ...cors, ...(payload == null ? {} : { 'content-type': 'application/json' }) })
    res.end(payload == null ? undefined : JSON.stringify(payload))
  }
  if (req.method === 'OPTIONS') return send(204)
  const url = new URL(req.url, `http://${req.headers.host}`)
  let raw = ''
  for await (const c of req) raw += c
  const body = raw ? JSON.parse(raw) : undefined
  try {
    if (url.pathname === '/auth/v1/token') {
      const u = USERS[body?.email]
      if (!u || u.password !== body.password) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' })
      return send(200, { access_token: jwt(u.id, body.email), token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-' + u.id, user: userOf(u.id, body.email) })
    }
    if (url.pathname === '/auth/v1/user') {
      const uid = uidFromAuth(req.headers.authorization)
      const email = Object.keys(USERS).find((e) => USERS[e].id === uid)
      return uid ? send(200, userOf(uid, email)) : send(401, { message: 'no session' })
    }
    if (url.pathname === '/auth/v1/logout') return send(204)
    if (url.pathname === '/functions/v1/invite-admin') {
      // mimic the Edge Function: admins only; no real email is sent
      const uid = uidFromAuth(req.headers.authorization)
      const isAdmin = uid && (await inTx(uid, (tx) => tx.query('select public.is_admin() as a'))).rows[0].a
      if (!isAdmin) return send(403, { error: 'Só administradores podem convidar.' })
      const email = String(body?.email ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(400, { error: 'Email inválido.' })
      const existing = USERS[email]
      const id = existing?.id ?? crypto.randomUUID()
      if (!existing) USERS[email] = { id, password: 'invited-' + id }
      await db.exec(`insert into auth.users values ('${id}', '${email}') on conflict do nothing; insert into public.admins values ('${id}') on conflict do nothing;`)
      console.log(`[fake] would email an invitation to ${email} (redirect ${body.redirectTo})`)
      return send(200, { status: existing ? 'promoted' : 'invited' })
    }
    if (url.pathname.startsWith('/rest/v1/')) {
      const [status, payload] = await rest(req, url, body)
      return send(status, payload)
    }
    send(404, { message: 'not found' })
  } catch (e) {
    const code = e.code ?? 'XX000'
    send(code === '42501' ? 403 : 400, { code, message: e.message, details: null, hint: null })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`fake supabase on http://127.0.0.1:${PORT}`))
