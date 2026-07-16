// JAY-63 — unit tests for the AES-256-GCM field encryption helper used to
// protect bank routing/account numbers before they're written to
// employee_forms.form_data. BANK_DATA_ENCRYPTION_KEY is set in
// jest.setup.ts (test-only key).
import { encryptField, decryptField, last4 } from '../app/lib/fieldEncryption'

describe('fieldEncryption', () => {
  it('round-trips a value through encrypt then decrypt', () => {
    const plaintext = '123456789'
    const encrypted = encryptField(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(decryptField(encrypted)).toBe(plaintext)
  })

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptField('987654321')
    const b = encryptField('987654321')
    expect(a).not.toBe(b)
    expect(decryptField(a)).toBe('987654321')
    expect(decryptField(b)).toBe('987654321')
  })

  it('throws when the ciphertext has been tampered with', () => {
    const encrypted = encryptField('123456789')
    const [iv, authTag, ciphertext] = encrypted.split(':')
    // Flip the ciphertext by re-encoding a different buffer.
    const tampered = [iv, authTag, Buffer.from('tampered-data').toString('base64')].join(':')
    expect(() => decryptField(tampered)).toThrow()
  })

  it('throws on malformed input missing the iv:authTag:ciphertext structure', () => {
    expect(() => decryptField('not-a-valid-encoded-value')).toThrow()
  })

  it('extracts the last 4 characters', () => {
    expect(last4('123456789')).toBe('6789')
    expect(last4('021000021')).toBe('0021')
  })

  it('throws when BANK_DATA_ENCRYPTION_KEY is missing', () => {
    const original = process.env.BANK_DATA_ENCRYPTION_KEY
    delete process.env.BANK_DATA_ENCRYPTION_KEY
    expect(() => encryptField('123456789')).toThrow()
    process.env.BANK_DATA_ENCRYPTION_KEY = original
  })
})
