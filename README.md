# FMF Dinner Sign-up

A web app for the FullMetal Falcons robotics team that manages a rotating dinner schedule. Parents sign up to provide meals at team meetings, track their progress toward seasonal dinner requirements, and request buy-outs when needed.

## What it does

- **Public calendar** — anyone can see upcoming meetings and which household is bringing dinner
- **Parent sign-up** — parents access their personal page via an emailed link (no password required) and sign up for meetings, cancel, or request a buy-out
- **Admin portal** — team admins manage meetings, students/households, buy-out approvals, season settings, and email templates

## Prerequisites

- [Bun](https://bun.sh) — install with `powershell -c "irm bun.sh/install.ps1 | iex"` on Windows
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`
- A [Supabase](https://supabase.com) project
- A [Resend](https://resend.com) account for sending email

## Local setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy the example below into a `.env` file at the project root. All values come from your Supabase project's **Settings → API** page.

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon/public key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>

VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/public key>
VITE_SUPABASE_PROJECT_ID=<project-ref>

RESEND_API_KEY=<your Resend API key>
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are the same values as their non-`VITE_` counterparts — Vite requires the prefix to expose them to browser code.

### 3. Initialize the database

Link the Supabase CLI to your project and push all migrations:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

### 4. Start the dev server

```bash
bun run dev
```

The app runs at **http://localhost:8080**.

### First admin user

The first user to sign in automatically receives the admin role. Sign in at `/login` with email/password or Google OAuth.

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Start dev server with hot reload |
| `bun run build` | Production build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier |

## Database migrations

Migrations live in `supabase/migrations/`. To apply new migrations after pulling changes:

```bash
supabase db push
```

To create a new migration file:

```bash
supabase migration new <description>
```

## Deployment

The app targets **Cloudflare Workers** via the Wrangler config in `wrangler.jsonc`. The server entry point is `src/server.ts`.

The same environment variables from `.env` need to be set as secrets in your Cloudflare Workers environment.
