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

  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    })
  } catch {
    throw new NetworkError()
  }

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // Not JSON: a server crash page or a proxy error. Keep the status, drop the HTML.
    data = null
  }

  if (!response.ok) {
    throw new ApiError(response.status, data)
  }
  if (method !== 'GET') {
    // Lets always-visible widgets (the notification bell) refresh after any change.
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
  }
  return data as T
}

export const DATA_CHANGED_EVENT = 'dueproof:data-changed'

/** The request never got an answer (offline, server down, DNS...). */
export class NetworkError extends Error {
  constructor() {
    super('Network request failed')
  }
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
  if (error instanceof NetworkError) {
    return { general: 'Could not reach the server. Check your connection and try again.', fields: {} }
  }
  if (!(error instanceof ApiError)) {
    console.error(error)
    return { general: 'Something went wrong in the app. Refresh the page and try again.', fields: {} }
  }
  if (error.status === 403 && error.body === null) {
    // Django's CSRF check answers with an HTML page, not JSON.
    return { general: 'Security check failed. Refresh the page and try again.', fields: {} }
  }
  if (error.status === 429) {
    return { general: 'Too many attempts. Please wait a minute and try again.', fields: {} }
  }
  if (error.status === 502 || error.status === 503 || error.status === 504) {
    return { general: 'The server is starting up or unavailable. Wait a moment and try again.', fields: {} }
  }
  if (error.status >= 500) {
    return { general: `The server hit an error (${error.status}). Try again; if it keeps happening, check the server logs.`, fields: {} }
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
