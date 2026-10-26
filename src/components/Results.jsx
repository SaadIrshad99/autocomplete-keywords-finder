import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { INTENTS, analyze } from '../lib/analysis.js'
import { downloadText, safeFilename, toCsv } from '../lib/csv.js'
import { methodLabel } from '../lib/expansion.js'
import { applyCleanup, prepareRow, presentSuggestions } from '../lib/cleanup.js'
import CleanupPanel from './CleanupPanel.jsx'

const PAGE_SIZE = 100
const intentLabel = (id) => INTENTS.find((i) => i.id === id)?.label ?? id

const EMPTY_FILTERS = { search: '', intent: 'all', minWords: 0, depth: 'all', topic: 'all', starredOnly: false }

const CSV_COLUMNS = [
  { label: 'Keyword', value: (r) => r.text },
  { label: 'Words', value: (r) => r.words },
  { label: 'Intent', value: (r) => r.intents.map(intentLabel).join(', ') },
  { label: 'Topic', value: (r) => r.topic },
  { label: 'New words', value: (r) => r.newWords.join(' ') },
  { label: 'Hits', value: (r) => r.hits },
  { label: 'Best position', value: (r) => r.position },
  { label: 'Depth', value: (r) => r.depth },
  { label: 'Found by query', value: (r) => r.query },
  { label: 'Method', value: (r) => methodLabel(r.method) },
  { label: 'Starred', value: (r) => (r.starred ? 'yes' : '') },
]

const SORTS = {
  hits: (a, b) => b.hits - a.hits || a.position - b.position,
  keyword: (a, b) => a.text.localeCompare(b.text),
  words: (a, b) => b.words - a.words || b.hits - a.hits,
  position: (a, b) => a.position - b.position || b.hits - a.hits,
  depth: (a, b) => a.depth - b.depth || b.hits - a.hits,
  topic: (a, b) => (a.topic === 'other') - (b.topic === 'other') || a.topic.localeCompare(b.topic) || b.hits - a.hits,
  found: (a, b) => a.index - b.index,
}

