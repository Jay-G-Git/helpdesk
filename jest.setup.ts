import '@testing-library/jest-dom'

// JAY-63 — a fixed, test-only 32-byte key so field-encryption tests (bank
// routing/account numbers) don't need real secrets. Never used outside Jest.
process.env.BANK_DATA_ENCRYPTION_KEY = 'fNdCfe9TBDGqK2jv9jH42RLnujDMLsa72RPDkfkpyg8='
