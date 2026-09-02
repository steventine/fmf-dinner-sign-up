# Editable Email Templates

Move email templates out of code and into the database so admins can edit subject lines and HTML bodies from the admin UI. Set up the foundation for additional emails (dinner reminders, buy-out confirmations, etc.).

## What admins will see

A new **Admin → Emails** page that lists every email the app can send. Clicking one opens an editor with:

- Subject line field
- HTML body editor (textarea with a live preview pane)
- List of available variables for that template (e.g. `{{parent_name}}`, `{{link_url}}`)
- "Send test to me" button to fire the template at the logged-in admin's email
- Save button

The first template seeded will be the existing **Parent sign-in link** email. Future templates (dinner reminder, buy-out approved, etc.) just need a row inserted — no code change required to edit them.

## How variables work

Templates use simple `{{variable_name}}` placeholders. Each template declares which variables it supports. When the app sends an email, it passes a values map and the server replaces the placeholders. Unknown variables are left as-is so typos are visible.

## Plan

### 1. Database

Create `email_templates` table:

- `key` (text, unique) — stable identifier like `parent_link`, `dinner_reminder`
- `name` (text) — admin-facing label
- `description` (text) — what triggers this email
- `subject` (text)
- `html_body` (text)
- `available_variables` (text[]) — for the admin UI hints
- `updated_at`, `updated_by`

Admin-only RLS (read + update). No insert/delete from the app — templates are seeded via migration so the code can rely on specific keys existing.

Seed the `parent_link` template with the current HTML from `email.server.ts`.

### 2. Server-side rendering

Refactor `src/lib/email.server.ts`:

- New `renderAndSendTemplate({ key, to, variables })` that loads the row from the DB, substitutes `{{var}}` placeholders, and calls Resend.
- Keep `sendEmailViaResend` as the low-level helper.
- Remove the hardcoded `buildParentLinkEmail` and update `requestParentLink` in `public.functions.ts` to call `renderAndSendTemplate({ key: 'parent_link', ... })`.

### 3. Admin server functions (`src/lib/admin-emails.functions.ts`)

- `listEmailTemplates()` — admin-only, returns all rows
- `getEmailTemplate({ key })`
- `updateEmailTemplate({ key, subject, html_body })`
- `sendTestEmail({ key })` — renders with placeholder sample values and sends to the logged-in admin

### 4. Admin UI

- New route `src/routes/admin.emails.tsx` (list + edit in one screen, master/detail layout consistent with other admin pages)
- Add "Emails" tab to the admin nav in `src/routes/admin.tsx`
- HTML body: monospace textarea + iframe-based live preview with sample variable values substituted in

### 5. Wiring

- Update `requestParentLink` to use the new template loader
- Future emails (reminders, etc.) just need a new seed row + a call site

## Out of scope

- Rich text / WYSIWYG editor (raw HTML is fine for now; we can add one later)
- Scheduling/sending reminders automatically (that's a follow-up — this PR only sets up the template system)
- Versioning / template history
