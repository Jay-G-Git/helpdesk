import { parseEmployeeCsv } from '../lib/csvImport'

describe('parseEmployeeCsv', () => {
  it('parses a well-formed CSV with matching headers', () => {
    const csv = 'name,email,phone,role\nJane Smith,jane@example.com,555-1234,Cashier\nJohn Doe,john@example.com,555-5678,Manager'
    const { rows, matchedColumns, unmatchedColumns } = parseEmployeeCsv(csv)
    expect(rows).toEqual([
      { name: 'Jane Smith', email: 'jane@example.com', phone: '555-1234', role: 'Cashier' },
      { name: 'John Doe', email: 'john@example.com', phone: '555-5678', role: 'Manager' },
    ])
    expect(matchedColumns).toEqual(['name', 'email', 'phone', 'role'])
    expect(unmatchedColumns).toEqual([])
  })

  it('matches headers case-insensitively and in any order', () => {
    const csv = 'Role,Name\nCashier,Jane Smith'
    const { rows } = parseEmployeeCsv(csv)
    expect(rows).toEqual([{ name: 'Jane Smith', email: '', phone: '', role: 'Cashier' }])
  })

  it('reports unknown columns without fuzzy-matching them', () => {
    const csv = 'full_name,role\nJane Smith,Cashier'
    const { rows, matchedColumns, unmatchedColumns } = parseEmployeeCsv(csv)
    expect(rows).toEqual([{ name: '', email: '', phone: '', role: 'Cashier' }])
    expect(matchedColumns).toEqual(['role'])
    expect(unmatchedColumns).toEqual(['full_name'])
  })

  it('strips surrounding quotes from fields', () => {
    const csv = 'name,role\n"Jane Smith","Cashier"'
    const { rows } = parseEmployeeCsv(csv)
    expect(rows).toEqual([{ name: 'Jane Smith', email: '', phone: '', role: 'Cashier' }])
  })

  it('returns empty results for empty input', () => {
    expect(parseEmployeeCsv('')).toEqual({ rows: [], matchedColumns: [], unmatchedColumns: [] })
  })

  it('skips blank lines', () => {
    const csv = 'name,role\nJane Smith,Cashier\n\nJohn Doe,Manager\n'
    const { rows } = parseEmployeeCsv(csv)
    expect(rows).toHaveLength(2)
  })
})
