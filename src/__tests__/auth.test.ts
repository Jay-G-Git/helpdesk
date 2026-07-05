import { validatePassword, isPasswordValid, PASSWORD_RULES } from '../lib/auth'

// ─── validatePassword ─────────────────────────────────────────────────────────

describe('validatePassword', () => {
  it('returns no errors for a strong password', () => {
    expect(validatePassword('Secure1!')).toHaveLength(0)
  })

  it('fails when password is too short', () => {
    expect(validatePassword('Ab1!')).toContain('At least 8 characters')
  })

  it('fails when no uppercase letter', () => {
    expect(validatePassword('secure1!')).toContain('One uppercase letter')
  })

  it('fails when no number', () => {
    expect(validatePassword('SecurePass!')).toContain('One number')
  })

  it('fails when no special character', () => {
    expect(validatePassword('Secure123')).toContain('One special character')
  })

  it('returns all four errors for an empty string', () => {
    expect(validatePassword('')).toHaveLength(4)
  })

  it('returns multiple errors when multiple rules fail', () => {
    const errors = validatePassword('short')  // too short, no uppercase, no number, no special
    expect(errors.length).toBeGreaterThan(1)
  })

  it('accepts a variety of special characters', () => {
    expect(validatePassword('Secure1@')).toHaveLength(0)
    expect(validatePassword('Secure1#')).toHaveLength(0)
    expect(validatePassword('Secure1$')).toHaveLength(0)
    expect(validatePassword('Secure1-')).toHaveLength(0)
  })
})

// ─── isPasswordValid ──────────────────────────────────────────────────────────

describe('isPasswordValid', () => {
  it('returns true for a valid password', () => {
    expect(isPasswordValid('Helpdesk1!')).toBe(true)
  })

  it('returns false for an invalid password', () => {
    expect(isPasswordValid('weak')).toBe(false)
  })
})

// ─── PASSWORD_RULES structure ─────────────────────────────────────────────────

describe('PASSWORD_RULES', () => {
  it('has exactly 4 rules', () => {
    expect(PASSWORD_RULES).toHaveLength(4)
  })

  it('every rule has a label and test function', () => {
    PASSWORD_RULES.forEach(rule => {
      expect(typeof rule.label).toBe('string')
      expect(typeof rule.test).toBe('function')
    })
  })
})
