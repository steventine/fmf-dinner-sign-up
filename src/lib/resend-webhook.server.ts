// Resend delivery webhooks → email_send_log.delivery_status.
// Resend signs webhooks via Svix: the signature is HMAC-SHA256 over
// "<svix-id>.<svix-timestamp>.<body>" keyed with the base64 secret after "whsec_".
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const REPLAY_TOLERANCE_SECONDS = 300;

// Statuses that must not be overwritten by a later delivered/delayed event
// (webhook events can arrive out of order).
const TERMINAL_STATUSES = new Set(["bounced", "complained"]);

const STATUS_BY_EVENT: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  body: string,
): Promise<boolean> {
  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${svixId}.${svixTimestamp}.${body}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));

  // Header holds space-separated "v1,<base64>" entries (multiple during key rotation).
  return svixSignature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && !!sig && timingSafeEqual(sig, expected);
  });
}

type ResendWebhookEvent = {
  type?: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string };
    failed?: { reason?: string };
  };
};

export async function handleResendWebhook(request: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("RESEND_WEBHOOK_SECRET is not configured");
    return new Response("Webhook not configured", { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing signature headers", { status: 400 });
  }

  const ts = parseInt(svixTimestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > REPLAY_TOLERANCE_SECONDS) {
    return new Response("Timestamp outside tolerance", { status: 400 });
  }

  const body = await request.text();
  if (!(await verifySvixSignature(secret, svixId, svixTimestamp, svixSignature, body))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const status = STATUS_BY_EVENT[event.type ?? ""];
  const emailId = event.data?.email_id;
  // Unmapped event types (opened, clicked, sent, …) are acknowledged and ignored.
  if (!status || !emailId) return new Response("ignored", { status: 200 });

  const { data: row } = await supabaseAdmin
    .from("email_send_log")
    .select("id, delivery_status")
    .eq("resend_email_id", emailId)
    .maybeSingle();
  // Unknown email id (e.g. test sends from the Resend dashboard) — acknowledge.
  if (!row) return new Response("no matching send", { status: 200 });

  if (row.delivery_status && TERMINAL_STATUSES.has(row.delivery_status)) {
    return new Response("terminal status kept", { status: 200 });
  }

  const detail = event.data?.bounce?.message ?? event.data?.failed?.reason ?? null;
  const { error } = await supabaseAdmin
    .from("email_send_log")
    .update({
      delivery_status: status,
      delivery_detail: detail,
      delivery_updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);
  if (error) {
    console.error("Resend webhook: failed updating send log:", error.message);
    return new Response("update failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
