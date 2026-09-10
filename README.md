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

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `bun run dev`    | Start dev server with hot reload |
| `bun run build`  | Production build                 |
| `bun run lint`   | ESLint                           |
| `bun run format` | Prettier                         |

## Database migrations

Migrations live in `supabase/migrations/`. To apply new migrations after pulling changes:

```bash
supabase db push
```

To create a new migration file:

```bash
supabase migration new <description>
```

## Database backups

A GitHub Actions workflow (`.github/workflows/db-backup.yml`) dumps the database
every night at 07:15 UTC (~3:15am Eastern) and uploads one archive to S3. You can also
run it on demand from **Actions → Database backup → Run workflow**.

Each archive contains:

| File                          | Purpose                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------- |
| `public-schema-and-data.sql`  | `pg_dump` of the `public` schema — tables, views, functions, policies, grants, and all data. **This is the restore path.** |
| `auth-users-reference.sql`    | The `auth.users` / `auth.identities` rows, for reference only. Supabase manages the auth schema itself; you re-create logins rather than restoring these. |
| `row-counts.tsv`              | Per-table row counts, read back out of the dump itself rather than queried separately — so they describe the artifact you would actually restore. |
| `MANIFEST.TXT`                | Timestamp, the repo commit, and row counts — check this first when opening a backup. |

**Not covered:** Supabase Auth accounts (recreated by signing in again), and the
Cloudflare, Resend, and Google OAuth configuration — those are documented in the
sections below and rebuilt by hand.

If a nightly run fails, GitHub emails the repository owner. The Actions tab is the
place to confirm backups are still running.

Two things about scheduled workflows are worth knowing, because both fail quietly:
they only run from the **default branch**, so the workflow has to be merged to `master`
to do anything; and GitHub **disables scheduled workflows in a repository with no commit
activity for 60 days**, re-enabling them only when someone clicks the banner in the Actions
tab. During a quiet off-season, glance at the Actions tab occasionally.

### One-time setup

**1. Create the S3 bucket.** Block all public access, enable default encryption, and add
a lifecycle rule expiring objects under the `fmf-dinner-signup/` prefix after however long
you want to keep them. The whole database is well under a megabyte compressed, so keeping
a year of nightlies costs essentially nothing.

**2. Give the workflow write access to the bucket.** The preferred route is GitHub's OIDC,
which needs no long-lived keys. In IAM, add an identity provider of type **OpenID Connect**
with provider URL `https://token.actions.githubusercontent.com` and audience
`sts.amazonaws.com`, then create a role trusting it:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:steventine/fmf-dinner-sign-up:ref:refs/heads/master"
        }
      }
    }
  ]
}
```

Attach a permissions policy that only allows writing new objects — deliberately no
`GetObject`, so a compromised workflow cannot read back old backups:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Action": "s3:PutObject", "Resource": "arn:aws:s3:::<BUCKET>/fmf-dinner-signup/*" }
  ]
}
```

(If you would rather use an IAM user, skip the role and set `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` as secrets instead — the workflow accepts either.)

**3. Use the `postgres` database credential.** A dedicated read-only backup role would be
preferable, but it is not available on this project, and the reason is worth recording so
nobody retries it:

`pg_dump` sets `row_security = off` and **errors out** rather than dumping partial data if
the connecting role cannot bypass RLS — and this database has RLS on `settings`, `meetings`,
and `students`. So a backup role needs `BYPASSRLS`, and this project's `postgres` role is
`rolsuper = false` (it does have `BYPASSRLS` and `CREATEROLE`).

On PostgreSQL 14, that combination is not enough: both `create role … bypassrls` and
`alter role … bypassrls` fail with `must be superuser`, verified against a role configured
identically to this one. **This server is PostgreSQL 17.6, and PostgreSQL 16 changed
`CREATEROLE` so that such a role can grant attributes it already holds — so the read-only
role may in fact be possible here. Untested as of this writing.** Until someone confirms it
on 17, the workflow uses the `postgres` credential.

Because the `postgres` password is used nowhere else in this stack, rotating it in the
Supabase dashboard costs nothing but re-entering the secret in step 5 — worth doing if you
ever suspect exposure.

**4. Get the database connection string.** In the Supabase dashboard under
**Settings → Database → Connection string**, copy the **Session pooler** URI (port `5432`)
and substitute your database password. Use the session
pooler, not the direct connection (IPv6-only, which GitHub runners cannot reach) and not the
transaction pooler on port `6543` (which `pg_dump` cannot use).

**5. Add the repository secrets and variables** under **Settings → Secrets and variables → Actions**:

