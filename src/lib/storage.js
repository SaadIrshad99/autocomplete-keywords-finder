// Saves the current run in this browser so a refresh doesn't lose it.
// Storage can be unavailable (private mode, blocked site data); the app works without it.

const KEY = 'akf:research:v1'

export function loadState() {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveState(state) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function clearState() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