export default function Results({ research, starred, onToggleStar, cleanup, onCleanupChange }) {
  const [tab, setTab] = useState('keywords')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('hits')
  const [page, setPage] = useState(0)

  // research.keywords is mutated in place by the engine, so key the memo on counts.
  const count = research.order.length
  // While a run is going, refresh the analysis at most about once a second.
  const liveVersion = `${count}:${research.counters.requests}:${research.status}`
  const version = useDeferredValue(useThrottled(liveVersion, research.status === 'running' ? 1200 : 0))
  const prepared = useRef(new Map())
  const base = useMemo(
    () => research.order.map((key, index) => {
      const kw = research.keywords[key]
      let lookup = prepared.current.get(key)
      if (!lookup) {
        const { tokens, tokenSet, joined } = prepareRow(kw)
        lookup = { tokens, tokenSet, joined }
        prepared.current.set(key, lookup)
      }
      return { key, index, ...kw, ...lookup }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )
  const cleaned = useMemo(() => applyCleanup(base, cleanup, research.config.seed), [base, cleanup, research.config.seed])
  const analysis = useMemo(
    () => analyze(cleaned.kept, { seed: research.config.seed, language: research.config.language }),
    [cleaned, research.config.seed, research.config.language],
  )
  const suggestions = useMemo(
    () => presentSuggestions(base, research.config.language, cleanup.exclude),
    [base, research.config.language, cleanup.exclude],
  )

  function excludeWord(word) {
    if (!cleanup.exclude.includes(word)) onCleanupChange({ ...cleanup, exclude: [...cleanup.exclude, word] })
  }

  const rows = useMemo(
    () => analysis.rows.map((r) => ({ ...r, starred: starred.has(r.key) })),
    [analysis, starred],
  )

  const filtered = useMemo(() => {
    const needle = filters.search.trim().toLocaleLowerCase()
    const out = rows.filter((r) =>
      (!needle || r.text.toLocaleLowerCase().includes(needle)) &&
      (filters.intent === 'all' || r.intents.includes(filters.intent)) &&
      r.words >= filters.minWords &&
      (filters.depth === 'all' || r.depth === Number(filters.depth)) &&
      (filters.topic === 'all' || r.topic === filters.topic) &&
      (!filters.starredOnly || r.starred))
    return out.sort(SORTS[sort])
  }, [rows, filters, sort])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pages - 1)
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS)

  function update(patch) {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }

  function showInTable(patch) {
    setFilters({ ...EMPTY_FILTERS, ...patch })
    setPage(0)
    setTab('keywords')
  }

  function exportRows(list, suffix) {
    const name = `${safeFilename(research.config.seed)}-${research.config.country}-${suffix}.csv`
    downloadText(name, toCsv(list, CSV_COLUMNS))
  }

  if (!count) {
    return (
      <section className="card empty">
        <h2>Results</h2>
        <p>{research.status === 'running' ? 'Waiting for the first suggestions…' : 'No keywords were found. Try a shorter or more common seed.'}</p>
      </section>
    )
  }

  const starredRows = rows.filter((r) => r.starred)

  return (
    <section className="card results" aria-label="Results">
      <div className="results-head">
        <div className="tabs" role="tablist">
          <Tab id="keywords" tab={tab} setTab={setTab}>Keywords <span>{rows.length.toLocaleString()}</span></Tab>
          <Tab id="topics" tab={tab} setTab={setTab}>Topics <span>{analysis.topics.length}</span></Tab>
          <Tab id="words" tab={tab} setTab={setTab}>New words <span>{analysis.words.length}</span></Tab>
        </div>
        <div className="export">
          <button type="button" className="btn small" onClick={() => exportRows(filtered, isFiltered ? 'filtered' : 'all')}>
            Export {isFiltered ? `filtered (${filtered.length})` : 'CSV'}
          </button>
          {starredRows.length > 0 && (
            <button type="button" className="btn small" onClick={() => exportRows(starredRows, 'starred')}>Export starred ({starredRows.length})</button>
          )}
        </div>
      </div>

      <CleanupPanel
        cleanup={cleanup}
        onChange={(next) => { onCleanupChange(next); setPage(0) }}
        suggestions={suggestions}
        summary={{ total: base.length, kept: cleaned.kept.length, hidden: cleaned.hidden, reasons: cleaned.reasons }}
      />

      {tab === 'keywords' && (
        <>
          <div className="filters">
            <input type="search" placeholder="Search keywords" value={filters.search} onChange={(e) => update({ search: e.target.value })} aria-label="Search keywords" />
            <select value={filters.intent} onChange={(e) => update({ intent: e.target.value })} aria-label="Intent">
              <option value="all">All intents</option>
              {INTENTS.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
            <select value={filters.minWords} onChange={(e) => update({ minWords: Number(e.target.value) })} aria-label="Minimum words">
              <option value={0}>Any length</option>
              {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}+ words</option>)}
            </select>
            <select value={filters.depth} onChange={(e) => update({ depth: e.target.value })} aria-label="Depth">
              <option value="all">All depths</option>
              {[1, 2, 3].filter((d) => d <= research.config.maxDepth).map((d) => <option key={d} value={d}>Depth {d}</option>)}
            </select>
            <select value={filters.topic} onChange={(e) => update({ topic: e.target.value })} aria-label="Topic">
              <option value="all">All topics</option>
              {analysis.topics.map((t) => <option key={t.topic} value={t.topic}>{t.topic} ({t.count})</option>)}
            </select>
            <label className="check inline">
              <input type="checkbox" checked={filters.starredOnly} onChange={(e) => update({ starredOnly: e.target.checked })} />
              <span>Starred only</span>
            </label>
            {isFiltered && <button type="button" className="btn small ghost" onClick={() => update(EMPTY_FILTERS)}>Clear filters</button>}
          </div>

          <div className="count-row">
            <p className="count">{filtered.length.toLocaleString()} keyword{filtered.length === 1 ? '' : 's'}{isFiltered ? ' match' : ''}</p>
            <ColumnGuide />
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="star-col" title={COLUMN_HELP.star.tip}><span className="sr">Star</span></th>
                  <SortTh id="keyword" sort={sort} setSort={setSort} title={COLUMN_HELP.keyword.tip}>Keyword</SortTh>
                  <SortTh id="words" sort={sort} setSort={setSort} num title={COLUMN_HELP.words.tip}>Words</SortTh>
                  <th title={COLUMN_HELP.intent.tip}>Intent</th>
                  <SortTh id="topic" sort={sort} setSort={setSort} title={COLUMN_HELP.topic.tip}>Topic</SortTh>
                  <SortTh id="hits" sort={sort} setSort={setSort} num title={COLUMN_HELP.hits.tip}>Hits</SortTh>
                  <SortTh id="position" sort={sort} setSort={setSort} num title={COLUMN_HELP.position.tip}>Pos.</SortTh>
                  <SortTh id="depth" sort={sort} setSort={setSort} num title={COLUMN_HELP.depth.tip}>Depth</SortTh>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.key} className={r.starred ? 'is-starred' : ''}>
                    <td className="star-col">
                      <button type="button" className={`star ${r.starred ? 'on' : ''}`} onClick={() => onToggleStar(r.key)} aria-pressed={r.starred} aria-label={r.starred ? 'Unstar' : 'Star'}>★</button>
                    </td>
                    <td className="kw" title={`Found by “${r.query}”`}>{r.text}</td>
                    <td className="num">{r.words}</td>
                    <td>{r.intents.map((i) => <span key={i} className={`tag ${i}`}>{intentLabel(i)}</span>)}</td>
                    <td><button type="button" className="link" onClick={() => update({ topic: r.topic })}>{r.topic}</button></td>
                    <td className="num">{r.hits}</td>
                    <td className="num">{r.position}</td>
                    <td className="num">{r.depth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="pager">
              <button type="button" className="btn small" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
              <span>Page {safePage + 1} of {pages}</span>
              <button type="button" className="btn small" disabled={safePage >= pages - 1} onClick={() => setPage(safePage + 1)}>Next</button>
            </div>
          )}
        </>
      )}

      {tab === 'topics' && <Topics analysis={analysis} rows={rows} onOpen={(topic) => showInTable({ topic })} />}

      {tab === 'words' && <Words words={analysis.words} seed={research.config.seed} onOpen={(word) => showInTable({ search: word })} onExclude={excludeWord} />}
    </section>
  )
}

