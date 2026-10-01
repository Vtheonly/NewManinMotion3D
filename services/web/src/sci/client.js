/**
 * API client for the Suprepto editor (issue #29) — thin wrappers over the
 * IR endpoints plus the scientific render trigger.
 */

const API_BASE = '/api'

async function request (endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options
  })
  if (!response.ok) {
    const error = await response.json().catch(
      () => ({ error: response.statusText }))
    throw new Error(error.error || error.message ||
      `Request failed (${response.status})`)
  }
  return response.status === 204 ? null : response.json()
}

export const ir = {
  /** Registry metadata for the generic inspector + library (#34). */
  schema: () => request('/ir/schema'),

  validate: (document) => request('/ir/validate', {
    method: 'POST', body: JSON.stringify({ document })
  }),

  /** Deterministic, runnable Python export (byte-parity with runtime). */
  export: (document) => request('/ir/export', {
    method: 'POST', body: JSON.stringify({ document })
  }),

  /** Queue a server render of a scientific document (#29 §7). */
  render: (projectId, document, quality = 'medium') =>
    request(`/projects/${projectId}/render-sci`, {
      method: 'POST',
      body: JSON.stringify({ document, quality })
    }),

  job: (jobId) => request(`/jobs/${jobId}`)
}
