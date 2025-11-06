# IntervYou

A lightweight platform for mock technical interviews. Built with Next.js 14, TypeScript, Tailwind, NextAuth, Prisma.

## Quickstart

1) Install deps

```bash
pnpm i # or npm i / yarn
```

2) Environment

Create `.env.local`:

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=changeme
DATABASE_URL=postgresql://user:pass@host:5432/db
# Judge0
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_KEY= # optional if using RapidAPI
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

3) Tailwind and Next.js
- Already configured. Files: tailwind.config.ts, postcss.config.js, styles/globals.css, app/layout.tsx

4) Prisma
```bash
npx prisma generate
npx prisma migrate dev
```

5) Dev
```bash
pnpm dev
```

## Implemented
- Google OAuth with NextAuth (JWT sessions)
- Problems API with sample problem
- Execute API proxy to Judge0
- Simple in-memory matchmaking and session generation
- Monaco editor, basic layout with Tailwind

## Roadmap
- Realtime collaboration (Supabase Realtime)
- Persistent sessions and problem attempts (Prisma models)
- Email invites via Resend/Nodemailer
- WebRTC video + signaling server
- Auto tests generation from problem description
