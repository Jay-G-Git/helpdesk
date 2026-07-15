-- JAY-9 — Partial-day time-off requests.
--
-- time_off_requests only ever stored whole start/end dates, so there was no
-- way to represent "leaving at noon" or "back after lunch." Scoped to
-- single-day requests only (start_date = end_date) — a multi-day request
-- with a half-day on one end is a different, more involved feature and is
-- explicitly out of scope here.
--
-- portion is null for existing/multi-day rows (treated as a full day
-- everywhere it's read), or one of 'first_half' / 'second_half' for a
-- single-day request that's a half day. There's no 'full' value stored —
-- "full day" is just the absence of a portion, same as today's default.
ALTER TABLE time_off_requests ADD COLUMN IF NOT EXISTS portion text;

ALTER TABLE time_off_requests
  ADD CONSTRAINT time_off_requests_portion_check
  CHECK (portion IS NULL OR portion IN ('first_half', 'second_half'));
