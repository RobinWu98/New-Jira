# Developer Setup

This guide explains how to run Svida Job Tracker locally, initialize PostgreSQL, seed demo data, and add extra data for development or product demos.

## Prerequisites

- Node.js 24 or newer
- npm
- PostgreSQL running locally

## Local Environment

Create `.env.local` in the project root:

```env
DATABASE_URL=postgresql://postgres:shangwei@localhost:5432/jobTracker
TWO_FACTOR_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
SESSION_SECRET=local-development-session-secret-change-me
APP_URL=http://localhost:3000
APP_NAME=Svida Job Tracker
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=securemed@healthangel.com.au
SMTP_PASS=
EMAIL_FROM=Health Angel <securemed@healthangel.com.au>
EMAIL_REPLY_TO=securemed@healthangel.com.au
```

`SMTP_PASS` must be a valid Office 365 SMTP password if real email sending is needed. Leave it blank to avoid sending real emails.

## Run Locally

From the project root:

```powershell
cd C:\Users\User\Desktop\new_Jira\New-Jira
npm install
npm run db:init
npm run dev
```

Open:

```text
http://localhost:3000
```

Demo admin login:

```text
admin@example.com
Password123!
```

## Build Check

Run this before pushing:

```powershell
npm run build
```

## Database Initialization

The schema and seed data live in:

```text
scripts/schema.sql
```

The initializer is:

```text
scripts/init-db.mjs
```

Run:

```powershell
npm run db:init
```

This will:

- Create the `jobTracker` database if it does not exist.
- Create/update all tables.
- Seed demo users, projects, and tasks.
- Preserve existing rows where the seed uses conflict-safe inserts.

## Add Demo Data

For repeatable demo data, prefer adding rows to `scripts/schema.sql`. Keep inserts idempotent with `ON CONFLICT` or `WHERE NOT EXISTS`.

### Add a User

Use the same demo password hash unless you intentionally need another password.

```sql
INSERT INTO users (name, email, password_hash, role, category)
VALUES
  ('Demo User', 'demo.user@example.com', '$2a$12$OxGpAxD9R2QQhCHKNIOJfO9l7dZTDxr5WusTuHDB0p.ehEdjMWXaS', 'user', 'Business')
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    role = EXCLUDED.role,
    category = EXCLUDED.category,
    updated_at = now();
```

The demo password for that hash is:

```text
Password123!
```

### Add a Project

```sql
INSERT INTO projects (name, description, start_date, ddl, owner_id, status)
SELECT
  'Demo Launch Plan',
  'Prepare a pitch-ready launch workflow for the product demo.',
  '2026-06-01',
  '2026-06-30',
  users.id,
  'active'
FROM users
WHERE users.email = 'demo.user@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM projects WHERE projects.name = 'Demo Launch Plan'
  );
```

### Add Tasks

```sql
INSERT INTO tasks (project_id, title, assigned_to_id, priority, status)
SELECT projects.id, seed.title, users.id, seed.priority, seed.status
FROM (
  VALUES
    ('Confirm pitch script', 'high', 'todo'),
    ('Prepare demo account screenshots', 'medium', 'in_progress'),
    ('Review follow-up task list', 'low', 'todo')
) AS seed(title, priority, status)
JOIN projects ON projects.name = 'Demo Launch Plan'
JOIN users ON users.email = 'demo.user@example.com'
WHERE NOT EXISTS (
  SELECT 1
  FROM tasks
  WHERE tasks.project_id = projects.id
    AND tasks.title = seed.title
);
```

After changing `scripts/schema.sql`, run:

```powershell
npm run db:init
```

## Direct Database Access

If `psql` is installed:

```powershell
psql "postgresql://postgres:shangwei@localhost:5432/jobTracker"
```

Useful checks:

```sql
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM tasks;
```

## Git Workflow

Before pushing:

```powershell
npm run build
git status
git add .
git commit -m "Update developer setup and demo workflow"
git push origin main
```
