// Builds the search inputs ("queries") sent to Google for one keyword.
// Queries are only work items: a keyword counts only if Google returns it.

import { cleanText, keyOf } from './text.js'
import { ALPHABETS, CONNECTOR_WORDS, QUESTION_WORDS, listFor } from './wordlists.js'

export const METHODS = [
  { id: 'direct', label: 'Keyword itself', hint: 'Plain completions of the keyword.' },
  { id: 'alphabet_suffix', label: 'A–Z after', hint: '“keyword a”, “keyword b” … — the classic alphabet soup.' },
  { id: 'alphabet_prefix', label: 'A–Z before', hint: '“a keyword”, “b keyword” …' },
  { id: 'number_suffix', label: '0–9 after', hint: 'Finds years, sizes, versions.' },
  { id: 'questions', label: 'Question words', hint: '“how keyword”, “what keyword” … — best for blog topics.' },
  { id: 'connectors', label: 'Connector words', hint: '“keyword for”, “keyword vs”, “keyword without” …' },
  { id: 'custom', label: 'Your own words', hint: 'Words you add, placed after the keyword.' },
]

export const METHOD_IDS = METHODS.map((m) => m.id)

function alphabetFor(language) {
  return language === 'ar' ? ALPHABETS.ar : ALPHABETS.latin
}

/**
 * Generate unique queries for a keyword, in a fixed method order.
 * Returns [{ query, method }].
 */
export function generateQueries(keyword, methods, { language = 'en', customWords = [] } = {}) {
  const base = cleanText(keyword)
  if (!base) return []
  const selected = new Set(methods)
  const out = []
  const seen = new Set()
  const add = (query, method) => {
    const q = cleanText(query)
    const key = keyOf(q)
    if (!q || seen.has(key)) return
    seen.add(key)
    out.push({ query: q, method })
  }

  if (selected.has('direct')) add(base, 'direct')
  if (selected.has('alphabet_suffix')) for (const l of alphabetFor(language)) add(`${base} ${l}`, 'alphabet_suffix')
  if (selected.has('alphabet_prefix')) for (const l of alphabetFor(language)) add(`${l} ${base}`, 'alphabet_prefix')
  if (selected.has('number_suffix')) for (let d = 0; d <= 9; d++) add(`${base} ${d}`, 'number_suffix')
  if (selected.has('questions')) for (const w of listFor(QUESTION_WORDS, language)) add(`${w} ${base}`, 'questions')
  if (selected.has('connectors')) for (const w of listFor(CONNECTOR_WORDS, language)) add(`${base} ${w}`, 'connectors')
  if (selected.has('custom')) for (const w of customWords) add(`${base} ${w}`, 'custom')
  return out
}

export function methodLabel(id) {
  return METHODS.find((m) => m.id === id)?.label ?? id
}
