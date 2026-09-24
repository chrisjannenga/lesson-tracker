import { get, put } from '@vercel/blob'

// Reads and writes each subject's tracker state as a small JSON file in
// Vercel Blob, so every device shares the same counts.
// GET  /api/state?id=math  -> the saved state, or null if nothing saved yet
// PUT  /api/state?id=math  -> saves the JSON body

const SUBJECTS = ['math', 'la']

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

function subjectFrom(request) {
  const id = new URL(request.url).searchParams.get('id')
  return SUBJECTS.includes(id) ? id : null
}

// Blob stores are created as either private or public, and calls must use
// the matching access. Until one succeeds with a real result, try private
// and then public, then remember whichever the store accepted.
let storeAccess = null

async function withAccess(fn) {
  if (storeAccess) return fn(storeAccess)
  let firstError = null
  let found = false
  for (const access of ['private', 'public']) {
    try {
      const result = await fn(access)
      if (result) {
        storeAccess = access
        return result
      }
      found = true // reachable, just nothing saved yet
    } catch (err) {
      firstError ??= err
    }
  }
  if (!found) throw firstError
  return null
}

function notConfigured() {
  return !process.env.BLOB_READ_WRITE_TOKEN
}

export async function GET(request) {
  if (notConfigured()) return json({ error: 'not configured' }, 503)
  const id = subjectFrom(request)
  if (!id) return json({ error: 'unknown subject' }, 400)

  const result = await withAccess((access) =>
    get(`lesson-tracker/${id}.json`, { access, useCache: false })
  )
  if (!result || result.statusCode !== 200) return json(null)
  return json(await new Response(result.stream).json())
}

export async function PUT(request) {
  if (notConfigured()) return json({ error: 'not configured' }, 503)
  const id = subjectFrom(request)
  if (!id) return json({ error: 'unknown subject' }, 400)

  const s = await request.json()
  const state = {
    remaining: Math.max(0, Number(s.remaining) || 0),
    log: s.log && typeof s.log === 'object' ? s.log : {},
    dailyGoal: s.dailyGoal == null ? null : Number(s.dailyGoal),
    lastSyncedLogTotal: Number(s.lastSyncedLogTotal) || 0,
  }
  await withAccess((access) =>
    put(`lesson-tracker/${id}.json`, JSON.stringify(state), {
      access,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    })
  )
  return json(state)
}
