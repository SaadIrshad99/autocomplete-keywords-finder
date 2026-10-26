// The research engine: level-by-level keyword expansion with a hard request budget.
//
// Level 1 sends the seed with every selected method. Each later level expands only
// the most promising keywords found at the previous level (they must still contain
// the seed words), ranked by how often Google returned them. The whole state is
// plain JSON so a run can be saved in the browser and resumed after a refresh.

import { generateQueries } from './expansion.js'
import { containsSeed, keyOf, wordCount } from './text.js'

export const PUBLIC_MAX_REQUESTS = 800
export const MAX_KEYWORDS = 20000
const MAX_DELAY_MS = 8000
const JITTER_MS = 200
const MAX_ATTEMPTS_PER_QUERY = 3
const FAILS_BEFORE_PAUSE = 5
const NON_FINAL_LEVEL_SHARE = 0.6
const COOLDOWN_BASE_MS = 2 * 60 * 1000
const COOLDOWN_MAX_MS = 10 * 60 * 1000
const OK_STREAK_TO_RESET_COOLDOWN = 30
const STATE_VERSION = 1

export const PRESETS = {
  quick: { label: 'Quick', maxDepth: 1, maxRequests: 100, blurb: 'Main topics around the seed.' },
  standard: { label: 'Standard', maxDepth: 2, maxRequests: 400, blurb: 'Main topics plus the long tail.' },
  deep: { label: 'Deep', maxDepth: 3, maxRequests: 800, blurb: 'Full niche map, very specific phrases.' },
}

export const DEFAULT_SEED_METHODS = ['direct', 'alphabet_suffix', 'alphabet_prefix', 'number_suffix', 'questions', 'connectors']
export const DEFAULT_DEEP_METHODS = ['direct']
export const DEFAULT_DELAY_MS = 500

export function createInitialState(config) {
  const seedQueries = generateQueries(config.seed, config.seedMethods, {
    language: config.language,
    customWords: config.customWords,
  })
  return {
    version: STATE_VERSION,
    config,
    status: 'running',
    stopReason: null,
    message: null,
    level: 1,
    queue: seedQueries.map((q) => ({ ...q, parent: config.seed, depth: 1, attempts: 0 })),
    requested: [],
    expanded: [keyOf(config.seed)],
    keywords: {},
    order: [],
    counters: { requests: 0, ok: 0, failed: 0, skipped: 0 },
    failures: [],
    delayMs: config.delayMs,
    consecutiveFails: 0,
    okStreak: 0,
    cooldowns: 0,
    resumeAt: null,
    current: null,
    startedAt: Date.now(),
    finishedAt: null,
  }
}

export function isValidSavedState(state) {
  return Boolean(
    state && state.version === STATE_VERSION && state.config && Array.isArray(state.queue) &&
    state.keywords && typeof state.keywords === 'object' && Array.isArray(state.order),
  )
}

/** Rough request count for level 1, used for the time estimate before starting. */
export function estimateRun(config) {
  const level1 = generateQueries(config.seed || 'x', config.seedMethods, {
    language: config.language,
    customWords: config.customWords,
  }).length
  const requests = config.maxDepth === 1 ? Math.min(level1, config.maxRequests) : config.maxRequests
  const seconds = Math.round(requests * (config.delayMs + 300) / 1000)
  return { requests, seconds, level1 }
}

export class ResearchEngine {
  /**
   * @param {object} state  result of createInitialState() or a saved state
   * @param {object} deps   { fetchSuggestions(query, {country, language}), onUpdate(state), random? }
   */
  constructor(state, { fetchSuggestions, onUpdate = () => {}, random = Math.random } = {}) {
    this.state = state
    this.fetch = fetchSuggestions
    this.onUpdate = onUpdate
    this.random = random
    this.requested = new Set(state.requested)
    this.expanded = new Set(state.expanded)
    this.scheduled = new Set(state.queue.map((w) => keyOf(w.query)))
    this.running = false
    this.wake = null
    this.cooldownTimer = null
    if (state.status === 'cooldown') this.scheduleAutoResume()
  }

  /** Plain JSON snapshot suitable for saving. */
  snapshot() {
    return { ...this.state, requested: [...this.requested], expanded: [...this.expanded] }
  }

  emit() {
    this.onUpdate(this.snapshot())
  }

  pause() {
    if (!['running', 'cooldown'].includes(this.state.status)) return
    this.clearCooldown()
    this.state.status = 'paused'
    this.state.message = null
    this.interruptSleep()
    this.emit()
  }

  stop() {
    if (['completed', 'stopped'].includes(this.state.status)) return
    this.clearCooldown()
    this.finish('user', 'stopped')
    this.interruptSleep()
    this.emit()
  }

  resume() {
    if (!['paused', 'blocked', 'cooldown'].includes(this.state.status)) return
    this.clearCooldown()
    this.state.status = 'running'
    this.state.message = null
    this.state.consecutiveFails = 0
    this.emit()
    return this.run()
  }

  /** Google refused several times in a row: wait, then retry automatically. */
  enterCooldown() {
    const s = this.state
    const ms = Math.min(COOLDOWN_MAX_MS, COOLDOWN_BASE_MS * 2 ** s.cooldowns)
    s.cooldowns += 1
    s.status = 'cooldown'
    s.current = null
    s.resumeAt = Date.now() + ms
    s.message = 'Google asked us to slow down. Your results are saved and the tool will retry automatically.'
    this.scheduleAutoResume()
  }

