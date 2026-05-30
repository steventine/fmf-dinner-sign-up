// Server-only Resend helper (via Lovable connector gateway) + DB-backed templates.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

export async function sendEmailViaResend(args: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: args.from ?? "Falcons Dinners <dinners@fmf.tinefamily.com>",
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
    .select("subject, html_body")
    .eq("key", args.key)
    .maybeSingle();
  if (error) throw new Error(`Template lookup failed: ${error.message}`);
  if (!tpl) throw new Error(`Email template not found: ${args.key}`);

  const subject = renderTemplateString(tpl.subject, args.variables);
  const html = renderTemplateString(tpl.html_body, args.variables);

  return sendEmailViaResend({ to: args.to, subject, html });
}
