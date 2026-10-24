/**
 * Small wrapper around fetch for talking to the Django API.
 *
 * - Every call goes to /api/... on the same origin, so the browser sends the
 *   Django session cookie automatically (no tokens stored in JavaScript).
 * - Requests that change data send the CSRF token Django puts in the
 *   "csrftoken" cookie, which Django checks on every POST/PUT/PATCH/DELETE.
 * - Non-2xx responses throw an ApiError with the status and the parsed body,
 *   so pages can show a proper error message.
 */

export class ApiError extends Error {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`)
    this.status = status
    this.body = body
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export async function api<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isFormData = body instanceof FormData

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }
  if (method !== 'GET') {
    const csrfToken = getCookie('csrftoken')
    if (csrfToken) headers['X-CSRFToken'] = csrfToken
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  const text = await response.text()
  const data: unknown = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }
  return data as T
}

/** Ask Django to set the csrftoken cookie. Called once when the app starts. */
export function ensureCsrfCookie(): Promise<unknown> {
  return api('/auth/csrf/')
}

/**
 * Turn a Django REST Framework error into messages a form can show.
 * DRF returns either {"detail": "..."} or {"field": ["msg", ...], "non_field_errors": [...]}.
 */
export type FormErrors = { general?: string; fields: Record<string, string> }

export function toFormErrors(error: unknown): FormErrors {
  if (!(error instanceof ApiError)) {
    return { general: 'Could not reach the server. Check your connection and try again.', fields: {} }
  }
  if (error.status === 429) {
    return { general: 'Too many attempts. Please wait a minute and try again.', fields: {} }
  }
  const body = error.body
  if (body && typeof body === 'object') {
    const fields: Record<string, string> = {}
    let general: string | undefined
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      const message = Array.isArray(value) ? String(value[0]) : String(value)
      if (key === 'detail' || key === 'non_field_errors') general = message
      else fields[key] = message
    }
    return { general, fields }
  }
  return { general: `Something went wrong (error ${error.status}).`, fields: {} }
}
