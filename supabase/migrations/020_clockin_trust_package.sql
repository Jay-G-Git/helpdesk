-- JAY-18 — Clock-In Trust Package: optional geofence + photo capture.
--
-- Scope deliberately narrowed relative to the ticket's full mockup, matching
-- its own validation gut-check (avoid a big lift, ship the cheap version
-- first): no geocoding integration (no maps API key available in this
-- environment) — the owner enters the business's geofence center lat/lng
-- manually in Settings. No employee-profile-photo/facial-comparison system —
-- the ticket itself explicitly said to avoid actual face-matching; this ships
-- only the clock-in photo capture + owner manual visual review, which is what
-- the ticket asked for. Geofence is advisory/informational only (computed and
-- shown, never blocks a clock-in) since GPS accuracy varies a lot on mobile
-- web; the photo requirement, when an owner opts in, is enforced (clock-in
-- fails without a photo) since that's a deliberate owner setting, not an
-- environmental accuracy problem.

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS clock_in_lat numeric,
  ADD COLUMN IF NOT EXISTS clock_in_lng numeric,
  ADD COLUMN IF NOT EXISTS clock_in_photo_url text;

ALTER TABLE business_profiles
  ADD COLUMN IF NOT EXISTS geofence_lat numeric,
  ADD COLUMN IF NOT EXISTS geofence_lng numeric,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer,
  ADD COLUMN IF NOT EXISTS require_clockin_photo boolean NOT NULL DEFAULT false;
