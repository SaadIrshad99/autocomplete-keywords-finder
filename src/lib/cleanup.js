// Bulk clean-up rules applied before analysis: exclude words, must-include words,
// other-language and very-long keywords. Hidden keywords are kept in the run and
// come back as soon as a rule is removed.

import { cleanText, keyOf, tokenize } from './text.js'

export const DEFAULT_CLEANUP = {
  exclude: [],
  include: [],
  hideOtherScripts: true,
  hideLong: false,
}

export const LONG_KEYWORD_WORDS = 10

// Words that are junk for most blog niches. Only the ones that actually appear in
// the results are suggested, and the user decides which to exclude.
export const SUGGESTED_EXCLUDES = {
  en: ['login', 'log in', 'sign in', 'sign up', 'account', 'job', 'career', 'salary', 'hiring', 'internship',
    'reddit', 'quora', 'youtube', 'tiktok', 'wikipedia', 'wiki', 'apk', 'mod', 'crack', 'hack', 'torrent', 'cracked',
    'customer service', 'phone number', 'contact number', 'stock', 'share price', 'meaning', 'synonym', 'lyrics'],
  pt: ['login', 'entrar', 'vagas', 'emprego', 'salário', 'reclame aqui', 'telefone', 'youtube', 'apk', 'mod', 'significado'],
  es: ['login', 'iniciar sesión', 'empleo', 'trabajo', 'salario', 'teléfono', 'youtube', 'apk', 'mod', 'significado'],
  de: ['login', 'anmelden', 'jobs', 'stellenangebote', 'gehalt', 'telefonnummer', 'youtube', 'apk', 'bedeutung'],
  fr: ['login', 'connexion', 'emploi', 'recrutement', 'salaire', 'téléphone', 'youtube', 'apk', 'signification'],
  ar: ['تسجيل الدخول', 'وظائف', 'راتب', 'رقم', 'يوتيوب', 'تحميل', 'apk', 'معنى'],
}

export function suggestedExcludesFor(language) {
  return SUGGESTED_EXCLUDES[language] ?? SUGGESTED_EXCLUDES.en
}

/** Parse "a, b\nc" into clean unique terms. */
export function parseTerms(text) {
  return [...new Set(String(text).split(/[\n,]+/).map((t) => keyOf(cleanText(t))).filter(Boolean))]
}

/**
 * Add the lookup structures used for fast matching (computed once per keyword).
 * row.tokenSet: Set of words; row.joined: " word word " for phrase checks.
 */
export function prepareRow(row) {
  const tokens = row.tokens ?? tokenize(row.text)
  return { ...row, tokens, tokenSet: new Set(tokens), joined: ` ${tokens.join(' ')} ` }
}

/** Build a fast matcher: whole word (plus simple plurals) or, for multi-word terms, a phrase. */
export function termMatcher(term) {
  const words = tokenize(term)
  if (words.length > 1) {
    const phrase = ` ${words.join(' ')} `
    return (row) => row.joined.includes(phrase)
  }
  const w = words[0] ?? term
  const variants = [w, `${w}s`, `${w}es`]
  if (w.endsWith('s')) variants.push(w.slice(0, -1))
  return (row) => variants.some((v) => row.tokenSet.has(v))
}

/** Convenience wrapper used in tests and one-off checks. */
export function hasTerm(text, tokens, term) {
  return termMatcher(term)(prepareRow({ text, tokens }))
}

const SCRIPTS = [
  ['latin', /\p{Script=Latin}/u],
  ['arabic', /\p{Script=Arabic}/u],
  ['devanagari', /\p{Script=Devanagari}/u],
  ['cyrillic', /\p{Script=Cyrillic}/u],
  ['greek', /\p{Script=Greek}/u],
  ['hebrew', /\p{Script=Hebrew}/u],
  ['thai', /\p{Script=Thai}/u],
  ['bengali', /\p{Script=Bengali}/u],
  ['hangul', /\p{Script=Hangul}/u],
  ['japanese', /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
  ['han', /\p{Script=Han}/u],
]

export function scriptsIn(text) {
  return new Set(SCRIPTS.filter(([, re]) => re.test(text)).map(([name]) => name))
}

/**
 * True when the keyword uses a writing system that isn't in the seed.
 * Latin is always allowed, since brand names and English words appear in every language.
 */
export function isOtherScript(text, seedScripts) {
  for (const script of scriptsIn(text)) {
    if (script === 'latin' || seedScripts.has(script)) continue
    if (script === 'han' && seedScripts.has('japanese')) continue // Japanese mixes kanji with kana
    return true
  }
  return false
}

/**
 * Apply clean-up rules.
 * @returns {{ kept: Array, hidden: number, reasons: { exclude, include, script, long } }}
 */
export function applyCleanup(rows, cleanup, seed) {
  const seedScripts = scriptsIn(seed)
  const reasons = { exclude: 0, include: 0, script: 0, long: 0 }
  const exclude = cleanup.exclude.map(termMatcher)
  const include = cleanup.include.map(termMatcher)
  const kept = []
  for (const original of rows) {
    const row = original.tokenSet ? original : prepareRow(original)
    if (exclude.length && exclude.some((match) => match(row))) { reasons.exclude++; continue }
    if (include.length && !include.some((match) => match(row))) { reasons.include++; continue }
    if (cleanup.hideOtherScripts && isOtherScript(row.text, seedScripts)) { reasons.script++; continue }
    if (cleanup.hideLong && row.tokens.length >= LONG_KEYWORD_WORDS) { reasons.long++; continue }
    kept.push(row)
  }
  return { kept, hidden: rows.length - kept.length, reasons }
}

/** How many keywords contain each suggested term (only terms that appear, most common first). */
export function presentSuggestions(rows, language, alreadyExcluded) {
  const skip = new Set(alreadyExcluded)
  const terms = suggestedExcludesFor(language).filter((term) => !skip.has(term))
  const matchers = terms.map(termMatcher)
  const counts = new Array(terms.length).fill(0)
  for (const original of rows) {
    const row = original.tokenSet ? original : prepareRow(original)
    for (let i = 0; i < matchers.length; i++) if (matchers[i](row)) counts[i]++
  }
  return terms
    .map((term, i) => ({ term, count: counts[i] }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
}
