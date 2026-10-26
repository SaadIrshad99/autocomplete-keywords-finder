import { useMemo, useState } from 'react'
import { DEFAULT_DEEP_METHODS, DEFAULT_DELAY_MS, DEFAULT_SEED_METHODS, PRESETS, PUBLIC_MAX_REQUESTS, estimateRun } from '../lib/engine.js'
import { METHODS } from '../lib/expansion.js'
import { COUNTRIES, LANGUAGES, defaultLanguageFor } from '../lib/locales.js'
import { cleanText } from '../lib/text.js'

function formatDuration(seconds) {
  if (seconds < 60) return `about ${seconds} sec`
  return `about ${Math.round(seconds / 60)} min`
}

export default function SetupForm({ onStart }) {
  const [seed, setSeed] = useState('')
  const [country, setCountry] = useState('us')
  const [language, setLanguage] = useState('en')
  const [preset, setPreset] = useState('standard')
  const [maxDepth, setMaxDepth] = useState(PRESETS.standard.maxDepth)
  const [maxRequests, setMaxRequests] = useState(PRESETS.standard.maxRequests)
  const [delay, setDelay] = useState(DEFAULT_DELAY_MS / 1000)
  const [seedMethods, setSeedMethods] = useState(DEFAULT_SEED_METHODS)
  const [deepMethods, setDeepMethods] = useState(DEFAULT_DEEP_METHODS)
  const [customText, setCustomText] = useState('')
  const [error, setError] = useState('')

  const customWords = useMemo(
    () => [...new Set(customText.split(/[\n,]+/).map(cleanText).filter(Boolean))].slice(0, 30),
    [customText],
  )

  const config = {
    seed: cleanText(seed),
    country,
    language,
    maxDepth,
    maxRequests,
    delayMs: Math.round(delay * 1000),
    seedMethods,
    deepMethods,
    customWords,
  }
  const estimate = estimateRun(config)

  function choosePreset(id) {
    setPreset(id)
    setMaxDepth(PRESETS[id].maxDepth)
    setMaxRequests(PRESETS[id].maxRequests)
  }

  function chooseCountry(code) {
    setCountry(code)
    setLanguage(defaultLanguageFor(code))
  }

  function toggle(list, setList, id) {
    setList(list.includes(id) ? list.filter((m) => m !== id) : [...list, id])
  }

  function submit(event) {
    event.preventDefault()
    if (!config.seed) return setError('Enter a seed keyword.')
    if (config.seed.length > 120) return setError('Keep the seed under 120 characters.')
    if (!seedMethods.length) return setError('Choose at least one method for the seed.')
    if (maxDepth > 1 && !deepMethods.length) return setError('Choose at least one method for deeper levels.')
    if ((seedMethods.includes('custom') || deepMethods.includes('custom')) && !customWords.length) {
      return setError('Add your own words, or untick “Your own words”.')
    }
    setError('')
    onStart({ ...config, maxRequests: Math.max(config.maxRequests, maxDepth === 1 ? estimate.level1 : 1) })
  }

  const isCustomPreset = PRESETS[preset].maxDepth !== maxDepth || PRESETS[preset].maxRequests !== maxRequests

  return (
    <form className="card setup" onSubmit={submit} noValidate>
      <div className="field seed-field">
        <label htmlFor="seed">Seed keyword</label>
        <input id="seed" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. age calculator" autoComplete="off" autoFocus />
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="country">Country</label>
          <select id="country" value={country} onChange={(e) => chooseCountry(e.target.value)}>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="language">Language</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </div>
      </div>
      <p className="hint">Results are approximate for the chosen country — Google also uses your own location. A VPN in that country gives the closest match.</p>

      <fieldset className="presets">
        <legend>How deep?</legend>
        {Object.entries(PRESETS).map(([id, p]) => (
          <label key={id} className={`preset ${preset === id ? 'selected' : ''}`}>
            <input type="radio" name="preset" value={id} checked={preset === id} onChange={() => choosePreset(id)} />
            <span className="preset-name">{p.label}</span>
            <span className="preset-meta">Depth {p.maxDepth} · {p.maxRequests} requests</span>
            <span className="preset-blurb">{p.blurb}</span>
          </label>
        ))}
      </fieldset>

      <details className="advanced">
        <summary>Advanced settings{isCustomPreset ? ' (changed)' : ''}</summary>
        <div className="field-row">
          <div className="field">
            <label htmlFor="depth">Depth</label>
            <select id="depth" value={maxDepth} onChange={(e) => setMaxDepth(Number(e.target.value))}>
              <option value={1}>1 — seed only</option>
              <option value={2}>2 — plus long tail</option>
              <option value={3}>3 — very specific</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="requests">Max requests</label>
            <input id="requests" type="number" min={20} max={PUBLIC_MAX_REQUESTS} step={10} value={maxRequests}
              onChange={(e) => setMaxRequests(Math.min(PUBLIC_MAX_REQUESTS, Math.max(20, Number(e.target.value) || 20)))} />
          </div>
          <div className="field">
            <label htmlFor="delay">Delay between requests (sec)</label>
            <input id="delay" type="number" min={0.5} max={5} step={0.1} value={delay}
              onChange={(e) => setDelay(Math.min(5, Math.max(0.5, Number(e.target.value) || 0.5)))} />
          </div>
        </div>

        <div className="methods">
          <div>
            <h3>Methods for the seed</h3>
            {METHODS.map((m) => (
              <label key={m.id} className="check">
                <input type="checkbox" checked={seedMethods.includes(m.id)} onChange={() => toggle(seedMethods, setSeedMethods, m.id)} />
                <span><b>{m.label}</b> <small>{m.hint}</small></span>
              </label>
            ))}
          </div>
          <div>
            <h3>Methods for deeper levels</h3>
            <p className="hint">Applied to each promising keyword found. “Keyword itself” is the most efficient: one request, up to 15 longer phrases.</p>
            {METHODS.map((m) => (
              <label key={m.id} className="check">
                <input type="checkbox" checked={deepMethods.includes(m.id)} onChange={() => toggle(deepMethods, setDeepMethods, m.id)} disabled={maxDepth === 1} />
                <span><b>{m.label}</b></span>
              </label>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="custom">Your own words (comma or new line)</label>
          <textarea id="custom" rows={2} value={customText} onChange={(e) => setCustomText(e.target.value)} placeholder="e.g. online, for kids, in excel" />
        </div>
      </details>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="submit-row">
        <button type="submit" className="btn primary">Find keywords</button>
        <span className="estimate">
          Up to {estimate.requests} requests · {formatDuration(estimate.seconds)}. Keep this tab open while it runs.
        </span>
      </div>
    </form>
  )
}
