-- Migration: JAY-57 — track overtime hours separately on each payroll run item
-- Nullable so existing rows (all pre-dating overtime calculation) are unaffected.
-- Run in Supabase SQL Editor

ALTER TABLE payroll_run_items ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC;
