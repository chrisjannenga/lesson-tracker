// Shared storage for the tracker, through the /api/state function (which
// keeps one JSON file per subject in Vercel Blob). If that isn't available -
// e.g. running under plain `vite` or before Blob storage is connected - calls
// throw NotConfigured and the app keeps using this browser's localStorage.

export class NotConfigured extends Error {}

async function call(id, init) {
  const res = await fetch(`/api/state?id=${encodeURIComponent(id)}`, {
    cache: 'no-store',
    ...init,
  })
  const isJson = (res.headers.get('content-type') || '').includes('application/json')
  if (res.status === 503 || res.status === 404 || !isJson) throw new NotConfigured()
  if (!res.ok) throw new Error(`sync failed: ${res.status}`)
  return res.json()
}

// Returns the shared state, or null if nothing has been saved yet.
export function fetchRemote(id) {
  return call(id)
}

export function pushRemote(id, state) {
  return call(id, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(state),
  })
}
