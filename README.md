# jobTracker

Old fashioned Next.js full-stack starter with a basic account system.

For full developer setup, database seeding, Docker demo notes, and data insertion examples, see:

```text
docs/DEVELOPER_SETUP.md
```

## Local setup

1. Start PostgreSQL locally.
2. Put the real connection string in `.env.local`. A local development file is included with:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/jobTracker
```

   The `db:init` script creates the `jobTracker` database if it does not exist.
   To send password reset and invite emails through Office 365 during development, set:

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=securemed@healthangel.com.au
SMTP_PASS=your-office365-password
EMAIL_FROM="Health Angel <securemed@healthangel.com.au>"
EMAIL_REPLY_TO=securemed@healthangel.com.au
ADMIN_INVITE_VERIFICATION_EMAIL=securemed@healthangel.com.au
```

   If `SMTP_PASS` is empty, the app stays in development fallback mode and shows reset/invite links in the UI instead of sending real email.
3. Install dependencies:

```bash
npm install
```

4. Initialize tables and seed demo data:

```bash
npm run db:init
```

   Demo admin login:

```bash
admin@example.com
Password123!
```

5. Start the app:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Docker pitch setup

Use this when you want a quick product demo with PostgreSQL and seeded data.

```bash
docker compose up --build
```

The app runs at:

```bash
http://localhost:3000
```

The Docker database is exposed on host port `5433` and stores data in the `svida_jobtracker_data` Docker volume.

Seeded demo login:

```bash
admin@example.com
Password123!
```

The app container runs `npm run db:init` before starting, so the Docker database is automatically created and seeded with demo users, projects, and tasks.

To reset the Docker demo database:

```bash
docker compose down -v
docker compose up --build
```

For real Office 365 SMTP in Docker, set `SMTP_USER` and `SMTP_PASS` in `docker-compose.yml` before starting the app.

## Current scope

- Email and password registration
- Login session with httpOnly cookie
- Logout
- Forgot password token flow
- Reset password
- Change password
- Old fashioned high-contrast UI
