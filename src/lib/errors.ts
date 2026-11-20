/** An error from the backend, keeping what is needed to tell "try again later" from "no, never". */
export class ApiError extends Error {
  constructor(
    message: string,
    /** PostgREST or SQL error code; empty when there was no answer from the server at all. */
    readonly code = '',
    /** HTTP status; 0 when the request never got an answer. */
    readonly status = 0,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const NETWORK_MESSAGE = /failed to fetch|load failed|network ?error|networkerror|network request failed|timed? ?out|fetch failed/i

/**
 * True when the request may succeed later without changes: no connection, the server did not answer,
 * a gateway error, or a session that needs refreshing. False when the server answered "no" (a rule, a
 * missing row, no permission), which retrying cannot fix.
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.code === 'PGRST301' || error.code === 'PGRST303') return true // expired session: refreshed once online
    if (error.code) return false // the server gave a reason
    return error.status === 0 || error.status >= 500 || NETWORK_MESSAGE.test(error.message)
  }
  if (error instanceof TypeError) return true // what fetch throws when offline
  return false
}

/** The same question for the plain `{ error, status }` that Supabase calls return. */
export function isNetworkFailure(error: { code?: string; message?: string } | null | undefined, status?: number): boolean {
  if (!error) return false
  return isRetryable(new ApiError(error.message ?? '', error.code ?? '', status ?? 0))
}

/**
 * A refusal in words for the person. The server answers with database text ("violates foreign key
 * constraint ..."); the usual ones become plain Portuguese, anything else keeps the server's own words.
 */
export function explainRefusal(error: ApiError): ApiError {
  const text =
    error.code === '23503' ? 'O jogador ou o tipo de multa desta linha já não existe.'
    : error.code === '42501' ? 'Sem permissão: esta conta já não é de administrador?'
    : error.code === '23505' ? 'Já existe uma linha igual.'
    : error.code === '23514' || error.code === '22003' || error.code === '22P02' ? 'Valor inválido.'
    : error.message
  return new ApiError(text, error.code, error.status)
}
