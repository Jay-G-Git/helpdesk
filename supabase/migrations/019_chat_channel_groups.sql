-- JAY-19 — Custom group chat channels (manual creation + hand-picked members;
-- no auto-assignment by department/role yet, per the ticket's own validation
-- gut-check: ship manual groups first, watch usage before building
-- department/role auto-membership on top of the not-yet-fully-wired
-- Departments feature).
--
-- Naming matches the rest of the app: business/tenant scoping column is
-- `user_id` everywhere else (employees, shift_swaps, departments, etc.), so
-- this uses `user_id`, not `business_id`, even though chat_messages itself
-- (an earlier, separately-migrated table) happens to use `business_id` for
-- the same concept.
CREATE TABLE IF NOT EXISTS chat_channel_groups (
  id          bigserial PRIMARY KEY,
  user_id     uuid NOT NULL,   -- owner/tenant id, same value chat_messages.business_id holds
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_channel_group_members (
  id           bigserial PRIMARY KEY,
  group_id     bigint NOT NULL REFERENCES chat_channel_groups(id) ON DELETE CASCADE,
  employee_id  bigint NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE (group_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_channel_groups_user ON chat_channel_groups (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_group_members_group ON chat_channel_group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_chat_channel_group_members_employee ON chat_channel_group_members (employee_id);

ALTER TABLE chat_channel_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channel_group_members ENABLE ROW LEVEL SECURITY;

-- Owners: full access to groups/members for their own business.
CREATE POLICY "owner_manage_groups" ON chat_channel_groups
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner_manage_group_members" ON chat_channel_group_members
  USING (EXISTS (SELECT 1 FROM chat_channel_groups g WHERE g.id = chat_channel_group_members.group_id AND g.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM chat_channel_groups g WHERE g.id = chat_channel_group_members.group_id AND g.user_id = auth.uid()));

-- Employees: can see groups/memberships for their own business (needed so the
-- channel list can resolve group names), but cannot create/modify groups —
-- creation is owner-only, enforced again at the API layer in
-- POST /api/messages/groups.
CREATE POLICY "employee_select_groups" ON chat_channel_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.email = (auth.jwt() ->> 'email')
        AND e.user_id = chat_channel_groups.user_id
    )
  );

CREATE POLICY "employee_select_group_members" ON chat_channel_group_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_channel_groups g
      JOIN employees e ON e.user_id = g.user_id
      WHERE g.id = chat_channel_group_members.group_id
        AND e.email = (auth.jwt() ->> 'email')
    )
  );

-- ── Extend chat_messages RLS to cover group_<id> channels ──────────────────
-- Owner policies already grant full access regardless of channel value
-- (business_id = auth.uid()), so only the employee-facing policies need the
-- additional OR clause. Dropping and recreating rather than trying to ALTER
-- an existing USING/WITH CHECK expression.
DROP POLICY IF EXISTS "employee_select_messages" ON chat_messages;
CREATE POLICY "employee_select_messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.email = (auth.jwt() ->> 'email')
        AND e.user_id = chat_messages.business_id
        AND (
          chat_messages.channel = 'general'
          OR chat_messages.channel = 'dm_emp_' || e.id::text
          OR EXISTS (
            SELECT 1 FROM chat_channel_group_members gm
            WHERE gm.employee_id = e.id
              AND chat_messages.channel = 'group_' || gm.group_id::text
          )
        )
    )
  );

DROP POLICY IF EXISTS "employee_insert_messages" ON chat_messages;
CREATE POLICY "employee_insert_messages" ON chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM employees e
      WHERE e.email = (auth.jwt() ->> 'email')
        AND e.user_id = chat_messages.business_id
        AND (
          chat_messages.channel = 'general'
          OR chat_messages.channel = 'dm_emp_' || e.id::text
          OR EXISTS (
            SELECT 1 FROM chat_channel_group_members gm
            WHERE gm.employee_id = e.id
              AND chat_messages.channel = 'group_' || gm.group_id::text
          )
        )
    )
  );