// Short tips appear when hovering a column header; the guide shows the full explanation.
const COLUMN_HELP = {
  star: {
    label: '★',
    tip: 'Star keywords you want to keep, then export only the starred ones.',
    text: 'Click the star to shortlist a keyword. Use “Starred only” to see your shortlist and “Export starred” to download it.',
  },
  keyword: {
    label: 'Keyword',
    tip: 'A real search Google suggested. Hover a keyword to see which query found it.',
    text: 'A search phrase Google suggested in its autocomplete list, so real people search it. Hover over a keyword to see the query that found it.',
  },
  words: {
    label: 'Words',
    tip: 'Number of words. 4+ words usually means a specific, easier-to-rank long-tail keyword.',
    text: 'How many words the keyword has. Longer keywords (4+ words) are more specific and usually have less competition: good targets for blog posts.',
  },
  intent: {
    label: 'Intent',
    tip: 'What the searcher wants: Question, Comparison, Commercial, Local, Year or Informational.',
    text: 'What the searcher is probably looking for, based on the words in the keyword: Question (how, what, why…), Comparison (vs, or, difference…), Commercial (best, price, cheap, app…), Local (near me…), Year (contains a year like 2026), or Informational (none of these). A keyword can have more than one.',
  },
  topic: {
    label: 'Topic',
    tip: 'The sub-topic this keyword belongs to. One topic is roughly one article.',
    text: 'The keyword’s most common word that isn’t part of your seed, e.g. “days” for “age calculator in days”. Keywords with the same topic can usually be covered in one article. “other” means no shared word was found.',
  },
  hits: {
    label: 'Hits',
    tip: 'How many different searches returned this keyword. Higher = probably more popular.',
    text: 'How many of the tool’s different queries made Google suggest this keyword. Example: if “age calculator”, “age calculator i” and “age calculator d” all suggested it, Hits = 3. Google suggests popular searches more often, so a high number is a hint of popularity. It is not search volume.',
  },
  position: {
    label: 'Pos.',
    tip: 'Best place it appeared in Google’s suggestion list. 1 = top of the list.',
    text: 'Where the keyword appeared in Google’s autocomplete list (1 = first suggestion, up to about 15). Google lists more popular searches higher, so a lower number is better. If it appeared in several lists, the best position is shown.',
  },
  depth: {
    label: 'Depth',
    tip: '1 = found from your seed; 2–3 = found by searching earlier results (more specific).',
    text: 'How the keyword was found. 1 = from your seed keyword directly. 2 = from searching a depth-1 keyword again. 3 = from searching a depth-2 keyword. Higher depth usually means longer, more specific phrases.',
  },
}

