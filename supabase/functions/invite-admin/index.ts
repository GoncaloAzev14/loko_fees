// Invites someone by email and makes them an admin.
//
// Only an existing admin can call it. It needs the service role key (injected by Supabase
// into every Edge Function) because creating accounts is not something the browser may do.
// If the email already has an account, that account is simply promoted.
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
  const { data, error } = await service.auth.admin.inviteUserByEmail(email, { redirectTo })

  if (error) {
    if (error.code === 'email_exists' || /already.*registered/i.test(error.message)) {
      const { data: found, error: promoteError } = await service.rpc('add_admin_by_email', { p_email: email })
      if (promoteError || !found) return json(500, { error: 'Não foi possível promover essa conta.' })
      return json(200, { status: 'promoted' })
    }
    return json(400, { error: error.message })
  }

  const { error: insertError } = await service.from('admins').insert({ user_id: data.user.id })
  if (insertError) return json(500, { error: 'Convite enviado, mas falhou a atribuição de administrador. Tente de novo.' })
  return json(200, { status: 'invited' })
})