  scheduleAutoResume() {
    clearTimeout(this.cooldownTimer)
    const wait = Math.max(0, (this.state.resumeAt ?? Date.now()) - Date.now())
    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null
      if (this.state.status === 'cooldown') this.resume()
    }, wait)
  }

  clearCooldown() {
    clearTimeout(this.cooldownTimer)
    this.cooldownTimer = null
    this.state.resumeAt = null
  }

  interruptSleep() {
    if (this.wake) this.wake()
  }

  sleep(ms) {
    return new Promise((resolve) => {
      const timer = setTimeout(done, ms)
      function done() { clearTimeout(timer); resolve() }
      this.wake = done
    }).finally(() => { this.wake = null })
  }

  finish(reason, status = 'completed') {
    this.state.status = status
    this.state.stopReason = reason
    this.state.current = null
    this.state.finishedAt = Date.now()
  }

  async run() {
    if (this.running) return
    this.running = true
    try {
      while (this.state.status === 'running') {
        const s = this.state
        if (s.counters.requests >= s.config.maxRequests) { this.finish('budget'); break }
        if (!s.queue.length) {
          if (!this.planNextLevel()) { this.finish('finished'); break }
          continue
        }
        const work = s.queue[0]
        const key = keyOf(work.query)
        if (this.requested.has(key)) {
          s.queue.shift()
          this.scheduled.delete(key)
          continue
        }

        s.current = { query: work.query, depth: work.depth }
        this.emit()
        let results = null
        try {
          results = await this.fetch(work.query, { country: s.config.country, language: s.config.language })
        } catch (error) {
          this.recordFailure(work, key, error)
        }
        if (results) this.recordSuccess(work, key, results)
        this.emit()

        if (this.state.status === 'running' && (this.state.queue.length || this.state.level < this.state.config.maxDepth)) {
          await this.sleep(this.state.delayMs + Math.floor(this.random() * JITTER_MS))
        }
      }
    } finally {
      this.running = false
      this.state.current = this.state.status === 'running' ? this.state.current : null
      this.emit()
    }
  }

  recordFailure(work, key, error) {
    const s = this.state
    s.counters.requests += 1
    s.counters.failed += 1
    s.consecutiveFails += 1
    s.okStreak = 0
    s.delayMs = Math.min(MAX_DELAY_MS, s.delayMs * 2)
    work.attempts = (work.attempts ?? 0) + 1
    if (work.attempts >= MAX_ATTEMPTS_PER_QUERY) {
      s.queue.shift()
      this.scheduled.delete(key)
      this.requested.add(key)
      if (s.failures.length < 50) s.failures.push({ query: work.query, error: String(error?.message ?? error) })
    }
    if (s.consecutiveFails >= FAILS_BEFORE_PAUSE) this.enterCooldown()
  }

  recordSuccess(work, key, results) {
    const s = this.state
    s.counters.requests += 1
    s.counters.ok += 1
    s.consecutiveFails = 0
    s.okStreak = (s.okStreak ?? 0) + 1
    if (s.okStreak >= OK_STREAK_TO_RESET_COOLDOWN) s.cooldowns = 0
    s.delayMs = Math.max(s.config.delayMs, Math.round(s.delayMs * 0.7))
    s.queue.shift()
    this.scheduled.delete(key)
    this.requested.add(key)

    for (const { text, position } of results) {
      // Every keyword must contain the seed words (any order, plurals and same-root words allowed).
      if (!containsSeed(text, s.config.seed, s.config.language)) {
        s.counters.skipped = (s.counters.skipped ?? 0) + 1
        continue
      }
      const k = keyOf(text)
      const existing = s.keywords[k]
      if (existing) {
        existing.hits += 1
        existing.position = Math.min(existing.position, position)
        continue
      }
      if (s.order.length >= MAX_KEYWORDS) {
        this.finish('keyword_limit')
        return
      }
      s.keywords[k] = {
        text,
        depth: work.depth,
        hits: 1,
        position,
        query: work.query,
        method: work.method,
        parent: work.parent,
      }
      s.order.push(k)
    }
  }

  /** Queue the next level. Returns false when there is nothing more to do. */
  planNextLevel() {
    const s = this.state
    const { config } = s
    if (s.level >= config.maxDepth) return false
    const remaining = config.maxRequests - s.counters.requests
    if (remaining <= 0) return false

    const candidates = s.order
      .map((k) => [k, s.keywords[k]])
      .filter(([k, kw]) => kw.depth === s.level && !this.expanded.has(k) && containsSeed(kw.text, config.seed, config.language))
      .sort(([, a], [, b]) => b.hits - a.hits || a.position - b.position || wordCount(a.text) - wordCount(b.text))

    const isFinalLevel = s.level + 1 === config.maxDepth
    let share = isFinalLevel ? remaining : Math.max(1, Math.floor(remaining * NON_FINAL_LEVEL_SHARE))
    const nextDepth = s.level + 1
    let queued = 0

    for (const [k, kw] of candidates) {
      if (share <= 0) break
      const queries = generateQueries(kw.text, config.deepMethods, {
        language: config.language,
        customWords: config.customWords,
      }).filter((q) => !this.requested.has(keyOf(q.query)) && !this.scheduled.has(keyOf(q.query)))
      if (!queries.length) { this.expanded.add(k); continue }
      if (queries.length > share && queued > 0) break
      this.expanded.add(k)
      for (const q of queries.slice(0, share)) {
        s.queue.push({ ...q, parent: kw.text, depth: nextDepth, attempts: 0 })
        this.scheduled.add(keyOf(q.query))
        share -= 1
        queued += 1
      }
    }

    s.level = nextDepth
    return queued > 0 || this.planNextLevel()
  }
}
