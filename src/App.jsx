import { useCallback, useEffect, useRef, useState } from 'react'
import SetupForm from './components/SetupForm.jsx'
import RunPanel from './components/RunPanel.jsx'
import Results from './components/Results.jsx'
import { ResearchEngine, createInitialState, isValidSavedState } from './lib/engine.js'
import { fetchSuggestions } from './lib/suggest.js'
import { clearState, loadState, saveState } from './lib/storage.js'
import { DEFAULT_CLEANUP } from './lib/cleanup.js'

const SAVE_EVERY_MS = 2000

function restore() {
  const saved = loadState()
  if (!saved || !isValidSavedState(saved.research)) return { research: null, starred: [], cleanup: DEFAULT_CLEANUP }
  const research = saved.research
  // A refresh interrupts a running research; offer Resume instead.
  if (research.status === 'running') {
    research.status = 'paused'
    research.current = null
    research.message = 'The page was reloaded. Click Resume to continue where you left off.'
  }
  return {
    research,
    starred: Array.isArray(saved.starred) ? saved.starred : [],
    cleanup: { ...DEFAULT_CLEANUP, ...(saved.cleanup && typeof saved.cleanup === 'object' ? saved.cleanup : {}) },
  }
}

export default function App() {
  const [initial] = useState(restore)
  const [research, setResearch] = useState(initial.research)
  const [starred, setStarred] = useState(() => new Set(initial.starred))
  const [cleanup, setCleanup] = useState(initial.cleanup)
  const [storageOk, setStorageOk] = useState(true)
  const engineRef = useRef(null)
  const lastSave = useRef(0)
  const latest = useRef({ research: initial.research, starred: initial.starred, cleanup: initial.cleanup })

  const persist = useCallback((force = false) => {
    const now = Date.now()
    if (!force && now - lastSave.current < SAVE_EVERY_MS) return
    lastSave.current = now
    if (!latest.current.research) return
    setStorageOk(saveState(latest.current))
  }, [])

  const getEngine = useCallback((state) => {
    if (!engineRef.current) {
      engineRef.current = new ResearchEngine(state, {
        fetchSuggestions,
        onUpdate: (snapshot) => {
          latest.current = { ...latest.current, research: snapshot }
          setResearch(snapshot)
          persist(snapshot.status !== 'running')
        },
      })
    }
    return engineRef.current
  }, [persist])

  // A run that was cooling down when the page reloaded keeps its automatic retry.
  useEffect(() => {
    if (initial.research?.status === 'cooldown') getEngine(initial.research)
  }, [initial, getEngine])

  // Save once more when the tab is hidden or closed.
  useEffect(() => {
    const onHide = () => persist(true)
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [persist])

  function start(config) {
    engineRef.current = null
    const state = createInitialState(config)
    latest.current = { research: state, starred: [], cleanup: DEFAULT_CLEANUP }
    setStarred(new Set())
    setCleanup(DEFAULT_CLEANUP)
    setResearch(state)
    getEngine(state).run()
  }

  const pause = () => engineRef.current?.pause()
  const stop = () => engineRef.current?.stop()
  const resume = () => getEngine(research).resume()

  function reset() {
    const count = research ? research.order.length : 0
    if (count && !window.confirm(`Start a new research? The ${count} keywords from this run will be removed. Export them first if you need them.`)) return
    engineRef.current?.stop()
    engineRef.current = null
    latest.current = { research: null, starred: [], cleanup: DEFAULT_CLEANUP }
    clearState()
    setResearch(null)
    setStarred(new Set())
    setCleanup(DEFAULT_CLEANUP)
  }

  function toggleStar(key) {
    setStarred((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      latest.current = { ...latest.current, starred: [...next] }
      persist(true)
      return next
    })
  }

  function changeCleanup(next) {
    setCleanup(next)
    latest.current = { ...latest.current, cleanup: next }
    persist(true)
  }

  return (
    <div className="page">
      <header className="masthead">
        <div className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect width="32" height="32" rx="7" fill="var(--accent)" /><circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="3" /><path d="M19 19l6 6" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></svg>
          <div>
            <h1>Autocomplete Keyword Finder</h1>
            <p>Long-tail keywords from Google Autocomplete — runs entirely in your browser.</p>
          </div>
        </div>
      </header>

      <main className="layout">
        {research ? (
          <>
            <RunPanel research={research} onPause={pause} onResume={resume} onStop={stop} onReset={reset} storageOk={storageOk} />
            <Results research={research} starred={starred} onToggleStar={toggleStar} cleanup={cleanup} onCleanupChange={changeCleanup} />
          </>
        ) : (
          <SetupForm onStart={start} />
        )}
      </main>

      <footer className="footer">
        Suggestions come straight from Google to your browser; nothing is sent to any other server. Google Autocomplete is unofficial and gives no search volumes.
      </footer>
    </div>
  )
}
