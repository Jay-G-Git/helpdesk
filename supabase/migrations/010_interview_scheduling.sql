-- Interview scheduling on job applications
ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS interview_at TIMESTAMPTZ;
