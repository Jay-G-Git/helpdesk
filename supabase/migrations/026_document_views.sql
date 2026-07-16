-- Migration: JAY-64 — audit trail for who viewed a sensitive employee_forms
-- row, and JAY-63 — reuses the same table to log when someone reveals an
-- encrypted bank field specifically (`revealed = true`), distinct from just
-- opening the form (`revealed = false`).
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS document_views (
  id BIGSERIAL PRIMARY KEY,
  employee_form_id BIGINT NOT NULL REFERENCES employee_forms(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL,
  user_id UUID NOT NULL, -- owning business (tenant), matches other tables' convention
  viewer_user_id UUID NOT NULL, -- the auth user who viewed it (owner or invited admin/manager)
  form_type TEXT NOT NULL,
  revealed BOOLEAN NOT NULL DEFAULT false,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS document_views_employee_form_id_idx ON document_views(employee_form_id);
CREATE INDEX IF NOT EXISTS document_views_user_id_idx ON document_views(user_id);
