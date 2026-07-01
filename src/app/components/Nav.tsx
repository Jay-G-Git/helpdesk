'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

type Props = {
  active: 'dashboard' | 'payroll' | 'schedule'
}

export default function Nav({ active }: Props) {
  const [userEmail, setUserEmail] = useState('')
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user.email) setUserEmail(session.user.email)
    })
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : '??'

  return (
    <div className="dash-nav">
      <div className="dash-nav-left">
        <div className="logo">help<span>desk</span></div>
        <nav className="dash-nav-links">
          <a href="/" className={`dash-nav-link${active === 'dashboard' ? ' active' : ''}`}>Dashboard</a>
          <a href="/payroll" className={`dash-nav-link${active === 'payroll' ? ' active' : ''}`}>Payroll</a>
          <a href="/schedule" className={`dash-nav-link${active === 'schedule' ? ' active' : ''}`}>Schedule</a>
        </nav>
      </div>
      <div className="dash-nav-right">
        <div ref={menuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <div className="user-avatar" onClick={() => setShowMenu(v => !v)}>{initials}</div>
          {showMenu && (
            <div className="user-menu">
              <div className="user-menu-header">
                <div className="user-menu-email">{userEmail}</div>
              </div>
              <div className="user-menu-items">
                <a href="/settings" className="user-menu-item">⚙ Onboarding template</a>
                <a href="/offboarding-settings" className="user-menu-item">⚙ Offboarding template</a>
                <div className="user-menu-divider" />
                <div className="user-menu-item user-menu-signout" onClick={handleLogout}>→ Sign out</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
