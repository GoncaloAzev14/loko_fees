// Invites someone by email and makes them an admin.
//
// Only an existing admin can call it. It needs the service role key (injected by Supabase
// into every Edge Function) because creating accounts is not something the browser may do.
// The invitation is recorded as pending: the person becomes an admin when they first sign in or
// choose a password (the app does that). If the email already has an account whose invitation is
// still pending, it is sent a fresh access code; if it is already an admin, nothing is sent.
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Método não permitido.' })

  const url = Deno.env.get('SUPABASE_URL')!

  // 1. Who is calling? Must be a signed-in admin.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json(401, { error: 'Sessão inválida. Entre de novo.' })
  const { data: isAdmin } = await caller.rpc('is_admin')
  if (isAdmin !== true) return json(403, { error: 'Só administradores podem convidar.' })

  // 2. What do they want?
  let email = ''
  let redirectTo: string | undefined
  try {
    const body = await req.json()
    email = String(body.email ?? '').trim().toLowerCase()
    redirectTo = typeof body.redirectTo === 'string' ? body.redirectTo : undefined
  } catch {
    return json(400, { error: 'Pedido inválido.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Email inválido.' })

  // 3. Invite (or promote) with elevated rights.
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo })

  // Making someone an admin always goes through this database helper (security definer): it does not
  // depend on the server role having rights on the admins table, which a project created with
  // "Automatically expose new tables" switched off does not give it.
  const makeAdmin = async () => {
    const { data: found, error: rpcError } = await service.rpc('add_admin_by_email', { p_email: email })
    if (rpcError) console.error('add_admin_by_email failed:', rpcError.code, rpcError.message)
    return !rpcError && found === true
  }

  if (error) {
    // The email already has an account: record the invitation (a no-op for an existing admin).
    if (error.code === 'email_exists' || /already.*registered/i.test(error.message)) {
      if (!(await makeAdmin())) return json(500, { error: 'Não foi possível promover essa conta.' })

      // Still pending: do not leave the person stuck, email them a code to finish with.
      const { data: state, error: stateError } = await service.rpc('invite_state', { p_email: email })
      if (stateError) console.error('invite_state failed:', stateError.code, stateError.message)
      if (state === 'pending') {
        const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false } })
        const { error: otpError } = await anon.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
        })
        if (otpError) return json(400, { error: otpError.message })
        return json(200, { status: 'resent' })
      }
      return json(200, { status: 'already_admin' })
    }
    return json(400, { error: error.message })
  }

  if (!(await makeAdmin())) {
    return json(500, { error: 'O convite foi enviado, mas não foi possível dar acesso de administrador. Tente de novo ou peça ajuda.' })
  }
  return json(200, { status: 'invited' })
})
