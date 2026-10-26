// Text helpers shared by the engine and the analysis.

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

/**
 * True when a keyword token matches a seed token, tolerating simple plural and
 * possessive endings: "calculators" and "calculator's" match "calculator".
 */
export function tokenMatches(token, seedToken) {
  if (token === seedToken) return true
  if (seedToken.length < 4) return false
  const base = token.replace(/['’]s$/, '')
  if (base === seedToken) return true
  return base.startsWith(seedToken) && base.length - seedToken.length <= 2
}

/** Whether the keyword still belongs to the seed topic (all seed words present). */
export function containsSeed(keyword, seed) {
  const k = keyOf(keyword)
  const s = keyOf(seed)
  if (k.includes(s)) return true
  const seedTokens = tokenize(seed)
  if (!seedTokens.length) return false
  const tokens = tokenize(keyword)
  return seedTokens.every((st) => tokens.some((t) => tokenMatches(t, st)))
}

export function wordCount(text) {
  return tokenize(text).length
}
