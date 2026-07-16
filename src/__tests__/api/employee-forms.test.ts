jest.mock('../../app/lib/supabaseAdmin', () => ({ supabaseAdmin: { auth: { getUser: jest.fn() }, from: jest.fn() } }))

import { supabaseAdmin } from '../../app/lib/supabaseAdmin'
import { POST as viewPOST } from '../../app/api/employee-forms/[id]/view/route'
import { POST as revealPOST } from '../../app/api/employee-forms/[id]/reveal/route'
import { queueFromResponses, mockRequest } from '../helpers/supabaseMock'
import { encryptField } from '../../app/lib/fieldEncryption'

function mockOwner(user: { id: string; email?: string } | null) {
  ;(supabaseAdmin.auth.getUser as jest.Mock).mockResolvedValue({ data: { user } })
}

function params(id: string) {
  return { params: Promise.resolve({ id }) }
}

describe('POST /api/employee-forms/[id]/view', () => {
  it('returns 401 without a token', async () => {
    const res = await viewPOST(mockRequest() as never, params('1'))
    expect(res.status).toBe(401)
  })

  it('returns 403 when the caller has no resolvable tenant (not an owner or admin/manager)', async () => {
    mockOwner({ id: 'ghost-user' })
    queueFromResponses(supabaseAdmin, [
      { data: null, error: null }, // business_profiles — not an owner
      { data: null, error: null }, // employees — no matching row
    ])
    const res = await viewPOST(mockRequest({ token: 'good' }) as never, params('1'))
    expect(res.status).toBe(403)
  })

  it('returns 404 when the form does not belong to this tenant', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles — is an owner
      { data: null, error: null }, // employee_forms lookup — not found / wrong tenant
    ])
    const res = await viewPOST(mockRequest({ token: 'good' }) as never, params('5'))
    expect(res.status).toBe(404)
  })

  // JAY-64 — opening a form logs a document_views row with revealed: false.
  it('logs a view with revealed: false', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null }, // business_profiles
      { data: { id: 5, employee_id: 1, user_id: 'owner-1', form_type: 'direct_deposit' }, error: null }, // employee_forms
      { data: null, error: null }, // document_views insert
    ])
    const res = await viewPOST(mockRequest({ token: 'good' }) as never, params('5'))
    expect(res.status).toBe(200)

    const fromMock = supabaseAdmin.from as jest.Mock
    const insertCall = fromMock.mock.results[2].value
    const inserted = insertCall.insert.mock.calls[0][0]
    expect(inserted).toMatchObject({ employee_form_id: 5, employee_id: 1, viewer_user_id: 'owner-1', form_type: 'direct_deposit', revealed: false })
  })
})

describe('POST /api/employee-forms/[id]/reveal', () => {
  it('returns 401 without a token', async () => {
    const res = await revealPOST(mockRequest() as never, params('1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for a form type with no encrypted fields', async () => {
    mockOwner({ id: 'owner-1' })
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null },
      { data: { id: 5, employee_id: 1, user_id: 'owner-1', form_type: 'i9', form_data: {} }, error: null },
    ])
    const res = await revealPOST(mockRequest({ token: 'good' }) as never, params('5'))
    expect(res.status).toBe(400)
  })

  // JAY-63 — decrypts the encrypted fields and logs the reveal (revealed: true),
  // distinct from a plain view.
  it('decrypts encrypted fields and logs revealed: true', async () => {
    mockOwner({ id: 'owner-1' })
    const encryptedRouting = encryptField('021000021')
    const encryptedAccount = encryptField('123456789')
    queueFromResponses(supabaseAdmin, [
      { data: { user_id: 'owner-1' }, error: null },
      {
        data: {
          id: 5, employee_id: 1, user_id: 'owner-1', form_type: 'direct_deposit',
          form_data: {
            bankName: 'Chase',
            routingNumber_encrypted: encryptedRouting,
            routingNumber_last4: '0021',
            accountNumber_encrypted: encryptedAccount,
            accountNumber_last4: '6789',
          },
        },
        error: null,
      },
      { data: null, error: null }, // document_views insert
    ])
    const res = await revealPOST(mockRequest({ token: 'good' }) as never, params('5'))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.revealed).toEqual({ routingNumber: '021000021', accountNumber: '123456789' })

    const fromMock = supabaseAdmin.from as jest.Mock
    const insertCall = fromMock.mock.results[2].value
    const inserted = insertCall.insert.mock.calls[0][0]
    expect(inserted).toMatchObject({ employee_form_id: 5, revealed: true })
  })
})
