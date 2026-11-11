// Thin fetch wrapper for HMS. Everything is same-origin (nginx or the Vite proxy forward
// /api and /sanctum), so the session cookie rides along without any CORS setup.

import { goToSignIn } from './accounts'

export class ApiError extends Error {
  status: number
  errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }

  /** The first validation message for a field, if there is one. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0]
  }
}

function xsrfToken(): string | undefined {
  const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

/** Sanctum hands out the CSRF cookie here; every write must echo it back. */
export async function ensureCsrfCookie(): Promise<void> {
  if (!xsrfToken()) {
    await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' })
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const token = xsrfToken()
  if (token) headers['X-XSRF-TOKEN'] = token

  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  // The shared session ended (logged out in another app, or expired): off to sign in again.
  if (response.status === 401) goToSignIn()

  if (response.status === 204) return undefined as T

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(response.status, data.message || response.statusText, data.errors)
  }

  return data as T
}
