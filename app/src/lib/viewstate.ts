import { useCallback, useState } from 'react'

/**
 * useState that survives being unmounted.
 *
 * Opening a document replaces the whole screen, so a list's tab, search box and
 * filters would normally be thrown away and rebuilt from scratch on the way
 * back. Keying the value by a stable string keeps it for the round trip: press
 * Back and you return to the list you were actually looking at, not a reset one.
 *
 * Only view state belongs here — never a document, never anything the office
 * depends on. It is cleared on sign-out so the next person starts clean.
 */
const memory = new Map<string, unknown>()

export function clearViewState() {
  memory.clear()
}

export function useViewState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (memory.has(key) ? (memory.get(key) as T) : initial))
  const set = useCallback((next: T) => {
    memory.set(key, next)
    setValue(next)
  }, [key])
  return [value, set] as const
}
