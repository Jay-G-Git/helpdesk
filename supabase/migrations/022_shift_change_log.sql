-- JAY-6 — Short-notice schedule change flags.
--
-- Correction to the ticket's own premise: it claimed shift edit history
-- "already exists in shift_logbook" (citing commit 070a935) and that this
-- ships with zero schema change. That table doesn't actually exist —
-- migration 011_shift_logbook.sql (despite its filename) creates
-- `shift_notes`, a free-text daily manager-logbook table with no per-edit
-- timestamps or before/after values at all. There is genuinely no data
-- source today that records when a shift was last changed, so a real
-- (small, additive-only) table is required to make this banner honest.
--
-- Scoped to exactly what's mutable in the UI today: a shift being created,
-- moved (date/employee reassigned via drag-and-drop or swap approval), or
-- deleted. There's no post-creation start/end time editor in this app yet,
-- so "time changed" isn't a change type this logs (nothing produces that
-- event) — if a start/end time editor is added later, extending this table
-- to log it is a one-line addition, not a redesign.
CREATE TABLE IF NOT EXISTS shift_change_log (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL,
  shift_id    bigint NOT NULL,
  employee_id bigint,
  shift_date  date NOT NULL,
  start_time  text NOT NULL,
  end_time    text NOT NULL,
  change_type text NOT NULL, -- 'created' | 'moved' | 'reassigned' | 'deleted'
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shift_change_log_lookup ON shift_change_log (user_id, shift_date, changed_at);

ALTER TABLE shift_change_log ENABLE ROW LEVEL SECURITY;

-- Owner-only — this is a scheduling-insight feature on the owner/manager
-- Schedule page, not something surfaced to employees.
CREATE POLICY "owner_manage_shift_change_log" ON shift_change_log
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
