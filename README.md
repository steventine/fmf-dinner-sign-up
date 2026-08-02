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
RESEND_WEBHOOK_SECRET=<signing secret from the Resend webhook endpoint — see "Resend webhook setup">
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

## Resend webhook setup (email delivery tracking)

> **Status: not yet configured.** The code and database are ready; the two steps below
> are pending. Until they're done, emails send normally but the admin "Recent sends"
> table shows only `sent`/`failed` with no delivered/bounced status.

The app exposes `POST /api/webhooks/resend`, which records delivery, bounce, and
complaint events from Resend onto each row in `email_send_log`. Bounced sends show up
as red badges (with the bounce reason on hover) in the admin **Emails → Recent sends**
table — this is how you spot bad parent email addresses.

### 1. Create the webhook endpoint in Resend

1. In the [Resend dashboard](https://resend.com), go to **Webhooks → Add endpoint**.
2. Set the endpoint URL to:
   ```
   https://<your-production-url>/api/webhooks/resend
   ```
3. Subscribe to at least these events:
   - `email.delivered`
   - `email.bounced`
   - `email.complained`
   - `email.delivery_delayed`

   (`email.opened` / `email.clicked` are harmlessly ignored if enabled.)
4. Copy the endpoint's **signing secret** (starts with `whsec_`).

### 2. Set the signing secret in Cloudflare

```bash
bunx wrangler secret put RESEND_WEBHOOK_SECRET
```

Paste the `whsec_…` value when prompted (or set it in the Cloudflare dashboard under
**Workers → Settings → Variables and Secrets**). Redeploy afterward.

For local testing, also put the same value in `.env` as `RESEND_WEBHOOK_SECRET`.
Requests with a missing or invalid signature are rejected, so the endpoint is safe to
expose publicly.

## Google OAuth setup

Admin sign-in supports Google OAuth via Supabase. This requires a one-time setup across Google Cloud and the Supabase dashboard.

### 1. Create a Google OAuth app

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Navigate to **APIs & Services → Credentials** and click **Create credentials → OAuth client ID**.
3. Set the application type to **Web application**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```
   (Replace `<project-ref>` with your Supabase project ref — the subdomain of your Supabase URL.)
5. Click **Create**. Note the **Client ID** and **Client Secret**.

### 2. Enable Google in Supabase

1. In the Supabase dashboard, go to **Authentication → Providers → Google**.
2. Toggle it **enabled**.
3. Paste in the **Client ID** and **Client Secret** from step 1.
4. Save.

### 3. Add redirect URLs

In the Supabase dashboard under **Authentication → URL Configuration → Redirect URLs**, add:

- `http://localhost:8080/**` (local dev)
- `https://<your-production-url>/**` (production)

After completing these steps, the **Continue with Google** button on the `/login` page will work.

## Changing the Site URL

When the app is deployed to a new URL (or when switching between local dev and production), update all of the following:

### 1. Supabase — Authentication → URL Configuration

In the Supabase dashboard for this project, under **Authentication → URL Configuration**:

- **Site URL** — set to the new root URL (e.g. `https://dinner.example.com`)
- **Redirect URLs** — add `<new-url>/**` to the allowlist (e.g. `https://dinner.example.com/**`)

Both matter for redirects. Supabase only honors the `redirectTo`/`emailRedirectTo` requested by the app (which is `window.location.origin`, see `src/routes/login.tsx`) if that URL matches the **Redirect URLs** allowlist. When it doesn't match, Supabase silently substitutes the **Site URL** instead. So if the allowlist is missing your current domain, both admin login (email/password and Google OAuth) and sign-up confirmation emails will bounce you back to the old URL even though the code is correct.

Example symptom: after moving to `https://fmf.tinefamily.com`, logging in as admin redirected back to the old `*.workers.dev` domain — fixed by setting the Site URL and adding `https://fmf.tinefamily.com/**` to the Redirect URLs.

For local dev, also add `http://localhost:8080/**` to the Redirect URLs list so verification emails work during development.

### 2. Admin Settings → App URL

In the app at `/admin/settings`, update the **App URL** field to the new root URL (no trailing slash).

This value is stored in the `settings` table and is used to build the parent sign-up links embedded in invitation and reminder emails. If it's wrong, parents will receive links pointing to the old URL.
