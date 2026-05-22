import { useCallback, useEffect, useRef } from 'react'

export function useDebouncedRefetch(refetch: () => void, delayMs = 350) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const trigger = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      refetch()
    }, delayMs)
  }, [delayMs, refetch])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return trigger
}
