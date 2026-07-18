'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Nav from '../components/Nav'

type Message = { role: 'user' | 'assistant'; content: string; failed?: boolean }

// JAY-134 — trimmed to 4 per the ticket's "3-4 suggested starter prompts"
// spec, kept product-specific rather than generic ("Draft a job post for a
// part-time cashier" style) rather than a vague "ask me anything."
const OWNER_SUGGESTIONS = [
  'Draft a job post for a part-time cashier',
  "Who's off next week?",
  'Summarize last payroll run',
  'Show pending time off requests',
]

const EMPLOYEE_SUGGESTIONS = [
  'How many PTO days do I have left?',
  'Clock me in',
  'Request time off next Friday',
  'Show my upcoming schedule',
]

function Bubble({ msg, onRetry }: { msg: Message; onRetry?: () => void }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: '12px' }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'var(--text-info)', color: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, flexShrink: 0,
          marginRight: '8px', alignSelf: 'flex-end',
        }}>AI</div>
      )}
      <div>
        <div style={{
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser ? 'var(--text-info)' : 'var(--bg-secondary)',
          color: isUser ? 'var(--bg)' : 'var(--text)',
          fontSize: '14px',
          lineHeight: 1.6,
          border: isUser ? 'none' : '1px solid var(--border)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          marginLeft: 'auto',
        }}>
          {msg.content}
        </div>
        {/* JAY-134 — honest error states: say what failed and offer retry,
            instead of a bare "Something went wrong" dead end. */}
        {msg.failed && onRetry && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button onClick={onRetry} style={{
              fontSize: '12px', color: 'var(--text-info)', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: 0,
            }}>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [token, setToken] = useState('')
  const [isOwner, setIsOwner] = useState<boolean | null>(null)
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { window.location.href = '/login'; return }
      setToken(session.access_token)
      // Determine role to show appropriate suggestions
      const { data: biz } = await supabase.from('business_profiles').select('id').eq('user_id', session.user.id).maybeSingle()
      setIsOwner(!!biz)
      setMessages([{
        role: 'assistant',
        content: biz
          ? "Hi! I'm your HR assistant. I can manage employees, handle applicants, generate job descriptions, approve time off, and pull up analytics — just tell me what you need."
          : "Hi! I'm your HR assistant. I can clock you in or out, check your PTO, request time off, or show your schedule — just ask.",
      }])
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          timezone,
        }),
      })
      if (!res.ok) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: res.status === 401
            ? "Your session expired — refresh the page and sign in again."
            : "The assistant couldn't process that request. It's on our end, not yours.",
          failed: true,
        }])
        setLoading(false)
        return
      }
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? "The assistant didn't return a response. Try rephrasing your request.", failed: !data.reply }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Couldn't reach the assistant — check your connection and try again.",
        failed: true,
      }])
    }
    setLoading(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  // JAY-134 — retry re-sends the last user message rather than making the
  // person retype it; the failed assistant bubble is dropped first so the
  // retry's response replaces it instead of stacking underneath.
  function retryLast() {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg) return
    setMessages(prev => {
      const idx = prev.map(m => m.failed).lastIndexOf(true)
      return idx === -1 ? prev : prev.slice(0, idx)
    })
    send(lastUserMsg.content)
  }

  const suggestions = isOwner ? OWNER_SUGGESTIONS : EMPLOYEE_SUGGESTIONS
  const showEmptyState = messages.length === 1 && !loading && isOwner !== null

  return (
    <div className="dash-wrap">
      <Nav active="dashboard" />
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', background: 'var(--bg)' }}>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem 1rem', maxWidth: '760px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

          {messages.map((msg, i) => (
            <Bubble key={i} msg={msg} onRetry={msg.failed && i === messages.length - 1 ? retryLast : undefined} />
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--text-info)', color: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700 }}>AI</div>
              <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: '16px 16px 16px 4px', border: '1px solid var(--border)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--text-tertiary)', animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          )}

          {/* JAY-134 — empty state is an invitation with a next step: a
              short prompt plus product-specific starter prompts, not a
              dead end. Shown only before the first user message. */}
          {showEmptyState && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Not sure where to start? Try one of these:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {suggestions.map(s => (
                  <button key={s} onClick={() => send(s)}
                    style={{
                      padding: '6px 14px', borderRadius: '999px', fontSize: '13px',
                      border: '1px solid var(--border-md)', background: 'var(--bg-secondary)',
                      color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit',
                      transition: 'background 0.1s',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '1rem', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask anything or give a command…"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, resize: 'none', fontSize: '14px', padding: '10px 14px',
                borderRadius: '12px', border: '1px solid var(--border-md)',
                background: 'var(--bg)', color: 'var(--text)',
                fontFamily: 'inherit', outline: 'none', lineHeight: 1.5,
                maxHeight: '120px', overflowY: 'auto',
              }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = `${Math.min(t.scrollHeight, 120)}px`
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="btn"
              style={{ padding: '10px 18px', flexShrink: 0, fontSize: '14px', borderRadius: '12px', background: 'var(--text-info)', color: 'var(--bg)', border: 'none', opacity: (loading || !input.trim()) ? 0.6 : 1 }}
            >
              Send
            </button>
          </div>
          <div style={{ maxWidth: '760px', margin: '6px auto 0', fontSize: '11px', color: 'var(--text-tertiary)', textAlign: 'center' }}>
            Press Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
