import { useState } from 'react'
import { LONG_KEYWORD_WORDS, parseTerms } from '../lib/cleanup.js'

export default function CleanupPanel({ cleanup, onChange, suggestions, summary }) {
  const [excludeText, setExcludeText] = useState('')
  const [includeText, setIncludeText] = useState('')

  function addTerms(list, text, reset) {
    const terms = parseTerms(text).filter((t) => !cleanup[list].includes(t))
    if (terms.length) onChange({ ...cleanup, [list]: [...cleanup[list], ...terms] })
    reset('')
  }

  function removeTerm(list, term) {
    onChange({ ...cleanup, [list]: cleanup[list].filter((t) => t !== term) })
  }

  const { reasons } = summary
  const parts = [
    reasons.exclude && `${reasons.exclude.toLocaleString()} by excluded words`,
    reasons.include && `${reasons.include.toLocaleString()} without a must-include word`,
    reasons.script && `${reasons.script.toLocaleString()} in another language`,
    reasons.long && `${reasons.long.toLocaleString()} very long`,
  ].filter(Boolean)

  return (
    <details className="cleanup" open>
      <summary>
        <span>Clean up</span>
        <span className="cleanup-summary">
          Showing <b>{summary.kept.toLocaleString()}</b> of {summary.total.toLocaleString()}
          {summary.hidden > 0 && ` · ${summary.hidden.toLocaleString()} hidden`}
        </span>
      </summary>

      <div className="cleanup-grid">
        <div className="cleanup-box">
          <h3>Exclude keywords containing</h3>
          <form className="term-input" onSubmit={(e) => { e.preventDefault(); addTerms('exclude', excludeText, setExcludeText) }}>
            <input value={excludeText} onChange={(e) => setExcludeText(e.target.value)} placeholder="e.g. jobs, reddit, competitor name" aria-label="Words to exclude" />
            <button type="submit" className="btn small">Exclude</button>
          </form>
          <Chips terms={cleanup.exclude} onRemove={(t) => removeTerm('exclude', t)} tone="exclude" />
          {suggestions.length > 0 && (
            <div className="suggestions">
              <span className="hint">Suggested from your results:</span>
              {suggestions.slice(0, 12).map((s) => (
                <button key={s.term} type="button" className="chip suggest" onClick={() => onChange({ ...cleanup, exclude: [...cleanup.exclude, s.term] })} title={`Exclude ${s.count} keywords containing “${s.term}”`}>
                  + {s.term} <small>{s.count}</small>
                </button>
              ))}
            </div>
          )}
          <p className="hint">Tip: open the <b>New words</b> tab and click ✕ next to anything that doesn’t belong in your niche.</p>
        </div>

        <div className="cleanup-box">
          <h3>Only keep keywords containing <small>(any of)</small></h3>
          <form className="term-input" onSubmit={(e) => { e.preventDefault(); addTerms('include', includeText, setIncludeText) }}>
            <input value={includeText} onChange={(e) => setIncludeText(e.target.value)} placeholder="e.g. days, months, years" aria-label="Words to require" />
            <button type="submit" className="btn small">Add</button>
          </form>
          <Chips terms={cleanup.include} onRemove={(t) => removeTerm('include', t)} tone="include" />
          {!cleanup.include.length && <p className="hint">Leave empty to keep everything.</p>}

          <div className="toggles">
            <label className="check">
              <input type="checkbox" checked={cleanup.hideOtherScripts} onChange={(e) => onChange({ ...cleanup, hideOtherScripts: e.target.checked })} />
              <span>Hide keywords in another language/script</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={cleanup.hideLong} onChange={(e) => onChange({ ...cleanup, hideLong: e.target.checked })} />
              <span>Hide very long keywords ({LONG_KEYWORD_WORDS}+ words)</span>
            </label>
          </div>
        </div>
      </div>

      {parts.length > 0 && <p className="hint">Hidden: {parts.join(' · ')}. Remove a rule to bring them back.</p>}
    </details>
  )
}

function Chips({ terms, onRemove, tone }) {
  if (!terms.length) return null
  return (
    <div className="chips">
      {terms.map((t) => (
        <span key={t} className={`chip ${tone}`}>
          {t}
          <button type="button" onClick={() => onRemove(t)} aria-label={`Remove ${t}`}>×</button>
        </span>
      ))}
    </div>
  )
}
