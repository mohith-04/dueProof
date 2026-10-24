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
