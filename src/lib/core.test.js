import { describe, expect, it } from 'vitest'
import { analyze, detectIntents } from './analysis.js'
import { csvCell, toCsv } from './csv.js'
import { DEFAULT_DEEP_METHODS, DEFAULT_SEED_METHODS, ResearchEngine, createInitialState, estimateRun } from './engine.js'
import { generateQueries } from './expansion.js'
import { parseSuggestResponse } from './suggest.js'
import { containsSeed, keyOf, tokenize } from './text.js'

const baseConfig = (over = {}) => ({
  seed: 'age calculator',
  country: 'us',
  language: 'en',
  maxDepth: 2,
  maxRequests: 400,
  delayMs: 0,
  seedMethods: DEFAULT_SEED_METHODS,
  deepMethods: DEFAULT_DEEP_METHODS,
  customWords: [],
  ...over,
})

// Fake Google: returns 3 suggestions per query that extend the query.
function fakeGoogle({ failOn = () => false } = {}) {
  const calls = []
  const fetch = async (query) => {
    calls.push(query)
    if (failOn(query, calls.length)) throw new Error('blocked')
    return ['one', 'two three', 'four'].map((w, i) => ({ text: `${query} ${w}`, type: 'QUERY', position: i + 1 }))
      .concat([{ text: 'age calculator', type: 'QUERY', position: 4 }])
  }
  return { fetch, calls }
}

async function runEngine(config, google = fakeGoogle()) {
  const engine = new ResearchEngine(createInitialState(config), { fetchSuggestions: google.fetch, random: () => 0 })
  engine.sleep = async () => {}
  await engine.run()
  return { engine, google, state: engine.snapshot() }
}

describe('parseSuggestResponse', () => {
  it('reads keywords, positions and drops websites', () => {
    const out = parseSuggestResponse(['q', ['a', 'b.com', 'c', 'a'], [], [], { 'google:suggesttype': ['QUERY', 'NAVIGATION', 'QUERY', 'QUERY'] }])
    expect(out).toEqual([
      { text: 'a', type: 'QUERY', position: 1 },
      { text: 'c', type: 'QUERY', position: 3 },
    ])
  })
  it('works without metadata and rejects junk', () => {
    expect(parseSuggestResponse(['q', ['x']])).toEqual([{ text: 'x', type: 'QUERY', position: 1 }])
    expect(() => parseSuggestResponse({})).toThrow()
  })
})

describe('text helpers', () => {
  it('tokenizes unicode and matches plurals', () => {
    expect(tokenize('Age  Calculator’s 2026!')).toEqual(['age', 'calculator’s', '2026'])
    expect(containsSeed('best age calculators online', 'age calculator')).toBe(true)
    expect(containsSeed('calculator for age in days', 'age calculator')).toBe(true)
    expect(containsSeed('pregnancy due date', 'age calculator')).toBe(false)
    expect(containsSeed('محاسبة العمر بالهجري', 'محاسبة العمر')).toBe(true)
  })
})

describe('generateQueries', () => {
  it('builds the default level-1 set without duplicates', () => {
    const q = generateQueries('age calculator', DEFAULT_SEED_METHODS)
    expect(q.length).toBe(1 + 26 + 26 + 10 + 12 + 10)
    expect(q[0]).toEqual({ query: 'age calculator', method: 'direct' })
    expect(q.map((x) => x.query)).toContain('how age calculator')
    expect(q.map((x) => x.query)).toContain('age calculator vs')
    expect(new Set(q.map((x) => keyOf(x.query))).size).toBe(q.length)
  })
  it('uses language word lists and custom words', () => {
    const pt = generateQueries('calculadora de idade', ['questions', 'custom'], { language: 'pt', customWords: ['online'] })
    expect(pt.map((x) => x.query)).toContain('como calculadora de idade')
    expect(pt.map((x) => x.query)).toContain('calculadora de idade online')
  })
})

