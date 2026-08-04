# Classroom AMA

Live classroom Q&A hub. Students join via a session code or QR code, submit questions anonymously, and upvote. Instructors sign in, open a session, share the QR code, moderate questions, and mark them answered.

Questions are moderated with OpenAI before they appear for voting. Rejected submissions stay hidden from the room but the submitter gets feedback.

## Features

- Anonymous student join by code / QR
- Upvotes with per-device tokens (no student accounts)
- Instructor dashboard with realtime question updates
- OpenAI content moderation on submit
- Seed questions to kickstart each session
- Configurable instructor name, app title, and optional avatar via env

## Stack

- [TanStack Start](https://tanstack.com/start) + React 19 + Vite
- [Supabase](https://supabase.com) (Auth, Postgres, Realtime)
- OpenAI Moderation API
- Tailwind CSS 4

## Prerequisites

- Node.js 20+ and npm
- A [Supabase](https://supabase.com) project
- An [OpenAI](https://platform.openai.com) API key (for moderation)

## Setup

### 1. Clone and install

```sh
git clone <this-repository-url>
cd professor_ama
npm i
cp .env.sample .env
```

### 2. Create the database

In the Supabase SQL Editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql). That creates the AMA tables, RLS policies, triggers, and Realtime publication. No Supabase CLI link is required.

### 3. Configure Auth

In the Supabase dashboard, enable Email auth (or your preferred provider). Create an instructor account via the app’s `/auth` page or the Supabase Auth UI.

### 4. Environment variables

Fill in `.env` (see `.env.sample`):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server only — never expose to the client) |
| `OPENAI_API_KEY` | OpenAI key for moderation |
| `VITE_PROFESSOR_NAME` | Display name in the UI (default: `Professor`) |
| `VITE_AMA_TITLE` | App / default session title (default: `Classroom AMA`) |
| `VITE_PROFESSOR_AVATAR_URL` | Optional avatar URL or public path; empty = initials only |

Put a custom avatar in `public/` (for example `public/avatar.jpg`) and set `VITE_PROFESSOR_AVATAR_URL=/avatar.jpg`.

### 5. Run locally

```sh
npm run dev
```

The app serves at `http://127.0.0.1:8080` by default.

#### Optional local HTTPS (mkcert)

For trusted HTTPS on `localhost`:

```sh
mkdir -p certs && cd certs && mkcert localhost && cd ..
npm run dev
```

With certs present as `certs/localhost.pem` and `certs/localhost-key.pem`, Vite enables HTTPS at `https://localhost:8080`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite / TanStack Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## License

MIT — see [LICENSE.md](LICENSE.md).
