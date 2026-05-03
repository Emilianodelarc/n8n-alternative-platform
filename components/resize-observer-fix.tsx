'use client'

import { useEffect } from 'react'

export function ResizeObserverFix() {
  useEffect(() => {
    // Handle error events
    const errorHandler = (e: ErrorEvent) => {
      if (e.message?.includes('ResizeObserver loop')) {
        e.stopImmediatePropagation()
        e.preventDefault()
        return false
      }
    }
    
    // Handle unhandled rejection events
    const rejectionHandler = (e: PromiseRejectionEvent) => {
      if (e.reason?.message?.includes('ResizeObserver loop')) {
        e.preventDefault()
        return false
      }
    }

    // Override console.error to suppress ResizeObserver warnings
    const originalError = console.error
    console.error = (...args) => {
      if (args[0]?.toString?.()?.includes('ResizeObserver loop')) {
        return
      }
      originalError.apply(console, args)
    }

    window.addEventListener('error', errorHandler, true)
    window.addEventListener('unhandledrejection', rejectionHandler, true)
    
    return () => {
      window.removeEventListener('error', errorHandler, true)
      window.removeEventListener('unhandledrejection', rejectionHandler, true)
      console.error = originalError
    }
  }, [])

  return null
}
