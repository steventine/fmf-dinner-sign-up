import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminUserId } from "./dinners.server";
import { renderAndSendTemplate } from "./email.server";
import {
  computeNextRunAt,
  resolveAudienceCount,
  sendToAudience,
} from "./email-scheduler.server";

const SAMPLE_VARIABLES: Record<string, string> = {
  parent_name: "Sample Parent",
  link_url: "https://example.com/parent/sample-guid",
  meeting_date: "Tuesday, Dec 3",
  student_name: "Sample Student",
  dinner: "Lasagna",
  dinners_remaining: "2",
};

export { SAMPLE_VARIABLES as emailSampleVariables };

export const adminListEmailTemplates = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select(
      "key, name, description, subject, markdown_body, available_variables, template_type, audience_type, schedule_enabled, schedule_cron, schedule_next_run_at, schedule_last_run_at, updated_at",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminListParents = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data, error } = await supabaseAdmin
    .from("parents")
    .select("id, name, email")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpdateEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(64),
        subject: z.string().min(1).max(500),
        markdown_body: z.string().min(1).max(50000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdminUserId();
    const vars = [
      ...new Set(
        [...data.markdown_body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]),
      ),
    ];
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({
        subject: data.subject,
        markdown_body: data.markdown_body,
        available_variables: vars,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCreateEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(200),
        description: z.string().max(500).default(""),
        subject: z.string().min(1).max(500),
        markdown_body: z.string().min(1).max(50000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdminUserId();
    const vars = [
      ...new Set(
        [...data.markdown_body.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]),
      ),
    ];
    const key = `one_off_${Date.now()}`;
    const { error } = await supabaseAdmin.from("email_templates").insert({
      key,
      name: data.name,
      description: data.description,
      subject: data.subject,
      markdown_body: data.markdown_body,
      available_variables: vars,
      template_type: "one_off",
      updated_by: adminId,
    });
    if (error) throw new Error(error.message);
    return { key };
  });

export const adminUpdateEmailTemplateInfo = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
        description: z.string().max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({ name: data.name, description: data.description, updated_at: new Date().toISOString(), updated_by: adminId })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ key: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: tpl } = await supabaseAdmin
      .from("email_templates")
      .select("template_type")
      .eq("key", data.key)
      .maybeSingle();
    if (!tpl || tpl.template_type !== "one_off") throw new Error("Cannot delete this template");
    const { error } = await supabaseAdmin
      .from("email_templates")
      .delete()
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateEmailSchedule = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1),
        enabled: z.boolean(),
        cron: z.string().max(100).optional(),
        audience_type: z.enum(["all_parents", "parents_below_quota"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const nextRunAt =
      data.enabled && data.cron ? computeNextRunAt(data.cron)?.toISOString() ?? null : null;
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({
        schedule_enabled: data.enabled,
        schedule_cron: data.cron ?? null,
        schedule_next_run_at: nextRunAt,
        audience_type: data.enabled ? (data.audience_type ?? null) : null,
      })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminResolveAudienceCount = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ audience_type: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const count = await resolveAudienceCount(data.audience_type);
    return { count };
  });

export const adminSendNow = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1),
        audience_type: z.enum(["all_parents", "parents_below_quota", "single_parent"]),
        parent_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: tpl } = await supabaseAdmin
      .from("email_templates")
      .select("subject, markdown_body")
      .eq("key", data.key)
      .maybeSingle();
    if (!tpl) throw new Error("Template not found");

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("app_url")
      .eq("id", 1)
      .single();

    const result = await sendToAudience({
      templateKey: data.key,
      audienceType: data.audience_type,
      subject: tpl.subject,
      markdownBody: tpl.markdown_body,
      appUrl: settings?.app_url ?? "",
      parentId: data.parent_id,
      triggeredBy: "admin",
    });
    return result;
  });

export const adminGetSendHistory = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ key: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: logs, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id, sent_at, triggered_by, status, error_message, parents(name, email)")
      .eq("template_key", data.key)
      .order("sent_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return logs ?? [];
  });

export const adminSendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(64),
        to: z.string().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    await renderAndSendTemplate({
      key: data.key,
      to: data.to,
      variables: SAMPLE_VARIABLES,
    });
    return { ok: true };
  });
