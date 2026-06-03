# jobTracker

Old fashioned Next.js full-stack starter with a basic account system.

## Local setup

1. Create a PostgreSQL database named `jobTracker`.
2. Put the real connection string in `.env.local`.
   To send password reset emails through Resend, also add:

```bash
RESEND_API_KEY="your-resend-api-key"
APP_URL="http://localhost:3000"
EMAIL_FROM="Svida Job Tracker <noreply@your-verified-domain.com>"
```

   `EMAIL_FROM` must use a domain verified in Resend. Password reset emails use `shangweiwu1013@gmail.com` as the reply-to address.
3. Install dependencies:

```bash
npm install
```

4. Initialize tables:

```bash
npm run db:init
```

5. Start the app:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Current scope

- Email and password registration
- Login session with httpOnly cookie
- Logout
- Forgot password token flow
- Reset password
- Change password
- Old fashioned high-contrast UI
