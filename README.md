# IntervYou — Real‑time Technical Interview Platform

A Next.js (App Router) platform for conducting live technical interviews with collaborative coding, video, AI‑assisted test generation, and Judge0‑powered execution. Designed for interviewer/interviewee workflows, sample vs private test cases, and clean HackerRank‑style UX.

## Key Features
- Live interview room with video + shared code state
- Monaco editor with language switcher (JavaScript, Java, C++)
- One‑call multi‑test harness (Judge0) to conserve quota
- Sample (visible) vs Private (hidden) test cases
- HackerRank‑style test results (per‑case cards, pass/fail, lock icon for hidden)
- AI (Gemini) test/driver generation for interviewers
- Google OAuth via NextAuth
- Submissions tracking with per‑problem attempt limits, dashboard
- Prisma (PostgreSQL) for persistence

## Tech Stack
- Web: Next.js 14 (App Router), TypeScript, Tailwind
- Editor: @monaco-editor/react
- Auth: next-auth (Google)
- DB: Prisma + PostgreSQL
- Realtime: Supabase Realtime Channels (broadcast state)
- Code Execution: Judge0 (server‑to‑server)
- AI: Google Gemini (test & driver generation)

## Monorepo Layout
- `app/` — Next.js App Router pages & API routes
  - `app/interview/[sessionId]` — Interview UI
  - `app/api/*` — Server endpoints (auth, execute, invite, state, submissions, tests/generate)
  - `app/dashboard/submissions` — My Submissions dashboard
- `components/` — UI components
- `lib/` — server libs (auth, judge0, db, email, etc.)
- `prisma/` — Prisma schema + migrations

## Prerequisites
- Node.js 18+
- PostgreSQL (managed or local)
- Google Cloud OAuth 2.0 client (Web app)
- Judge0 endpoint (RapidAPI CE or self‑hosted)
- Google Gemini API key (optional, for test generation)

## Environment Variables (.env)
Copy these to Vercel or a local `.env` file. Values are examples:

```
# NextAuth
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=your-strong-random-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database (Postgres)
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DB?schema=public

# Public app URL (used in invite links)
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app

# Judge0
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_KEY=your-rapidapi-key-optional

# Gemini
GEMINI_API_KEY=your-gemini-api-key

# SMTP / Email invites
EMAIL=youremail@gmail.com
APP_PASSWORD=your-app-password-or-smtp-pass
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465

# Submission / execution exemptions
EXEMPT_EMAIL1=
EXEMPT_EMAIL2=
```

## Install & Run (Local)
```
npm install

# Create and apply DB schema
npx prisma migrate dev
# or, to apply existing migrations only
# npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Dev server
npm run dev
```

Open http://localhost:3000

## First‑Run Flow (Happy Path)
1. Sign in with Google
2. Create an invite (interviewer) — invitee receives a link
3. Both open /interview/:sessionId
4. Interviewer pastes problem, optionally click "Get 20 edge test cases (Gemini)"
5. Candidate writes code; click Run
   - If any compile/runtime errors: shown in Run Output
   - Else: per‑test cards render with pass/fail; private tests appear locked for candidate
6. Click Submit (final) — saves code/results to Submissions and enforces attempt limits (2 unless exempt)
7. View history at /dashboard/submissions

## API Highlights
- POST `/api/execute` — Submit single combined harness to Judge0 (one call per run)
- POST `/api/tests/generate` — Ask Gemini to generate tests + Java driver (returns JSON)
- POST `/api/invite` — Create session and send email invite (returns redirect link)
- GET/POST `/api/interview/state` — Persist shared interview state (language/code/problem/tests/driver)
- GET `/api/submissions` — Current user’s submissions
- POST `/api/submissions` — Create/update submission with limit enforcement

## Submission Limits & Exemptions
- Default: 2 submissions per (sessionId + problemId + user)
- Exempt: set EXEMPT_EMAIL1 / EXEMPT_EMAIL2 (env) for unlimited tries

## Deploy on Vercel
1. Import repo on Vercel, set Framework to Next.js
2. Add all environment variables (see above)
3. Configure Google OAuth:
   - Authorized JavaScript origins: `https://your-domain.vercel.app`
   - Authorized redirect URIs: `https://your-domain.vercel.app/api/auth/callback/google`
4. Ensure `DATABASE_URL` is set and run DB migrations:
   - `npx prisma migrate deploy` (CI step or manual)
5. Deploy

## Security Notes
- All server endpoints are protected via NextAuth session checks (requireAuth)
- Judge0 calls are server‑to‑server
- Private tests are never revealed to the candidate client; only pass/fail is shown
- Always set strong `NEXTAUTH_SECRET` and restrict OAuth origins/redirects

## Customization
- Languages: update ALLOWED_LANGS in `app/api/execute/route.ts`
- Harness logic: update `buildJava`, `buildCpp`, `buildJS` in `app/interview/[sessionId]/page.tsx`
- Exempt emails: use `EXEMPT_EMAIL1`, `EXEMPT_EMAIL2`
- Dashboard: extend `/app/dashboard/submissions` with filters or details

## Troubleshooting
- Auth 401: verify `NEXTAUTH_URL`, Google OAuth origins/redirects
- DB errors: check `DATABASE_URL` and run `npx prisma migrate deploy`
- Judge0 4xx/5xx: verify `JUDGE0_URL`/`JUDGE0_KEY` and payload size
- Gemini errors: ensure `GEMINI_API_KEY` and usage limits
- Emails not sending: verify SMTP credentials and provider requirements

## License
MIT
