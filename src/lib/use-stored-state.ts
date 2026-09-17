import { useCallback, useState } from 'react'

/** useState persisted to localStorage. Storage failures (private mode, policies) fall back to memory. */
export function useStoredState<T>(key: string, initial: T): [T, (update: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : (JSON.parse(raw) as T)
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (update: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof update === 'function' ? (update as (p: T) => T)(prev) : update
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {
          // ignore
        }
        return next
      })
    },
    [key],
  )

  return [value, set]
}
