# IntervYou - Real-time Technical Interview Platform

A Next.js (App Router) platform for conducting live technical interviews with collaborative coding, video, AI-assisted test generation, and Judge0-powered execution. Designed for pair programming workflows with robust real-time synchronization.

## Key Features

- **Live Interview Room**: Real-time video + shared code state (Monaco Editor).
- **Pro Collaboration**:
    - **Bidirectional Editing**: Both authentication users can type simultaneously.
    - **Real-time Cursor Sync**: See your peer's cursor position in real-time.
    - **Smart De-bouncing**: Updates are ignored while you type (300ms) to prevent cursor jitter.
    - **Patch Updates**: Only modified lines are broadcast to save bandwidth.
    - **"Last Edited By"**: Visual indicator to show who made the last change.
- **Role-Based Security**:
    - **Skeleton Injection**: Only the **Interviewee** can trigger code skeletons on language switch, preventing accidental overwrites by the interviewer.
- **Multi-Language Support**: JavaScript, Java, C++ with instant switching.
- **Judge0 Integration**: One-call multi-test harness to conserve API quota.
- **AI Assistance**: Google Gemini integration for generating problem descriptions, test cases, and private edge cases.
- **Authentication**: Secure Google OAuth via NextAuth.js.
- **Session Management**: Scheduled interviews, email invites, and auto-archiving.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React.
- **Editor**: `@monaco-editor/react` with custom decorators for cursor sync.
- **Auth**: `next-auth` (Google Provider).
- **Database**: PostgreSQL (via Prisma ORM).
- **Realtime**: Supabase Realtime Channels (Broadcast Mode).
- **Code Execution**: Judge0 (Server-to-Server).
- **AI**: Google Gemini API.

## Real-time Sync Architecture

IntervYou uses a robust "Last Write Wins" (LWW) strategy per language buffer, enhanced for pair programming:

1.  **Broadcasts**: Code changes are broadcast via Supabase channels as "patch" updates (only `{[lang]: code}`).
2.  **Concurrency**:
    -   Incoming updates are applied immediately unless the local user is typing.
    -   **Debounce**: If the local user has typed within the last 300ms, incoming remote updates are skipped to maintain typing flow.
3.  **Cursors**: Cursor positions (`lineNumber`, `column`) are broadcast on every change and rendered as colored carets.

## Prerequisites

- Node.js 18+
- PostgreSQL Database
- Google Cloud Project (for OAuth)
- Supabase Project (for Realtime)
- Judge0 API Access
- Google Gemini API Key

## Environment Variables (.env)

Create a `.env` file in the root directory:

```env
# Authentication (NextAuth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL="postgresql://user:password@host:port/dbname?schema=public"

# Realtime (Supabase)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key

# Public URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Judge0 (Code Execution)
JUDGE0_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_KEY=your-rapidapi-key

# AI (Gemini)
GEMINI_API_KEY=your-gemini-api-key

# Email (SMTP)
EMAIL=your-email@gmail.com
APP_PASSWORD=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
```

## Installation & Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Database Setup**:
    ```bash
    npx prisma generate
    npx prisma migrate dev
    ```

3.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Access the app at `http://localhost:3000`.

## Deployment (Vercel)

1.  Push your code to a Git repository.
2.  Import the project into Vercel.
3.  Add all Environment Variables in the Vercel Project Settings.
4.  **Build Command**: `prisma generate && next build`
5.  **Install Command**: `npm install`
6.  Deploy!

## License

Distributed under the MIT License. See `LICENSE` for more information.
