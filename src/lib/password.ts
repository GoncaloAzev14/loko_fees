/**
 * The password rule. The same rule is set on the server (Supabase: Authentication, Sign In / Providers,
 * Email), which is what actually enforces it; this check only tells the person before they send it.
 */
export const MIN_PASSWORD_LENGTH = 10

export const PASSWORD_HINT = `Pelo menos ${MIN_PASSWORD_LENGTH} caracteres, com letras e números.`

/** What is wrong with this password, in words for the person, or null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `A palavra-passe deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'A palavra-passe deve ter letras e números.'
  return null
}

/**
 * The message to show for a password the server refused. Supabase answers in English; its
 * "weak_password" error becomes our rule, anything else is passed on unchanged.
 */
export function passwordErrorMessage(error: { code?: string; message: string }): string {
  return error.code === 'weak_password' ? `A palavra-passe é demasiado fraca. ${PASSWORD_HINT}` : error.message
}
