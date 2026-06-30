'use client'

import { useState } from 'react'
import W4Form from './W4Form'
import I9Form from './I9Form'
import AvailabilityForm from './AvailabilityForm'
import { TimeOffRequest } from './SignUpload'
import DirectDepositForm from './DirectDepositForm'

type Doc = {
  id: number
  file_name: string
  file_size: number
  url: string | null
}

type Props = {
  token: string
  employeeId: number
  userId: string
  employeeName: string
  welcomePack: string | null
  docs: Doc[]
  isReturning?: boolean
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'w4', label: 'W-4' },
  { id: 'i9', label: 'I-9' },
  { id: 'deposit', label: 'Direct Deposit' },
  { id: 'availability', label: 'Availability' },
  { id: 'agreement', label: 'Agreement' },
  { id: 'done', label: 'Done' },
]

function AgreementStep({ employeeName, onComplete }: { employeeName: string; onComplete: () => void }) {
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!agreed) { setError('Please check the box to confirm.'); return }
    if (signature.trim().toLowerCase() !== employeeName.trim().toLowerCase()) {
      setError('Please type your full name exactly as shown.')
      return
    }
    setError('')
    onComplete()
  }

  return (
    <div>
      <p style={{ fontSize: '13px', color: '#666', marginBottom: '1.25rem' }}>
        By signing below, you confirm that all information you've submitted during this onboarding process is accurate and complete.
      </p>

      <div style={{ background: '#f8f9fb', border: '1px solid #e8eaf0', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
            style={{ marginTop: '2px', flexShrink: 0, width: '16px', height: '16px' }}
          />
          <span style={{ fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6, flex: 1, minWidth: 0 }}>
            I certify that the information I have provided on my W-4, I-9, direct deposit form, and availability is true and accurate to the best of my knowledge.
          </span>
        </label>
      </div>

      <div className="field">
        <label>Type your full name to sign <span style={{ color: '#c0392b' }}>*</span></label>
        <input
          value={signature}
          onChange={e => setSignature(e.target.value)}
          placeholder={employeeName}
          style={{ fontStyle: 'italic' }}
        />
        <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>Must match: {employeeName}</div>
      </div>

      {error && <div className="auth-error">{error}</div>}
      <button className="btn auth-btn-primary" style={{ width: 'auto', marginTop: '0.5rem' }} onClick={handleSubmit}>
        Sign &amp; complete
      </button>
    </div>
  )
}

export default function OnboardingFlow({ token, employeeId, userId, employeeName, welcomePack, docs, isReturning }: Props) {
  const [step, setStep] = useState(0)

  function next() {
    setStep(s => Math.min(s + 1, STEPS.length - 1))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function back() {
    setStep(s => Math.max(s - 1, 0))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const progress = Math.round((step / (STEPS.length - 1)) * 100)

  // Returning employee — show simple portal instead of wizard
  if (isReturning) {
    return (
      <div className="sign-wrap">
        <div className="sign-card" style={{ alignSelf: 'flex-start' }}>
          <div className="logo">help<span>desk</span></div>
          <h1>Hi, {employeeName.split(' ')[0]}!</h1>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '1.5rem' }}>
            Your onboarding is complete. Use this page anytime to request time off or update your availability.
          </p>
          <div style={{ marginBottom: '1.5rem' }}>
            <TimeOffRequest token={token} />
          </div>
          <div style={{ borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
            <AvailabilityForm employeeId={employeeId} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sign-wrap">
      <div className="sign-card" style={{ alignSelf: 'flex-start' }}>
        {/* Header */}
        <div className="logo">help<span>desk</span></div>
        <h1>Welcome, {employeeName.split(' ')[0]}!</h1>

        {/* Progress bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', color: '#666' }}>Step {step + 1} of {STEPS.length} — {STEPS[step].label}</span>
            <span style={{ fontSize: '12px', color: '#185fa5', fontWeight: 600 }}>{progress}%</span>
          </div>
          <div style={{ height: '6px', background: '#eee', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: '#185fa5', borderRadius: '99px', transition: 'width 0.3s ease' }} />
          </div>
        </div>

        {/* Step content */}
        {step === 0 && (
          <div>
            {welcomePack && (
              <div className="sign-pack" style={{ marginBottom: '1.5rem' }}>
                {welcomePack.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              </div>
            )}
            {docs.length > 0 && (
              <>
                <div className="sign-section-label" style={{ marginBottom: '0.75rem' }}>Documents to review</div>
                <div className="upload-list" style={{ marginBottom: '1rem' }}>
                  {docs.map(doc => (
                    <div key={doc.id} className="upload-item">
                      <div className="upload-icon">📄</div>
                      <div style={{ flex: 1 }}>
                        <div className="upload-name">{doc.file_name}</div>
                        <div className="upload-meta">{formatSize(doc.file_size)}</div>
                      </div>
                      {doc.url && (
                        <a className="doc-btn" href={doc.url} target="_blank" rel="noopener noreferrer">Download</a>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '1.5rem' }}>
              This will walk you through your onboarding paperwork step by step. It should take about 5–10 minutes.
            </p>
            <button className="btn auth-btn-primary" style={{ width: 'auto' }} onClick={next}>
              Get started →
            </button>
          </div>
        )}

        {step === 1 && (
          <W4Form token={token} employeeId={employeeId} userId={userId} defaultName={employeeName} onComplete={next} />
        )}

        {step === 2 && (
          <I9Form token={token} employeeId={employeeId} userId={userId} defaultName={employeeName} onComplete={next} />
        )}

        {step === 3 && (
          <DirectDepositForm token={token} employeeId={employeeId} userId={userId} onComplete={next} />
        )}

        {step === 4 && (
          <AvailabilityForm employeeId={employeeId} onComplete={next} />
        )}

        {step === 5 && (
          <AgreementStep employeeName={employeeName} onComplete={next} />
        )}

        {step === 6 && (
          <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>🎉</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '0.5rem' }}>You're all set!</div>
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '1.5rem' }}>
              Your onboarding paperwork is complete. Your employer has been notified.
            </p>
            <p style={{ fontSize: '13px', color: '#999' }}>
              Bookmark this page — you can come back anytime to request time off or update your availability.
            </p>
          </div>
        )}

        {/* Navigation — back + skip on middle steps */}
        {step > 0 && step < STEPS.length - 1 && (
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
            <button className="btn" onClick={back} style={{ color: '#666', background: 'transparent', boxShadow: 'none' }}>← Back</button>
            {step !== 5 && (
              <button className="btn" onClick={next} style={{ color: '#185fa5', background: 'transparent', boxShadow: 'none' }}>Skip this step</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
