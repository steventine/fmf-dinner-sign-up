// Server-only Resend helper + DB-backed templates.
import { marked } from "marked";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function markdownToEmailHtml(markdown: string): string {
  const body = marked.parse(markdown) as string;
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;line-height:1.5">${body}</body></html>`;
}

export async function sendEmailViaResend(args: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: args.from ?? "FullMetal Falcons Dinners <dinners@fmf.tinefamily.com>",
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

// Replace {{var}} placeholders. Unknown placeholders are left untouched so typos are visible.
export function renderTemplateString(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) => {
    return Object.prototype.hasOwnProperty.call(variables, name)
      ? variables[name]
      : match;
  });
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
  const markdown = renderTemplateString(tpl.markdown_body, args.variables);
  const html = markdownToEmailHtml(markdown);

  return sendEmailViaResend({ to: args.to, subject, html });
}
