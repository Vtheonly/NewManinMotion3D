/**
 * API Client for Manim Studio — v2
 *
 * Talks to the Node API running at /api (proxied by Nginx in Docker,
 * or directly at localhost:3000 in dev).
 */

const API_BASE = '/api';

/**
 * Make an API request.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || `Request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projects = {
  list: () => request('/projects'),

  get: (id) => request(`/projects/${id}`),

  create: (name = 'My Animation', editorMode = 'visual', sceneType = 'scene_2d') =>
    request('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, editorMode, sceneType })
    }),

  update: (id, project) =>
    request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(project)
    }),

  delete: (id) =>
    request(`/projects/${id}`, { method: 'DELETE' }),

  render: (id, quality = 'high') =>
    request(`/projects/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ quality })
    }),

  /**
   * Render raw Manim source. sceneName is optional: when omitted, the
   * server auto-detects scene classes (Scene / MovingCameraScene /
   * ThreeDScene / custom) — Issue #1.
   */
  renderCode: (id, { quality = 'high', codeSource, sceneName } = {}) =>
    request(`/projects/${id}/render-code`, {
      method: 'POST',
      body: JSON.stringify({ quality, codeSource, ...(sceneName ? { sceneName } : {}) })
    })
};

// ─── Capabilities (Issue #1: registry discovery) ─────────────────────────────

export const capabilities = {
  /** Fetch registered object types / animations / scene types from the compiler registries */
  get: () => request('/capabilities'),

  /** Detect renderable scene classes in raw Python source (server-side detection) */
  detectScenes: (codeSource) => request('/detect-scenes', {
    method: 'POST',
    body: JSON.stringify({ codeSource })
  })
};

// ─── Assets ───────────────────────────────────────────────────────────────────

export const assets = {
  list: (projectId) => request(`/assets/${projectId}`),

  /** Multipart file upload */
  upload: async (projectId, file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/assets/${projectId}`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  },

  /** Upload a base64 data-URL (used when syncing browser assets to server). */
  uploadBase64: (projectId, { name, type, data }) =>
    request(`/assets/${projectId}/base64`, {
      method: 'POST',
      body: JSON.stringify({ name, type, data })
    }),

  getUrl: (projectId, filename) => `${API_BASE}/assets/${projectId}/${filename}`,

  delete: (projectId, filename) =>
    request(`/assets/${projectId}/${filename}`, { method: 'DELETE' })
};

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export const jobs = {
  get: (jobId) => request(`/jobs/${jobId}`)
};

// ─── Renders ──────────────────────────────────────────────────────────────────

export const renders = {
  getLatestUrl: (projectId) => `${API_BASE}/renders/${projectId}/latest.mp4?t=${Date.now()}`,
  getInfo: (projectId) => request(`/renders/${projectId}`)
};

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth() {
  try {
    const res = await fetch('/health', { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export default { projects, assets, jobs, renders, checkHealth };
