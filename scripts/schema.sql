CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email CITEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  category TEXT,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret TEXT,
  two_factor_pending_secret TEXT,
  two_factor_pin_hash TEXT,
  two_factor_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_pending_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_pin_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_confirmed_at TIMESTAMPTZ;

UPDATE users
SET category = 'Business'
WHERE category IS NULL OR category NOT IN ('IT', 'Sales', 'Support', 'Business');

ALTER TABLE users ALTER COLUMN category SET DEFAULT 'Business';
ALTER TABLE users ALTER COLUMN category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_category_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_category_check
      CHECK (category IN ('IT', 'Sales', 'Support', 'Business'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_registration_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_code_hash TEXT NOT NULL,
  invite_token_hash TEXT UNIQUE,
  admin_verified_at TIMESTAMPTZ,
  invite_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  ddl DATE NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id) ON DELETE RESTRICT;

WITH fallback_user AS (
  SELECT id FROM users ORDER BY created_at ASC LIMIT 1
)
UPDATE tasks
SET assigned_to_id = COALESCE(projects.owner_id, fallback_user.id)
FROM projects, fallback_user
WHERE tasks.project_id = projects.id
  AND tasks.assigned_to_id IS NULL;

ALTER TABLE tasks ALTER COLUMN assigned_to_id SET NOT NULL;
ALTER TABLE tasks DROP COLUMN IF EXISTS progress;

CREATE TABLE IF NOT EXISTS two_factor_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS two_factor_backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT UNIQUE NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS two_factor_trusted_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  last_two_factor_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS user_registration_invites_user_id_idx ON user_registration_invites(user_id);
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects(owner_id);
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_assigned_to_id_idx ON tasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS two_factor_challenges_user_id_idx ON two_factor_challenges(user_id);
CREATE INDEX IF NOT EXISTS two_factor_backup_codes_user_id_idx ON two_factor_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS two_factor_trusted_sessions_user_id_idx ON two_factor_trusted_sessions(user_id);

INSERT INTO users (name, email, password_hash, role, category)
VALUES
  ('Ava Chen', 'ava.chen@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'IT'),
  ('Liam Patel', 'liam.patel@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'Sales'),
  ('Mia Rodriguez', 'mia.rodriguez@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'Support'),
  ('Noah Williams', 'noah.williams@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'Business'),
  ('Sophia Nguyen', 'sophia.nguyen@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'IT'),
  ('Ethan Brooks', 'ethan.brooks@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'Sales'),
  ('Olivia Martin', 'olivia.martin@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'Support'),
  ('Lucas Brown', 'lucas.brown@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'Business'),
  ('Emma Wilson', 'emma.wilson@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'IT'),
  ('James Miller', 'james.miller@example.com', '$2a$12$PtUf3bMjnjyEbj0MqalicuaMfivjvcy.DMIca30r0FJv3BEMx2b6a', 'user', 'Sales')
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    category = EXCLUDED.category,
    updated_at = now();

INSERT INTO projects (name, description, start_date, ddl, owner_id, status)
SELECT seed.name, seed.description, seed.start_date::date, seed.ddl::date, users.id, seed.status
FROM (
  VALUES
    ('Website Refresh', 'Update the public site content and launch a cleaner homepage.', '2026-06-03', '2026-06-28', 'ava.chen@example.com', 'active'),
    ('CRM Cleanup', 'Review old contacts and tidy duplicate records.', '2026-06-05', '2026-06-20', 'liam.patel@example.com', 'active'),
    ('Hiring Pipeline', 'Track interview steps for new team roles.', '2026-06-10', '2026-07-10', 'mia.rodriguez@example.com', 'active'),
    ('Customer Portal Launch', 'Prepare customer self-service access for common account tasks.', '2026-06-12', '2026-07-18', 'noah.williams@example.com', 'active'),
    ('Q2 Sales Audit', 'Close the quarter review and reconcile opportunity data.', '2026-05-01', '2026-05-24', 'ethan.brooks@example.com', 'done'),
    ('Support Knowledge Base', 'Refresh support articles and publish the first internal release.', '2026-04-18', '2026-05-16', 'olivia.martin@example.com', 'done'),
    ('IT Asset Review', 'Confirm device assignments and retire old hardware records.', '2026-04-05', '2026-05-08', 'sophia.nguyen@example.com', 'done'),
    ('Business Ops Playbook', 'Document recurring operations workflows for onboarding.', '2026-03-25', '2026-04-30', 'lucas.brown@example.com', 'done')
) AS seed(name, description, start_date, ddl, owner_email, status)
JOIN users ON users.email = seed.owner_email
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.name = seed.name);

UPDATE projects SET status = 'active' WHERE status NOT IN ('active', 'done');

INSERT INTO tasks (project_id, title, assigned_to_id, priority, status)
SELECT projects.id, seed.title, projects.owner_id, seed.priority, seed.status
FROM (
  VALUES
    ('Website Refresh', 'Collect homepage copy', 'high', 65, 'in_progress'),
    ('Website Refresh', 'Prepare launch checklist', 'medium', 20, 'todo'),
    ('Website Refresh', 'Review visual QA notes', 'medium', 35, 'todo'),
    ('Website Refresh', 'Confirm analytics tags', 'low', 15, 'todo'),
    ('Website Refresh', 'Publish staging preview', 'high', 50, 'in_progress'),
    ('Website Refresh', 'Send stakeholder update', 'medium', 10, 'todo'),
    ('CRM Cleanup', 'Merge duplicate companies', 'medium', 40, 'in_progress'),
    ('CRM Cleanup', 'Archive stale contacts', 'low', 10, 'todo'),
    ('CRM Cleanup', 'Normalize account owners', 'high', 45, 'in_progress'),
    ('CRM Cleanup', 'Export backup report', 'medium', 60, 'in_progress'),
    ('CRM Cleanup', 'Validate cleaned segments', 'medium', 25, 'todo'),
    ('Hiring Pipeline', 'Create interview scorecard', 'high', 75, 'in_progress'),
    ('Hiring Pipeline', 'Schedule first round interviews', 'medium', 30, 'todo'),
    ('Hiring Pipeline', 'Draft candidate brief', 'medium', 55, 'in_progress'),
    ('Hiring Pipeline', 'Review role requirements', 'high', 80, 'in_progress'),
    ('Hiring Pipeline', 'Prepare offer template', 'low', 20, 'todo'),
    ('Hiring Pipeline', 'Collect panel feedback', 'medium', 15, 'todo'),
    ('Hiring Pipeline', 'Update recruiting dashboard', 'low', 35, 'todo'),
    ('Customer Portal Launch', 'Define launch scope', 'high', 70, 'in_progress'),
    ('Customer Portal Launch', 'Map account settings flow', 'medium', 45, 'in_progress'),
    ('Customer Portal Launch', 'Prepare access roles', 'medium', 30, 'todo'),
    ('Customer Portal Launch', 'Write release notes', 'low', 10, 'todo'),
    ('Customer Portal Launch', 'Run smoke tests', 'high', 25, 'todo'),
    ('Customer Portal Launch', 'Confirm support handoff', 'medium', 20, 'todo'),
    ('Q2 Sales Audit', 'Freeze opportunity exports', 'high', 100, 'done'),
    ('Q2 Sales Audit', 'Compare quarterly targets', 'medium', 100, 'done'),
    ('Q2 Sales Audit', 'Fix owner mismatches', 'medium', 100, 'done'),
    ('Q2 Sales Audit', 'Review audit exceptions', 'high', 100, 'done'),
    ('Q2 Sales Audit', 'Send final report', 'low', 100, 'done'),
    ('Support Knowledge Base', 'Select top support topics', 'medium', 100, 'done'),
    ('Support Knowledge Base', 'Rewrite login articles', 'high', 100, 'done'),
    ('Support Knowledge Base', 'Add screenshots', 'medium', 100, 'done'),
    ('Support Knowledge Base', 'Review escalation wording', 'medium', 100, 'done'),
    ('Support Knowledge Base', 'Publish internal draft', 'high', 100, 'done'),
    ('Support Knowledge Base', 'Collect team signoff', 'low', 100, 'done'),
    ('IT Asset Review', 'Export device inventory', 'medium', 100, 'done'),
    ('IT Asset Review', 'Match laptops to users', 'high', 100, 'done'),
    ('IT Asset Review', 'Flag missing serial numbers', 'medium', 100, 'done'),
    ('IT Asset Review', 'Retire inactive records', 'medium', 100, 'done'),
    ('IT Asset Review', 'Confirm loaner pool', 'low', 100, 'done'),
    ('IT Asset Review', 'Update asset owners', 'high', 100, 'done'),
    ('IT Asset Review', 'Share completion summary', 'low', 100, 'done'),
    ('Business Ops Playbook', 'Outline monthly workflow', 'medium', 100, 'done'),
    ('Business Ops Playbook', 'Document approval steps', 'high', 100, 'done'),
    ('Business Ops Playbook', 'Add onboarding checklist', 'medium', 100, 'done'),
    ('Business Ops Playbook', 'Review with operations lead', 'medium', 100, 'done'),
    ('Business Ops Playbook', 'Publish final version', 'low', 100, 'done')
) AS seed(project_name, title, priority, progress, status)
JOIN projects ON projects.name = seed.project_name
WHERE NOT EXISTS (
  SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND tasks.title = seed.title
);
