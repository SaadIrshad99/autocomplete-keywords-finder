// Turns the raw keyword list into something you can pick from:
// intent tags, word counts, new-word frequency and topic groups.
// Everything here is plain text rules — no API calls, no AI.

import { tokenize, tokenMatches, keyOf } from './text.js'
import { INTENT_WORDS, LOCAL_PHRASES, STOPWORDS, listFor } from './wordlists.js'

export const INTENTS = [
  { id: 'question', label: 'Question' },
  { id: 'comparison', label: 'Comparison' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'local', label: 'Local' },
  { id: 'year', label: 'Year' },
  { id: 'informational', label: 'Informational' },
]

const YEAR = /(?:^|\D)(20\d{2})(?:\D|$)/

export function detectIntents(text, language = 'en') {
  const words = listFor(INTENT_WORDS, language)
  const tokens = new Set(tokenize(text))
  const lower = keyOf(text)
  const tags = []
  if (words.question.some((w) => tokens.has(w)) || lower.endsWith('?')) tags.push('question')
  if (words.comparison.some((w) => (w.includes(' ') ? lower.includes(w) : tokens.has(w)))) tags.push('comparison')
  if (words.commercial.some((w) => (w.includes(' ') ? lower.includes(w) : tokens.has(w)))) tags.push('commercial')
  if (LOCAL_PHRASES.some((p) => lower.includes(p)) || words.local.some((w) => tokens.has(w))) tags.push('local')
  if (YEAR.test(lower)) tags.push('year')
  if (!tags.length) tags.push('informational')
  return tags
}

/** Words in the keyword that are not seed words and not filler words. */
export function newWordsOf(text, seedTokens, stopwords) {
  const out = []
  for (const token of tokenize(text)) {
    if (seedTokens.some((st) => tokenMatches(token, st))) continue
    if (stopwords.has(token)) continue
    if (/^\d$/.test(token)) continue
    if (!out.includes(token)) out.push(token)
  }
  return out
}

// Per-keyword results don't depend on other keywords, so they are cached:
// during a run only newly found keywords need work.
const cache = new Map()
const CACHE_LIMIT = 60000

function perKeyword(text, seed, language, seedTokens, stopwords) {
  const id = `${language}\u0000${seed}\u0000${text}`
  let hit = cache.get(id)
  if (!hit) {
    if (cache.size > CACHE_LIMIT) cache.clear()
    hit = {
      words: tokenize(text).length,
      intents: detectIntents(text, language),
      newWords: newWordsOf(text, seedTokens, stopwords),
    }
    cache.set(id, hit)
  }
  return hit
}

/**
 * @param {Array<{key:string,text:string}>} keywords
 * @returns {{ rows, words, topics }}
 *   rows: keywords with words/intents/newWords/topic added (same order)
 *   words: [{ word, count }] sorted by count desc
 *   topics: [{ topic, count, keys }] sorted by count desc ("other" last)
 */
export function analyze(keywords, { seed, language = 'en' }) {
  const seedTokens = tokenize(seed)
  const stopwords = new Set(listFor(STOPWORDS, language))

  const rows = keywords.map((kw) => ({ ...kw, ...perKeyword(kw.text, seed, language, seedTokens, stopwords) }))

  const freq = new Map()
  for (const row of rows) for (const w of row.newWords) freq.set(w, (freq.get(w) ?? 0) + 1)
  const words = [...freq.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))

  // Topic = the keyword's most frequent new word (needs at least 2 keywords to form a group).
  const topicMap = new Map()
  for (const row of rows) {
    let best = null
    for (const w of row.newWords) {
      const c = freq.get(w)
      if (c < 2) continue
      if (!best || c > freq.get(best) || (c === freq.get(best) && w < best)) best = w
    }
    row.topic = best ?? 'other'
    if (!topicMap.has(row.topic)) topicMap.set(row.topic, [])
    topicMap.get(row.topic).push(row.key)
  }
  const topics = [...topicMap.entries()]
    .map(([topic, keys]) => ({ topic, count: keys.length, keys }))
    .sort((a, b) => (a.topic === 'other') - (b.topic === 'other') || b.count - a.count || a.topic.localeCompare(b.topic))

  return { rows, words, topics }
}
