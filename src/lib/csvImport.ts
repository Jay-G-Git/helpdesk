// JAY-170 — bulk employee CSV import. Strict/case-insensitive header
// matching only (name, email, phone, role, any order) — no fuzzy/synonym
// header detection, per the Tech Lead plan's scope call.

export type ImportRow = {
  name: string
  email: string
  phone: string
  role: string
}

export type ParsedCsv = {
  rows: ImportRow[]
  matchedColumns: string[]
  unmatchedColumns: string[]
}

const KNOWN_COLUMNS = ['name', 'email', 'phone', 'role'] as const

function splitCsvLine(line: string): string[] {
  return line.split(',').map(field => field.trim().replace(/^"(.*)"$/, '$1'))
}

/** Parses raw CSV text (header row + data rows) using strict, case-insensitive column-name matching. */
export function parseEmployeeCsv(text: string): ParsedCsv {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length === 0) return { rows: [], matchedColumns: [], unmatchedColumns: [] }

  const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const matchedColumns = headers.filter(h => (KNOWN_COLUMNS as readonly string[]).includes(h))
  const unmatchedColumns = headers.filter(h => !(KNOWN_COLUMNS as readonly string[]).includes(h))

  const rows: ImportRow[] = lines.slice(1).map(line => {
    const fields = splitCsvLine(line)
    const row: ImportRow = { name: '', email: '', phone: '', role: '' }
    headers.forEach((header, i) => {
      if ((KNOWN_COLUMNS as readonly string[]).includes(header)) {
        row[header as keyof ImportRow] = fields[i] ?? ''
      }
    })
    return row
  })

  return { rows, matchedColumns, unmatchedColumns }
}
