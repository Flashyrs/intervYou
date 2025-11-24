# IntervYou — Real‑time Technical Interview Platform

A Next.js (App Router) platform for conducting live technical interviews with collaborative coding, video, AI‑assisted test generation, and Judge0‑powered execution. Designed for interviewer/interviewee workflows, sample vs private test cases, and clean HackerRank‑style UX.

## Key Features
- **Live Interview Room**: Real-time video + shared code state (Monaco Editor).
- **Multi-Language Support**: JavaScript, Java, C++ with instant switching.
- **Judge0 Integration**: One‑call multi‑test harness to conserve API quota.
- **Test Cases**:
    - **Sample Tests**: Visible to the candidate.
    - **Private Tests**: Hidden (locked) from the candidate, only pass/fail results shown.
- **AI Assistance**: Google Gemini integration for generating problem descriptions, test cases, and language-specific driver code.
- **Authentication**: Secure Google OAuth via NextAuth.js.
- **Session Management**:
    - Scheduled interviews with email invites.
    - Automatic session expiration and archiving.
    - Email notifications for archived sessions.
- **Submissions**: Track attempts per problem with configurable limits (default: 2).
- **Persistence**: PostgreSQL database with Prisma ORM.

## Tech Stack
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React.
- **Editor**: `@monaco-editor/react` for the code editor.
- **Auth**: `next-auth` (Google Provider).
- **Database**: PostgreSQL (via Prisma ORM).
- **Realtime**: Supabase Realtime Channels for broadcasting code/cursor state.
- **Code Execution**: Judge0 (Server-to-Server).
- **AI**: Google Gemini API.
- **Email**: Nodemailer (SMTP).

## Directory Structure

```
intervyou/
├── app/                        # Next.js App Router
│   ├── api/                    # API Routes (Server-side logic)
│   │   ├── auth/               # NextAuth endpoints
│   │   ├── execute/            # Code execution (Judge0 proxy)
│   │   ├── interview/          # Session state management
│   │   ├── invite/             # Session creation & invites
│   │   ├── submissions/        # Submission tracking
│   │   └── tests/              # AI test generation
│   ├── dashboard/              # User dashboard (Submissions history)
│   ├── interview/[sessionId]/  # Main Interview Room UI
│   └── page.tsx                # Landing page
├── components/                 # Reusable UI Components
│   ├── interview/              # Interview-specific components (Editor, Video, etc.)
│   └── ui/                     # Generic UI elements (Buttons, Dialogs, etc.)
├── hooks/                      # Custom React Hooks
├── lib/                        # Shared Utilities & Business Logic
│   ├── auth.ts                 # Auth configuration
│   ├── db.ts                   # Prisma client instance
│   ├── email.ts                # Email sending logic
│   ├── judge0.ts               # Judge0 API client
│   ├── realtime.ts             # Supabase Realtime setup
│   └── sessionExpiration.ts    # Session lifecycle management
├── prisma/                     # Database Configuration
│   └── schema.prisma           # Database Schema
└── public/                     # Static Assets
```

## Database Schema (High-Level)

The application uses PostgreSQL with the following core models:

- **User**: Registered users (via Google).
- **InterviewSession**: Represents a single interview room.
    - Tracks `participants`, `status` (active/expired), `scheduledFor`.
    - Stores `participantJoinedAt` / `participantLeftAt` for attendance.
- **InterviewState**: Stores the *current* state of an active interview.
    - `code`, `language`, `problemText`, `sampleTests`, `driver`.
    - This is mutable and updates in real-time.
- **Submission**: Records a candidate's code submission.
    - Stores `code`, `language`, `results` (pass/fail per test), `passed` (boolean).
    - Linked to `User`, `Session`, and `Problem`.
- **ExecutionLog**: Audit log of code executions.

## One-Call Multi-Test Harness

To optimize for Judge0's rate limits and latency, we do **not** make separate API calls for each test case. Instead, we use a "Harness" approach:

1.  **Assembly**: When "Run Code" is clicked, the server combines:
    - The Candidate's Code (Function definition).
    - A "Driver" Code (Hidden logic that parses input/output).
    - All Test Cases (Sample + Private).
2.  **Execution**: This single combined file is sent to Judge0.
3.  **Parsing**: The driver runs all tests internally and prints a JSON string to `stdout`.
4.  **Result**: The server parses this JSON and returns structured results (Pass/Fail for each test case) to the frontend.

This ensures we only consume **1 execution credit** per run, regardless of how many test cases are checked.

## Prerequisites
- Node.js 18+
- PostgreSQL Database
- Google Cloud Project (for OAuth)
- Judge0 API Access (RapidAPI or Self-Hosted)
- Google Gemini API Key (Optional, for AI features)
- SMTP Server (e.g., Gmail) for emails

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

# Public URL (for invites)
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

# Submission Exemptions (Optional)
# Emails that bypass submission limits
EXEMPT_EMAIL1=admin@example.com
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

> **Note**: Ensure your database is accessible from Vercel (e.g., use Supabase, Neon, or a cloud-hosted Postgres).

## License
MIT
