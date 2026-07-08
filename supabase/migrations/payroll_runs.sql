-- Payroll runs: one record per pay period processed
CREATE TABLE IF NOT EXISTS payroll_runs (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL,
  period_start date NOT NULL,
  period_end   date NOT NULL,
  run_date     date NOT NULL DEFAULT CURRENT_DATE,
  status       text NOT NULL DEFAULT 'draft',  -- draft | finalized
  total_gross  numeric(12,2) NOT NULL DEFAULT 0,
  employee_count integer NOT NULL DEFAULT 0,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Individual line items per employee per run
CREATE TABLE IF NOT EXISTS payroll_run_items (
  id            bigserial PRIMARY KEY,
  run_id        bigint NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  employee_id   integer NOT NULL REFERENCES employees(id),
  employee_name text NOT NULL,
  pay_type      text NOT NULL,   -- hourly | salary
  pay_rate      numeric(10,2) NOT NULL,
  hours_worked  numeric(8,2),    -- null for salary
  gross_pay     numeric(12,2) NOT NULL,
  deductions    jsonb NOT NULL DEFAULT '{}',  -- { federal: 0, state: 0, other: 0 }
  net_pay       numeric(12,2) NOT NULL,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payroll_runs_user ON payroll_runs(user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_run_items_run ON payroll_run_items(run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_run_items_emp ON payroll_run_items(employee_id);
