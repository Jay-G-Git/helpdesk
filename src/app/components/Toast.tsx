'use client'

// Shared toast system — replaces the old pattern of a per-page `useState('')`
// message rendered inline (which several pages forgot to auto-clear, causing
// stuck messages like "No new shifts to generate."). Mount <ToastProvider>
// once at the root layout, then call useToast().showToast(...) from any
// client component instead of managing local message state.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
type Toast = { id: number; message: string; kind: ToastKind }

type ToastContextValue = {
  showToast: (message: string, kind?: ToastKind, durationMs?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const KIND_STYLES: Record<ToastKind, { bg: string; border: string; color: string }> = {
  success: { bg: 'rgba(20,83,45,0.95)', border: 'rgba(74,222,128,0.4)', color: 'var(--success)' },
  error: { bg: 'rgba(127,29,29,0.95)', border: 'rgba(248,113,113,0.4)', color: 'var(--error)' },
  info: { bg: 'rgba(30,41,59,0.95)', border: 'rgba(148,163,184,0.4)', color: 'var(--border)' },
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const showToast = useCallback((message: string, kind: ToastKind = 'info', durationMs = 4000) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, message, kind }])
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, durationMs)
    timers.current.set(id, timer)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        style={{
          position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
          display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', pointerEvents: 'none',
        }}
      >
        {toasts.map(t => {
          const style = KIND_STYLES[t.kind]
          return (
            <div
              key={t.id}
              style={{
                padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 500,
                background: style.bg, border: `1px solid ${style.border}`, color: style.color,
                boxShadow: '0 8px 24px rgba(0,0,0,0.35)', animation: 'toastIn 0.2s ease-out',
                maxWidth: '90vw',
              }}
            >
              {t.message}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
