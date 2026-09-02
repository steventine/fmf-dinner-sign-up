import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// Cloudflare redacts any run of 32+ hex digits from the request URL in invocation
// logs, so parent visits all show up as `GET /parent/REDACTED`. Our own console
// output isn't redacted — emit a short GUID prefix so visits are attributable in
// the log without leaving a usable sign-up link in it.
function logParentVisit(request: Request, url: URL): void {
  if (request.method !== "GET") return;
  const match = /^\/parent\/([0-9a-f]{8})[0-9a-f-]*(\/[a-z-]*)?$/i.exec(url.pathname);
  if (!match) return;
  const page = match[2]?.slice(1) || "index";
  console.log(JSON.stringify({ event: "parent_visit", guidPrefix: match[1], page }));
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      // Resend delivery webhooks are handled directly, outside the app router.
      const url = new URL(request.url);
      logParentVisit(request, url);

      if (url.pathname === "/api/webhooks/resend" && request.method === "POST") {
        const { handleResendWebhook } = await import("./lib/resend-webhook.server");
        return await handleResendWebhook(request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },

  async scheduled(_event: unknown, _env: unknown, _ctx: unknown) {
    try {
      const {
        runScheduledEmailHeartbeat,
        runMeetingReminderHeartbeat,
        runBanquetReminderHeartbeat,
        runDinnerFollowupHeartbeat,
      } = await import("./lib/email-scheduler.server");
      await Promise.all([
        runScheduledEmailHeartbeat(),
        runMeetingReminderHeartbeat(),
        runBanquetReminderHeartbeat(),
        runDinnerFollowupHeartbeat(),
      ]);
    } catch (error) {
      console.error("Scheduled heartbeat failed:", error);
    }
  },
};
