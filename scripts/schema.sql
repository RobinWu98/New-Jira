CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_confirmed_at TIMESTAMPTZ;
ALTER TABLE users DROP COLUMN IF EXISTS two_factor_pin_hash;

UPDATE users
SET category = 'Business'
WHERE category IS NULL OR category NOT IN ('IT', 'Sales', 'Support', 'Business');

UPDATE users
SET role = 'user'
WHERE role NOT IN ('admin', 'user');

ALTER TABLE users ALTER COLUMN category SET DEFAULT 'Business';
ALTER TABLE users ALTER COLUMN category SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'user'));
  END IF;

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
  start_date DATE,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  start_date DATE,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'todo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

UPDATE projects SET status = 'active' WHERE status NOT IN ('active', 'done');
UPDATE tasks SET priority = 'medium' WHERE priority NOT IN ('low', 'medium', 'high');
UPDATE tasks SET status = 'todo' WHERE status NOT IN ('todo', 'in_progress', 'done');
UPDATE subtasks SET priority = 'medium' WHERE priority NOT IN ('low', 'medium', 'high');
UPDATE subtasks SET status = 'todo' WHERE status NOT IN ('todo', 'in_progress', 'done');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_status_check'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_status_check
      CHECK (status IN ('active', 'done'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_priority_check'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_priority_check
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_status_check'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_status_check
      CHECK (status IN ('todo', 'in_progress', 'done'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subtasks_priority_check'
  ) THEN
    ALTER TABLE subtasks
      ADD CONSTRAINT subtasks_priority_check
      CHECK (priority IN ('low', 'medium', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subtasks_status_check'
  ) THEN
    ALTER TABLE subtasks
      ADD CONSTRAINT subtasks_status_check
      CHECK (status IN ('todo', 'in_progress', 'done'));
  END IF;
END $$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assigned_to_id UUID REFERENCES users(id) ON DELETE RESTRICT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;

UPDATE tasks
SET start_date = projects.start_date
FROM projects
WHERE tasks.project_id = projects.id
  AND tasks.start_date IS NULL;

UPDATE tasks
SET due_date = projects.ddl
FROM projects
WHERE tasks.project_id = projects.id
  AND tasks.due_date IS NULL;

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
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);
CREATE INDEX IF NOT EXISTS subtasks_task_id_idx ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS subtasks_assigned_to_id_idx ON subtasks(assigned_to_id);
CREATE INDEX IF NOT EXISTS subtasks_due_date_idx ON subtasks(due_date);
CREATE INDEX IF NOT EXISTS two_factor_challenges_user_id_idx ON two_factor_challenges(user_id);
CREATE INDEX IF NOT EXISTS two_factor_backup_codes_user_id_idx ON two_factor_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS two_factor_trusted_sessions_user_id_idx ON two_factor_trusted_sessions(user_id);

INSERT INTO users (name, email, password_hash, role, category)
VALUES
  ('Jordan Lee', 'admin@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'admin', 'Business'),
  ('Ava Chen', 'ava.chen@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'IT'),
  ('Liam Patel', 'liam.patel@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Sales'),
  ('Mia Rodriguez', 'mia.rodriguez@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Support'),
  ('Noah Williams', 'noah.williams@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Business'),
  ('Sophia Nguyen', 'sophia.nguyen@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'IT'),
  ('Ethan Brooks', 'ethan.brooks@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Sales'),
  ('Olivia Martin', 'olivia.martin@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Support'),
  ('Lucas Brown', 'lucas.brown@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Business'),
  ('Emma Wilson', 'emma.wilson@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'IT'),
  ('James Miller', 'james.miller@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Sales')
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    category = EXCLUDED.category,
    updated_at = now();

INSERT INTO projects (name, description, start_date, ddl, owner_id, status)
SELECT seed.name, seed.description, seed.start_date::date, seed.ddl::date, users.id, seed.status
FROM (
  VALUES
    ('Website Refresh', 'Refresh the public marketing site, including content, analytics, and launch readiness.', '2026-06-03', '2026-06-28', 'ava.chen@example.com', 'active'),
    ('CRM Data Cleanup', 'De-duplicate accounts, normalize ownership, and prepare cleaner sales reporting.', '2026-06-05', '2026-06-24', 'liam.patel@example.com', 'active'),
    ('Hiring Pipeline', 'Coordinate interview stages, feedback collection, and offer preparation for open roles.', '2026-06-10', '2026-07-10', 'mia.rodriguez@example.com', 'active'),
    ('Customer Portal Launch', 'Prepare the self-service customer portal for beta launch and support handoff.', '2026-06-12', '2026-07-18', 'noah.williams@example.com', 'active'),
    ('Mobile Incident Triage', 'Track investigation and remediation work for recent mobile app stability issues.', '2026-06-01', '2026-06-21', 'sophia.nguyen@example.com', 'active'),
    ('Q2 Sales Audit', 'Close the quarter review and reconcile opportunity data.', '2026-05-01', '2026-05-24', 'ethan.brooks@example.com', 'done'),
    ('Support Knowledge Base', 'Refresh support articles and publish the first internal release.', '2026-04-18', '2026-05-16', 'olivia.martin@example.com', 'done'),
    ('IT Asset Review', 'Confirm device assignments and retire old hardware records.', '2026-04-05', '2026-05-08', 'sophia.nguyen@example.com', 'done'),
    ('Business Ops Playbook', 'Document recurring operations workflows for onboarding.', '2026-03-25', '2026-04-30', 'lucas.brown@example.com', 'done')
) AS seed(name, description, start_date, ddl, owner_email, status)
JOIN users ON users.email = seed.owner_email
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE projects.name = seed.name);

UPDATE projects SET status = 'active' WHERE status NOT IN ('active', 'done');

INSERT INTO tasks (project_id, title, assigned_to_id, start_date, due_date, priority, status)
SELECT projects.id, seed.title, users.id, projects.start_date, projects.ddl, seed.priority, seed.status
FROM (
  VALUES
    ('Website Refresh', 'Collect final homepage copy', 'mia.rodriguez@example.com', 'high', 'in_progress'),
    ('Website Refresh', 'Implement responsive navigation polish', 'ava.chen@example.com', 'high', 'in_progress'),
    ('Website Refresh', 'Confirm analytics tags in staging', 'emma.wilson@example.com', 'medium', 'todo'),
    ('Website Refresh', 'Prepare launch checklist', 'noah.williams@example.com', 'medium', 'todo'),
    ('Website Refresh', 'Send stakeholder preview notes', 'admin@example.com', 'low', 'todo'),
    ('CRM Data Cleanup', 'Merge duplicate company records', 'liam.patel@example.com', 'high', 'in_progress'),
    ('CRM Data Cleanup', 'Archive stale contacts older than 18 months', 'ethan.brooks@example.com', 'medium', 'todo'),
    ('CRM Data Cleanup', 'Normalize account owner fields', 'james.miller@example.com', 'high', 'in_progress'),
    ('CRM Data Cleanup', 'Export backup report for finance', 'noah.williams@example.com', 'medium', 'done'),
    ('CRM Data Cleanup', 'Validate cleaned customer segments', 'liam.patel@example.com', 'medium', 'todo'),
    ('Hiring Pipeline', 'Create interview scorecard template', 'mia.rodriguez@example.com', 'high', 'done'),
    ('Hiring Pipeline', 'Schedule first-round interviews', 'olivia.martin@example.com', 'medium', 'in_progress'),
    ('Hiring Pipeline', 'Draft candidate briefing pack', 'lucas.brown@example.com', 'medium', 'todo'),
    ('Hiring Pipeline', 'Review role requirements with hiring manager', 'admin@example.com', 'high', 'in_progress'),
    ('Hiring Pipeline', 'Prepare offer approval template', 'noah.williams@example.com', 'low', 'todo'),
    ('Customer Portal Launch', 'Define beta launch scope', 'noah.williams@example.com', 'high', 'done'),
    ('Customer Portal Launch', 'Map account settings flow', 'ava.chen@example.com', 'medium', 'in_progress'),
    ('Customer Portal Launch', 'Prepare customer access roles', 'sophia.nguyen@example.com', 'medium', 'todo'),
    ('Customer Portal Launch', 'Write release notes', 'olivia.martin@example.com', 'low', 'todo'),
    ('Customer Portal Launch', 'Run beta smoke tests', 'emma.wilson@example.com', 'high', 'todo'),
    ('Mobile Incident Triage', 'Reproduce crash from latest production logs', 'sophia.nguyen@example.com', 'high', 'in_progress'),
    ('Mobile Incident Triage', 'Group affected sessions by device model', 'emma.wilson@example.com', 'medium', 'done'),
    ('Mobile Incident Triage', 'Draft customer support macro', 'olivia.martin@example.com', 'medium', 'todo'),
    ('Mobile Incident Triage', 'Prepare hotfix release checklist', 'ava.chen@example.com', 'high', 'todo'),
    ('Q2 Sales Audit', 'Freeze opportunity exports', 'ethan.brooks@example.com', 'high', 'done'),
    ('Q2 Sales Audit', 'Compare quarterly targets', 'liam.patel@example.com', 'medium', 'done'),
    ('Q2 Sales Audit', 'Fix owner mismatches', 'james.miller@example.com', 'medium', 'done'),
    ('Q2 Sales Audit', 'Send final report', 'admin@example.com', 'low', 'done'),
    ('Support Knowledge Base', 'Select top support topics', 'olivia.martin@example.com', 'medium', 'done'),
    ('Support Knowledge Base', 'Rewrite login articles', 'mia.rodriguez@example.com', 'high', 'done'),
    ('Support Knowledge Base', 'Add article screenshots', 'emma.wilson@example.com', 'medium', 'done'),
    ('Support Knowledge Base', 'Publish internal draft', 'olivia.martin@example.com', 'high', 'done'),
    ('IT Asset Review', 'Export device inventory', 'sophia.nguyen@example.com', 'medium', 'done'),
    ('IT Asset Review', 'Match laptops to assigned users', 'ava.chen@example.com', 'high', 'done'),
    ('IT Asset Review', 'Retire inactive hardware records', 'emma.wilson@example.com', 'medium', 'done'),
    ('IT Asset Review', 'Share completion summary', 'sophia.nguyen@example.com', 'low', 'done'),
    ('Business Ops Playbook', 'Outline monthly operations workflow', 'lucas.brown@example.com', 'medium', 'done'),
    ('Business Ops Playbook', 'Document approval steps', 'noah.williams@example.com', 'high', 'done'),
    ('Business Ops Playbook', 'Add onboarding checklist', 'admin@example.com', 'medium', 'done'),
    ('Business Ops Playbook', 'Publish final version', 'lucas.brown@example.com', 'low', 'done')
) AS seed(project_name, title, assignee_email, priority, status)
JOIN projects ON projects.name = seed.project_name
JOIN users ON users.email = seed.assignee_email
WHERE NOT EXISTS (
  SELECT 1 FROM tasks WHERE tasks.project_id = projects.id AND tasks.title = seed.title
);