| Name                       | Kind     | Value                                                     |
| -------------------------- | -------- | --------------------------------------------------------- |
| `SUPABASE_DB_URL`          | Secret   | Session pooler URI from step 4                             |
| `AWS_BACKUP_ROLE_ARN`      | Secret   | The role ARN from step 2 (omit if using access keys)       |
| `BACKUP_GPG_PASSPHRASE`    | Secret   | Optional; see below                                        |
| `BACKUP_S3_BUCKET`         | Variable | The bucket name                                            |
| `BACKUP_S3_PREFIX`         | Variable | Optional; defaults to `fmf-dinner-signup`                  |
| `AWS_REGION`               | Variable | Optional; defaults to `us-east-1`                          |

**6. Run it once by hand** from the Actions tab and confirm the object lands in S3. The
run summary prints the row count for every table.

#### Optional: encrypt the archives

Backups contain parent names, email addresses, and the `unique_guid` values that act as
the credential for parent sign-up links. A private bucket with default encryption already
protects them at rest. If you want the archive encrypted before it ever leaves the runner,
set a `BACKUP_GPG_PASSPHRASE` secret — the workflow will then symmetrically encrypt with
AES-256 and upload a `.tar.gz.gpg`. **Store that passphrase somewhere you will still have
it when the database is gone**; without it the backups are unrecoverable.

### Restoring

```bash
BACKUP_S3_BUCKET=<bucket> ./scripts/fetch-backup.sh
```

That downloads the newest archive, decrypts it if needed, unpacks it under `./restore/`,
and prints the manifest. Set `BACKUP_FILE=<name>` to pull a specific older backup instead.

Then, to bring the app back up on a fresh Supabase project:

1. Create a new Supabase project and note its project ref, database password, and API keys.
2. Load the dump — it recreates every table, view, function, RLS policy, grant, and row:

   ```bash
   psql "<new-session-pooler-uri>" -v ON_ERROR_STOP=1 -f restore/<backup-name>/public-schema-and-data.sql
   ```

   The dump is generated with `--clean --if-exists`, so it drops each object before
   recreating it and can be replayed over a database that already has the schema. If
   `psql` halts on an error about the `public` schema itself already existing, that one
   statement is safe to skip — a Supabase project always ships with `public` in place.

3. Re-create admin access: sign up at `/login` with your email. The first authenticated
   user auto-claims admin (see **First admin user**). The restored `admin_email_allowlist`
   table and `auth-users-reference.sql` in the archive record who else had access.
4. Point the app at the new project — update `SUPABASE_URL` in `wrangler.jsonc` and in
   `.env`, set the new `SUPABASE_SERVICE_ROLE_KEY` and publishable key, and redeploy.
5. Redo the external configuration: **Changing the Site URL**, **Google OAuth setup**, and
   **Resend webhook setup** below.
6. Verify: the public calendar lists meetings, **Admin → Emails** loads the send log, and a
   parent sign-up page opens — grab a GUID to try with:

   ```bash
   psql "<new-session-pooler-uri>" -Atc "select unique_guid from public.parents limit 1"
   ```

Because the migrations in `supabase/migrations/` are in git, `supabase db push` against a
new project is an alternative way to rebuild the schema — but the dump is preferred, since
it is a snapshot of what production actually looked like rather than a replay.

### Manual JSON export

Separate from the nightly backup, `scripts/export-json.ts` dumps every table to JSON by
reading the live PostgREST API with the service role key from `.env`:

```bash
bun run backup:json
```

This is a convenience for inspecting or diffing data while the database is up — it is
deliberately **not** part of the workflow, because it authenticates with
`SUPABASE_SERVICE_ROLE_KEY` and keeping it in CI would mean storing that key in GitHub.
`pg_dump` already captures everything it does. It reads the live database, so it is no help
during an actual outage; to get JSON out of an archived backup, restore the dump first and
then query it:

```bash
psql "$DB_URL" -Atc "select json_agg(t) from public.parents t" > parents.json
```

## Deployment

The app targets **Cloudflare Workers** via the Wrangler config in `wrangler.jsonc`. The server entry point is `src/server.ts`.

The same environment variables from `.env` need to be set as secrets in your Cloudflare Workers environment.

## Resend webhook setup (email delivery tracking)

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
   - `email.failed`
   - `email.suppressed`

   (`email.opened` / `email.clicked` are harmlessly ignored if enabled. `email.sent`
   is redundant — the app already records that at send time. `email.scheduled` and
   `email.received` never fire here: scheduling runs on the Worker cron rather than
   Resend's `scheduled_at`, and no mail is received through Resend.)

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
