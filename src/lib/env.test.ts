import { describe, expect, it } from 'vitest'
import { envNotice } from './env'

const REAL = 'https://abcdefgh.supabase.co'

describe('envNotice', () => {
  it('says nothing on the published site', () => {
    expect(envNotice({ mode: 'production', dev: false, url: REAL })).toBeNull()
  })

  it('marks the stand-in backend and the staging project as test environments', () => {
    expect(envNotice({ mode: 'fake', dev: true, url: 'http://127.0.0.1:54321' })).toMatchObject({ tone: 'test' })
    expect(envNotice({ mode: 'staging', dev: true, url: 'https://other.supabase.co' })).toMatchObject({ tone: 'test' })
  })

  it('warns when a development server is pointed at a hosted project', () => {
    expect(envNotice({ mode: 'development', dev: true, url: REAL })).toMatchObject({ tone: 'real' })
  })

  it('stays quiet for a development server on a local backend', () => {
    for (const url of ['http://127.0.0.1:54321', 'http://localhost:54321', 'http://[::1]:54321']) {
      expect(envNotice({ mode: 'development', dev: true, url })).toBeNull()
    }
  })

  it('is not fooled by a hosted address that merely starts like a local one', () => {
    expect(envNotice({ mode: 'development', dev: true, url: 'https://localhost.evil.example' })).toMatchObject({ tone: 'real' })
  })

  it('says nothing when there is no address at all', () => {
    expect(envNotice({ mode: 'development', dev: true, url: '' })).toBeNull()
  })
})
