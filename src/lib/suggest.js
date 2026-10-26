// The only module that talks to Google.
//
// Browsers block fetch() to Google's Suggest endpoint (no CORS headers), so we use
// JSONP: the response is loaded as a <script> that calls our callback function.
// If Google ever drops JSONP support, replace this file (e.g. with a browser
// extension transport) and nothing else needs to change.

const ENDPOINT = 'https://suggestqueries.google.com/complete/search'

let counter = 0

export class SuggestError extends Error {}

/**
 * Fetch autocomplete suggestions for one query.
 * Resolves to [{ text, type, position }] with website (NAVIGATION) results removed.
 */
export function fetchSuggestions(query, { country = 'us', language = 'en', timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `__akf_${Date.now().toString(36)}_${counter++}`
    const script = document.createElement('script')
    let settled = false

    const finish = () => {
      settled = true
      clearTimeout(timer)
      // Keep a no-op in place briefly in case a late response still arrives.
      window[callbackName] = () => {}
      setTimeout(() => { delete window[callbackName] }, 30000)
      script.remove()
    }

    const timer = setTimeout(() => {
      if (settled) return
      finish()
      reject(new SuggestError('timeout'))
    }, timeoutMs)

    window[callbackName] = (data) => {
      if (settled) return
      finish()
      try {
        resolve(parseSuggestResponse(data))
      } catch (error) {
        reject(error)
      }
    }

    script.onerror = () => {
      if (settled) return
      finish()
      reject(new SuggestError('blocked or network error'))
    }

    const params = new URLSearchParams({
      client: 'chrome',
      q: query,
      hl: language,
      gl: country,
      ie: 'utf-8',
      oe: 'utf-8',
      callback: callbackName,
    })
    script.src = `${ENDPOINT}?${params}`
    script.referrerPolicy = 'no-referrer'
    document.head.appendChild(script)
  })
}

/** Parse the client=chrome response shape: [query, [suggestions], [descs], [], {meta}]. */
export function parseSuggestResponse(data) {
  if (!Array.isArray(data) || !Array.isArray(data[1])) {
    throw new SuggestError('unexpected response')
  }
  const meta = data[4] && typeof data[4] === 'object' ? data[4] : {}
  const types = Array.isArray(meta['google:suggesttype']) ? meta['google:suggesttype'] : []
  const results = []
  const seen = new Set()
  data[1].forEach((item, index) => {
    const text = typeof item === 'string' ? item.trim() : ''
    const type = typeof types[index] === 'string' ? types[index] : 'QUERY'
    if (!text || type === 'NAVIGATION' || seen.has(text)) return
    seen.add(text)
    results.push({ text, type, position: index + 1 })
  })
  return results
}