function ColumnGuide() {
  return (
    <details className="column-guide">
      <summary>What do the columns mean?</summary>
      <dl>
        {Object.values(COLUMN_HELP).map((c) => (
          <div key={c.label}>
            <dt>{c.label}</dt>
            <dd>{c.text}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">Tip: a good blog keyword is often 4+ words, a Question or Informational intent, and in a clear topic. Hits and Pos. are popularity hints only, not search volume.</p>
    </details>
  )
}

function Tab({ id, tab, setTab, children }) {
  return (
    <button type="button" role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
      {children}
    </button>
  )
}

function SortTh({ id, sort, setSort, num, title, children }) {
  return (
    <th className={num ? 'num' : ''} aria-sort={sort === id ? 'descending' : 'none'} title={title}>
      <button type="button" className={`sort ${sort === id ? 'on' : ''}`} onClick={() => setSort(id)}>{children}</button>
    </th>
  )
}

function Topics({ analysis, rows, onOpen }) {
  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows])
  return (
    <>
      <p className="hint">Keywords grouped by their most common new word. Each group is roughly one article or page.</p>
      <div className="topics">
        {analysis.topics.map((t) => {
          const items = t.keys.map((k) => byKey.get(k)).sort(SORTS.hits)
          return (
            <article key={t.topic} className="topic">
              <header>
                <h3>{t.topic}</h3>
                <span>{t.count} keyword{t.count === 1 ? '' : 's'}</span>
              </header>
              <ul>
                {items.slice(0, 6).map((r) => <li key={r.key}>{r.text}</li>)}
              </ul>
              <button type="button" className="btn small" onClick={() => onOpen(t.topic)}>
                {t.count > 6 ? `See all ${t.count}` : 'Open in table'}
              </button>
            </article>
          )
        })}
      </div>
    </>
  )
}

function Words({ words, seed, onOpen, onExclude }) {
  const max = words[0]?.count ?? 1
  return (
    <>
      <p className="hint">Words that appear in results but not in “{seed}”, ranked by how many keywords contain them. These are the sub-topics of the niche. Click ✕ to hide every keyword containing a word that doesn’t fit your niche.</p>
      <div className="table-wrap words-wrap">
        <table className="words">
          <thead><tr><th className="x-col"><span className="sr">Exclude</span></th><th>Word</th><th className="num">Keywords</th><th aria-hidden="true" /></tr></thead>
          <tbody>
            {words.slice(0, 300).map((w) => (
              <tr key={w.word}>
                <td className="x-col"><button type="button" className="x" onClick={() => onExclude(w.word)} aria-label={`Exclude keywords containing ${w.word}`} title={`Hide all ${w.count} keywords containing “${w.word}”`}>✕</button></td>
                <td><button type="button" className="link" onClick={() => onOpen(w.word)}>{w.word}</button></td>
                <td className="num">{w.count}</td>
                <td className="bar-cell"><div className="mini-bar" style={{ width: `${Math.max(2, (w.count / max) * 100)}%` }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {words.length > 300 && <p className="hint">Showing the top 300 of {words.length} words.</p>}
    </>
  )
}

/** Returns `value`, updated at most once per `ms` (always delivers the latest value). */
function useThrottled(value, ms) {
  const [shown, setShown] = useState(value)
  const last = useRef(0)
  useEffect(() => {
    if (!ms) { last.current = Date.now(); setShown(value); return undefined }
    const wait = Math.max(0, last.current + ms - Date.now())
    const id = setTimeout(() => { last.current = Date.now(); setShown(value) }, wait)
    return () => clearTimeout(id)
  }, [value, ms])
  return ms ? shown : value
}
