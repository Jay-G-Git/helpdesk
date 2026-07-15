-- JAY-13 — Compliance document expiration & reverification tracking.
--
-- I-9 compliance is not always a one-time event: employees with time-limited
-- work authorization (visas, EADs) legally require reverification before
-- their authorization expires. `ComplianceChecklist.tsx` only ever tracked
-- i9_status as a one-time boolean-ish string, so a lapsed reverification
-- would go completely unnoticed. Scoped narrowly per the ticket: just the
-- expiration date + a flag to avoid duplicate reminder sends — not a full
-- immigration-compliance suite (LCA/PAF/prevailing wage), which is
-- explicitly out of scope for this app.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS work_auth_expires_on date,
  ADD COLUMN IF NOT EXISTS compliance_reminder_sent_at timestamptz;