describe('ResearchEngine', () => {
  it('quick run sends exactly the level-1 queries', async () => {
    const { state, google } = await runEngine(baseConfig({ maxDepth: 1, maxRequests: 100 }))
    expect(google.calls.length).toBe(85)
    expect(state.status).toBe('completed')
    expect(state.stopReason).toBe('finished')
    expect(Object.values(state.keywords).every((k) => k.depth === 1)).toBe(true)
  })

  it('never exceeds the request budget and goes deeper', async () => {
    const { state, google } = await runEngine(baseConfig({ maxDepth: 3, maxRequests: 300 }))
    expect(google.calls.length).toBe(300)
    expect(state.counters.requests).toBe(300)
    const depths = new Set(Object.values(state.keywords).map((k) => k.depth))
    expect(depths).toEqual(new Set([1, 2, 3]))
    expect(new Set(google.calls).size).toBe(google.calls.length)
  })

  it('counts hits and keeps the best position', async () => {
    const { state } = await runEngine(baseConfig({ maxDepth: 1 }))
    const seedKw = state.keywords['age calculator']
    expect(seedKw.hits).toBe(85)
    expect(seedKw.position).toBe(4)
  })

  it('only expands keywords that still contain the seed', async () => {
    const google = {
      calls: [],
      async fetch(q) {
        this.calls.push(q)
        if (q === 'age calculator') return [{ text: 'age calculator days', position: 1 }, { text: 'unrelated topic', position: 2 }]
        return []
      },
    }
    google.fetch = google.fetch.bind(google)
    await runEngine(baseConfig({ seedMethods: ['direct'] }), google)
    expect(google.calls).toEqual(['age calculator', 'age calculator days'])
  })

  it('backs off and pauses when Google keeps failing, then resumes', async () => {
    let failing = true
    const google = fakeGoogle({ failOn: () => failing })
    const { engine, state } = await runEngine(baseConfig({ maxDepth: 1, delayMs: 500 }), google)
    expect(state.status).toBe('blocked')
    expect(state.counters.failed).toBe(5)
    expect(state.delayMs).toBeGreaterThan(500)
    failing = false
    await engine.resume()
    const after = engine.snapshot()
    expect(after.status).toBe('completed')
    // The first query failed 3 times and was skipped; everything else succeeded.
    expect(after.counters.ok).toBe(84)
    expect(after.failures).toHaveLength(1)
  })

  it('survives a save/restore round trip mid-run', async () => {
    const google = fakeGoogle()
    const engine = new ResearchEngine(createInitialState(baseConfig({ maxDepth: 2, maxRequests: 200 })), { fetchSuggestions: google.fetch, random: () => 0 })
    let n = 0
    engine.sleep = async () => { if (++n === 40) engine.pause() }
    await engine.run()
    const saved = JSON.parse(JSON.stringify(engine.snapshot()))
    expect(saved.status).toBe('paused')
    const restored = new ResearchEngine(saved, { fetchSuggestions: google.fetch, random: () => 0 })
    restored.sleep = async () => {}
    await restored.resume()
    const final = restored.snapshot()
    expect(final.counters.requests).toBe(200)
    expect(new Set(google.calls).size).toBe(google.calls.length)
  })

  it('estimates run time', () => {
    expect(estimateRun(baseConfig({ maxDepth: 1, maxRequests: 100, delayMs: 500 }))).toMatchObject({ requests: 85, level1: 85 })
    expect(estimateRun(baseConfig({ maxDepth: 2, maxRequests: 400, delayMs: 500 })).requests).toBe(400)
  })
})

describe('analysis', () => {
  it('tags intents', () => {
    expect(detectIntents('how to calculate age in days')).toContain('question')
    expect(detectIntents('age calculator vs date calculator')).toContain('comparison')
    expect(detectIntents('best age calculator app')).toContain('commercial')
    expect(detectIntents('age calculator near me')).toContain('local')
    expect(detectIntents('age calculator 2026')).toContain('year')
    expect(detectIntents('age calculator in days')).toEqual(['informational'])
  })

  it('finds new words and groups topics', () => {
    const kws = ['age calculator in days', 'age calculator days and months', 'how many days old age calculator',
      'birthday age calculator', 'age calculator birthday countdown', 'chronological age calculator']
      .map((text) => ({ key: keyOf(text), text }))
    const { rows, words, topics } = analyze(kws, { seed: 'age calculator', language: 'en' })
    expect(words[0]).toEqual({ word: 'days', count: 3 })
    expect(words.find((w) => w.word === 'birthday').count).toBe(2)
    expect(rows[0].words).toBe(4)
    expect(topics.map((t) => t.topic)).toEqual(['days', 'birthday', 'other'])
    expect(rows.find((r) => r.text === 'chronological age calculator').topic).toBe('other')
  })
})

describe('csv', () => {
  it('neutralizes formulas and quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell(5)).toBe('5')
    const csv = toCsv([{ a: 'x' }], [{ label: 'A', value: (r) => r.a }])
    expect(csv.startsWith('﻿A\r\nx')).toBe(true)
  })
})
