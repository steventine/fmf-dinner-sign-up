// Server-only Resend helper + DB-backed templates.
import { marked } from "marked";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function markdownToEmailHtml(markdown: string): string {
  const body = marked.parse(markdown) as string;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;line-height:1.5">${body}</body></html>`;
}

const DEFAULT_FROM = "FullMetal Falcons Dinners <dinners@fmf.tinefamily.com>";

// Resend returns { id } for single sends and { data: [{ id }] } for batches;
// we store the id on email_send_log so delivery webhooks can find the row.
export async function sendEmailViaResend(args: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<{ id?: string }> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: args.from ?? DEFAULT_FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend send failed [${res.status}]: ${body}`);
  }
  return res.json();
}

export type BatchEmail = { to: string; subject: string; html: string };
export type BatchSendResult = {
  status: "sent" | "failed";
  errorMessage: string | null;
  emailId: string | null;
};

// Resend's batch endpoint accepts up to 100 emails per request.
const RESEND_BATCH_LIMIT = 100;

// Sends many emails in chunks of 100 via Resend's batch endpoint — 1 subrequest
// per chunk instead of 1 per recipient, keeping bulk sends inside the Cloudflare
// Workers free-plan cap of 50 subrequests per invocation.
// Returns one result per input email, aligned by index. Batch requests are
// all-or-nothing on Resend's side, so a failed chunk marks all its emails failed.
export async function sendEmailBatchViaResend(emails: BatchEmail[]): Promise<BatchSendResult[]> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const results: BatchSendResult[] = [];
  for (let i = 0; i < emails.length; i += RESEND_BATCH_LIMIT) {
    const chunk = emails.slice(i, i + RESEND_BATCH_LIMIT);
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify(
          chunk.map((e) => ({ from: DEFAULT_FROM, to: [e.to], subject: e.subject, html: e.html })),
        ),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Resend batch send failed [${res.status}]: ${body}`);
      }
      const payload = (await res.json()) as { data?: { id?: string }[] };
      chunk.forEach((_, j) => {
        results.push({
          status: "sent",
          errorMessage: null,
          emailId: payload.data?.[j]?.id ?? null,
        });
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      for (const _ of chunk) results.push({ status: "failed", errorMessage, emailId: null });
    }
  }
  return results;
}

// Replace {{var}} placeholders. Unknown placeholders are left untouched so typos are visible.
export function renderTemplateString(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(variables, name) ? variables[name] : match;
  });
}

// Variable values include parent-entered text (dinner names, banquet item descriptions),
// and marked passes raw HTML through — so escape HTML before values reach the markdown
// body. Square brackets become entities too, which blocks markdown link/image injection
// while rendering as literal brackets. Deliberate markdown in values (e.g. the ** in the
// banquet items list) still works; entities pass through marked untouched.
function escapeTemplateValue(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\[/g, "&#91;")
    .replace(/\]/g, "&#93;");
}

// Render an email body: escape variable values, interpolate into the admin-authored
// markdown template (trusted, stays unescaped), then convert to HTML.
// Subjects are plain text — render those with renderTemplateString directly.
export function renderEmailHtml(
  markdownTemplate: string,
  variables: Record<string, string>,
): string {
  const escaped: Record<string, string> = {};
  for (const [name, value] of Object.entries(variables)) {
    escaped[name] = escapeTemplateValue(value);
  }
  return markdownToEmailHtml(renderTemplateString(markdownTemplate, escaped));
}

// Send a DB template to one parent and record the attempt in email_send_log
// (including Resend's email id, so delivery webhooks can update the row).
// Throws on send failure — after logging it — so callers that must not fail
// (e.g. best-effort sends) should wrap this in try/catch.
export async function sendTemplateToParentAndLog(args: {
  key: string;
  to: string;
  parentId: string;
  triggeredBy: string;
  variables: Record<string, string>;
}): Promise<void> {
  let status: "sent" | "failed" = "sent";
  let errorMessage: string | null = null;
  let emailId: string | null = null;

  try {
    const sent = await renderAndSendTemplate({
      key: args.key,
      to: args.to,
      variables: args.variables,
    });
    emailId = sent?.id ?? null;
  } catch (e) {
    status = "failed";
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  await supabaseAdmin.from("email_send_log").insert({
    template_key: args.key,
    parent_id: args.parentId,
    triggered_by: args.triggeredBy,
    status,
    error_message: errorMessage,
    resend_email_id: emailId,
  });

  if (status === "failed") throw new Error(errorMessage ?? "Email send failed");
}

export async function renderAndSendTemplate(args: {
  key: string;
  to: string;
  variables: Record<string, string>;
}) {
  const { data: tpl, error } = await supabaseAdmin
    .from("email_templates")
    .select("subject, markdown_body")
    .eq("key", args.key)
    .maybeSingle();
  if (error) throw new Error(`Template lookup failed: ${error.message}`);
  if (!tpl) throw new Error(`Email template not found: ${args.key}`);

  const subject = renderTemplateString(tpl.subject, args.variables);
  const html = renderEmailHtml(tpl.markdown_body, args.variables);

  return sendEmailViaResend({ to: args.to, subject, html });
}
