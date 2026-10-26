// Text helpers shared by the engine and the analysis.

import { STOPWORDS, listFor } from './wordlists.js'

/** Collapse whitespace and trim. Keeps the visible characters. */
export function cleanText(text) {
  return String(text).replace(/\s+/g, ' ').trim()
}

/** Case-insensitive key used for deduplication. */
export function keyOf(text) {
  return cleanText(text).toLocaleLowerCase()
}

/** Split into word tokens (letters, digits, apostrophes), lowercased. */
export function tokenize(text) {
  return keyOf(text).match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu) ?? []
}

const SHORT_WORD_ENDINGS = ['s', 'es', 'd', 'ed', "'s", '’s']

function baseForm(token) {
  let t = token.replace(/['’]s$/, '')
  // Arabic definite article: "العمر" should match "عمر".
  if (/^ال\p{L}{2,}/u.test(t)) t = t.slice(2)
  return t
}

function commonPrefixLength(a, b) {
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a[i] === b[i]) i++
  return i
}

/**
 * Loose word match used for the seed rule.
 * - Same word, plural or possessive: calculator ↔ calculators, calculator's
 * - Same root for longer words: calculator ↔ calculate, calculation; price ↔ pricing
 * - Short words (3 letters or fewer) only allow simple endings: age ↔ ages, aged (not "agent")
 */
export function tokenMatches(token, seedToken) {
  if (token === seedToken) return true
  const a = baseForm(token)
  const b = baseForm(seedToken)
  if (a === b) return true
  const shorter = Math.min(a.length, b.length)
  if (shorter <= 3) {
    return SHORT_WORD_ENDINGS.some((end) => a === b + end || b === a + end)
  }
  const prefix = commonPrefixLength(a, b)
  return prefix >= 4 && prefix >= Math.ceil(shorter * 0.7)
}

/** Seed words that must appear in every keyword (filler words like "for", "in" are ignored). */
export function seedWords(seed, language = 'en') {
  const tokens = tokenize(seed)
  const stop = new Set(listFor(STOPWORDS, language))
  // Only short grammar words are optional ("for", "in", "the", "how"); "best", "free" etc. stay required.
  const meaningful = tokens.filter((t) => !(stop.has(t) && t.length <= 3))
  return meaningful.length ? meaningful : tokens
}

/**
 * Whether the keyword belongs to the seed topic: every seed word must appear,
 * in any order, allowing plurals and words with the same root.
 */
export function containsSeed(keyword, seed, language = 'en') {
  const k = keyOf(keyword)
  const s = keyOf(seed)
  if (!s) return false
  if (k.includes(s)) return true
  const required = seedWords(seed, language)
  if (!required.length) return false
  const tokens = tokenize(keyword)
  return required.every((st) => tokens.some((t) => tokenMatches(t, st)) || (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(st) && k.includes(st)))
}

export function wordCount(text) {
  return tokenize(text).length
}
