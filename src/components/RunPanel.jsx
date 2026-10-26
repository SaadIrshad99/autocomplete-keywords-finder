import { useEffect, useState } from 'react'
import { COUNTRIES, LANGUAGES } from '../lib/locales.js'

const STATUS = {
  running: { label: 'Running', tone: 'active' },
  paused: { label: 'Paused', tone: 'warn' },
  blocked: { label: 'Waiting for Google', tone: 'bad' },
  cooldown: { label: 'Cooling down', tone: 'warn' },
  completed: { label: 'Done', tone: 'good' },
  stopped: { label: 'Stopped', tone: 'neutral' },
}

const STOP_REASONS = {
  finished: 'Finished — nothing left to explore within the settings.',
  budget: 'Finished — used the full request budget.',
  keyword_limit: 'Stopped at the keyword limit.',
  user: 'Stopped by you. Everything found so far is kept.',
}

export default function RunPanel({ research, onPause, onResume, onStop, onReset, storageOk }) {
  const { config, counters, status } = research
  const pct = status === 'completed' ? 100 : Math.min(100, Math.round((counters.requests / config.maxRequests) * 100))
  const s = STATUS[status] ?? STATUS.stopped
  const country = COUNTRIES.find((c) => c.code === config.country)?.name ?? config.country
  const language = LANGUAGES.find((l) => l.code === config.language)?.name ?? config.language
  const active = status === 'running'
  const canResume = status === 'paused' || status === 'blocked'
  const coolingDown = status === 'cooldown'
  const finished = status === 'completed' || status === 'stopped'

  return (
    <section className="card run" aria-label="Research progress">
      <div className="run-head">
        <div>
          <p className="eyebrow">{country} · {language} · depth {config.maxDepth}</p>
          <h2>{config.seed}</h2>
        </div>
        <span className={`pill ${s.tone}`}>{s.label}</span>
      </div>

      <div className="stats">
        <Stat label="Keywords" value={research.order.length.toLocaleString()} />
        <Stat label="Requests" value={`${counters.requests} / ${config.maxRequests}`} />
        <Stat label="Level" value={`${Math.min(research.level, config.maxDepth)} / ${config.maxDepth}`} />
        <Stat label="Off-topic skipped" value={(counters.skipped ?? 0).toLocaleString()} />
      </div>

      <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={config.maxRequests} aria-valuenow={counters.requests} aria-label="Requests used">
        <div style={{ width: `${pct}%` }} />
      </div>

      {active && research.current && (
        <p className="current">Asking Google: <b>{research.current.query}</b></p>
      )}
      {research.message && <p className={`notice ${status === 'blocked' ? 'bad' : ''} ${coolingDown ? 'warn' : ''}`}>{research.message}</p>}
      {coolingDown && research.resumeAt && <Countdown until={research.resumeAt} />}
      {counters.failed > 0 && <p className="hint">{counters.failed} request{counters.failed === 1 ? '' : 's'} failed. Each query is retried up to 3 times{research.failures?.length ? `; ${research.failures.length} gave up and ${research.failures.length === 1 ? 'was' : 'were'} skipped` : ''}.</p>}
      {finished && research.stopReason && <p className="notice">{STOP_REASONS[research.stopReason]}</p>}
      {active && <p className="hint">Keep this tab open and visible — browsers slow down background tabs.</p>}
      {!storageOk && <p className="hint">This browser isn’t saving progress (private mode or full storage). Export before closing the tab.</p>}

      <div className="actions">
        {active && <button type="button" className="btn" onClick={onPause}>Pause</button>}
        {canResume && <button type="button" className="btn primary" onClick={onResume}>Resume</button>}
        {coolingDown && <button type="button" className="btn primary" onClick={onResume}>Retry now</button>}
        {coolingDown && <button type="button" className="btn" onClick={onPause}>Pause</button>}
        {(active || canResume || coolingDown) && <button type="button" className="btn" onClick={onStop}>Stop</button>}
        <button type="button" className="btn ghost" onClick={onReset} disabled={active || coolingDown}>New research</button>
      </div>
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function Countdown({ until }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, Math.ceil((until - now) / 1000))
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')
  return <p className="countdown">Retrying automatically in <b>{mm}:{ss}</b></p>
}
