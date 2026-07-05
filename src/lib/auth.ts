// Password validation — shared between login page and portal setup page

export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

/** Returns the labels of any failing rules. Empty array = password is valid. */
export function validatePassword(password: string): string[] {
  return PASSWORD_RULES.filter(r => !r.test(password)).map(r => r.label)
}

/** True only when all rules pass. */
export function isPasswordValid(password: string): boolean {
  return validatePassword(password).length === 0
}
