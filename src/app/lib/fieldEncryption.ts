import crypto from 'crypto'

// JAY-63 — field-level encryption for sensitive values (bank routing/account
// numbers) before they're written to employee_forms.form_data. AES-256-GCM:
// authenticated encryption, so tampering with the ciphertext is detectable
// (decrypt throws) rather than silently returning garbage.
//
// Key comes from BANK_DATA_ENCRYPTION_KEY (a 32-byte key, base64-encoded —
// generate with `openssl rand -base64 32`). Must be set in the environment
// (Vercel project settings) before this is used in production; encryptField/
// decryptField throw immediately if it's missing rather than silently
// falling back to plaintext.

function getKey(): Buffer {
  const b64 = process.env.BANK_DATA_ENCRYPTION_KEY
  if (!b64) {
    throw new Error('BANK_DATA_ENCRYPTION_KEY is not set — cannot encrypt/decrypt sensitive fields.')
  }
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) {
    throw new Error('BANK_DATA_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).')
  }
  return key
}

/** Encrypts a plaintext string. Returns "iv:authTag:ciphertext", all base64. */
export function encryptField(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(12) // 96-bit IV, standard for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/** Decrypts a value produced by encryptField. Throws if the key is wrong or the value was tampered with. */
export function decryptField(encoded: string): string {
  const key = getKey()
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(':')
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Malformed encrypted field.')
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const ciphertext = Buffer.from(ciphertextB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}

export function last4(value: string): string {
  return value.slice(-4)
}
