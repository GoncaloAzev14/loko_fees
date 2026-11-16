import { describe, expect, it } from 'vitest'
import { MIN_PASSWORD_LENGTH, passwordErrorMessage, passwordProblem } from './password'

describe('passwordProblem', () => {
  it('accepts a long password with letters and numbers', () => {
    expect(passwordProblem('bola2026golos')).toBeNull()
    expect(passwordProblem('Árvore12345')).toBeNull() // accented letters count as letters
  })

  it('refuses a short one, however good it looks', () => {
    expect(passwordProblem('a1'.repeat(MIN_PASSWORD_LENGTH / 2 - 1))).toMatch(/pelo menos 10 caracteres/)
    expect(passwordProblem('')).toMatch(/pelo menos/)
  })

  it('refuses letters only, and numbers only', () => {
    expect(passwordProblem('somenteletrasaqui')).toMatch(/letras e números/)
    expect(passwordProblem('12345678901234')).toMatch(/letras e números/)
  })

  it('does not count symbols as letters or numbers', () => {
    expect(passwordProblem('!!!!!!!!!!!!!!!')).toMatch(/letras e números/)
  })

  it('checks length first, so the person fixes one thing at a time', () => {
    expect(passwordProblem('abc')).toMatch(/caracteres/)
  })
})

describe('passwordErrorMessage', () => {
  it('puts the server\'s weak-password refusal in our words, with the rule', () => {
    expect(passwordErrorMessage({ code: 'weak_password', message: 'Password should be at least 10 characters.' }))
      .toBe('A palavra-passe é demasiado fraca. Pelo menos 10 caracteres, com letras e números.')
  })

  it('passes any other message on unchanged', () => {
    expect(passwordErrorMessage({ code: 'same_password', message: 'New password should be different' })).toBe('New password should be different')
    expect(passwordErrorMessage({ message: 'boom' })).toBe('boom')
  })
})
