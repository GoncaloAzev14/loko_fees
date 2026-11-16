import { beforeEach, describe, expect, it, vi } from 'vitest'

type AuthError = { code?: string; status?: number; message: string } | null
const auth = vi.hoisted(() => ({
  otp: { error: null } as { error: AuthError },
  verify: [] as { data: { session: object | null }; error: AuthError }[],
  update: { error: null } as { error: AuthError },
  verifyCalls: [] as { email: string; token: string; type: string }[],
  otpCalls: [] as { email: string; options: { shouldCreateUser?: boolean } }[],
  updateCalls: [] as { password: string }[],
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: async (args: { email: string; options: { shouldCreateUser?: boolean } }) => {
        auth.otpCalls.push(args)
        return auth.otp
      },
      verifyOtp: async (args: { email: string; token: string; type: string }) => {
        auth.verifyCalls.push(args)
        return auth.verify.shift() ?? { data: { session: null }, error: { message: 'invalid' } }
      },
      updateUser: async (args: { password: string }) => {
        auth.updateCalls.push(args)
        return auth.update
      },
    },
  },
}))

import { finishAccess, requestAccessCode } from './api'

vi.stubGlobal('window', { location: { origin: 'https://club.example' } })

beforeEach(() => {
  auth.otp = { error: null }
  auth.verify = []
  auth.update = { error: null }
  auth.verifyCalls = []
  auth.otpCalls = []
  auth.updateCalls = []
})

describe('requestAccessCode', () => {
  it('asks for a code without ever creating an account', async () => {
    await requestAccessCode('  new@club.pt ')
    expect(auth.otpCalls).toHaveLength(1)
    expect(auth.otpCalls[0].email).toBe('new@club.pt')
    expect(auth.otpCalls[0].options.shouldCreateUser).toBe(false)
  })

  it('answers the same for an address nobody invited, so admins cannot be guessed', async () => {
    for (const code of ['otp_disabled', 'user_not_found', 'signup_disabled']) {
      auth.otp = { error: { code, status: 422, message: 'whatever' } }
      await expect(requestAccessCode('stranger@x.pt')).resolves.toBeUndefined()
    }
  })

  it('tells the person to wait when emails are rate limited', async () => {
    auth.otp = { error: { code: 'over_email_send_rate_limit', status: 429, message: 'rate' } }
    await expect(requestAccessCode('a@b.pt')).rejects.toThrow(/minuto/)
  })

  it('shows a plain message for any other failure', async () => {
    auth.otp = { error: { status: 500, message: 'smtp exploded: secret detail' } }
    await expect(requestAccessCode('a@b.pt')).rejects.toThrow('Não foi possível enviar o código. Tente de novo daqui a pouco.')
  })
})

describe('finishAccess', () => {
  const ok = { data: { session: {} }, error: null }
  const bad = { data: { session: null }, error: { message: 'expired' } }

  it('signs in with the code, then saves the password', async () => {
    auth.verify = [ok]
    await finishAccess(' a@b.pt ', '123 456', 'newpassword')
    expect(auth.verifyCalls).toEqual([{ email: 'a@b.pt', token: '123456', type: 'email' }])
    expect(auth.updateCalls).toEqual([{ password: 'newpassword' }])
  })

  it('tries the other code types, because the type depends on how the account was made', async () => {
    auth.verify = [bad, bad, ok]
    await finishAccess('a@b.pt', '123456', 'newpassword')
    expect(auth.verifyCalls.map((c) => c.type)).toEqual(['email', 'signup', 'invite'])
    expect(auth.updateCalls).toHaveLength(1)
  })

  it('fails with a clear message, and saves no password, when no type accepts the code', async () => {
    auth.verify = [bad, bad, bad, bad]
    await expect(finishAccess('a@b.pt', '000000', 'newpassword')).rejects.toThrow(/Código inválido ou expirado.*peça um código novo/)
    expect(auth.updateCalls).toHaveLength(0)
  })

  it('reports a rejected password', async () => {
    auth.verify = [ok]
    auth.update = { error: { message: 'Password should be at least 8 characters' } }
    await expect(finishAccess('a@b.pt', '123456', 'short')).rejects.toThrow('Password should be at least 8 characters')
  })

  it('puts the server\'s weak-password refusal in our words, with the rule', async () => {
    auth.verify = [ok]
    auth.update = { error: { code: 'weak_password', message: 'Password should be at least 10 characters.' } }
    await expect(finishAccess('a@b.pt', '123456', 'abc12345')).rejects.toThrow('A palavra-passe é demasiado fraca. Pelo menos 10 caracteres, com letras e números.')
  })
})
