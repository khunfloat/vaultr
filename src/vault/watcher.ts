export interface Watcher {
  stop(): void
  /** Run a check now (coalesced with any check already running). */
  poke(): Promise<void>
}

/**
 * Polls `check` while the page is visible and whenever the window regains focus.
 * The File System Access API has no reliable change events on file:// yet, so polling mtimes is the fallback.
 */
export function startWatcher(check: () => Promise<void>, intervalMs = 3000): Watcher {
  let running: Promise<void> | null = null
  let stopped = false

  const poke = () => {
    if (stopped) return Promise.resolve()
    running ??= check()
      .catch((e) => console.warn('watcher: check failed', e))
      .finally(() => {
        running = null
      })
    return running
  }

  const tick = () => {
    if (document.visibilityState === 'visible') void poke()
  }
  const timer = window.setInterval(tick, intervalMs)
  window.addEventListener('focus', tick)
  document.addEventListener('visibilitychange', tick)

  return {
    poke,
    stop() {
      stopped = true
      window.clearInterval(timer)
      window.removeEventListener('focus', tick)
      document.removeEventListener('visibilitychange', tick)
    },
  }
}
