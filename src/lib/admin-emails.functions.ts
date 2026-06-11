import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminUserId } from "./dinners.server";
import { renderAndSendTemplate, renderTemplateString } from "./email.server";
import { computeNextRunAt, resolveAudienceCount, sendToAudience } from "./email-scheduler.server";
import { formatBanquetDate, getActiveBanquet } from "./banquet.server";

const SAMPLE_VARIABLES: Record<string, string> = {
  parent_name: "Sample Parent",
  link_url: "https://example.com/parent/sample-guid",
  meeting_date: "Tuesday, Dec 3",
  student_name: "Sample Student",
  dinner: "Lasagna",
  dinners_remaining: "2",
  banquet_date: "Saturday, June 13",
  banquet_time: "6:00 PM",
  banquet_location: "Xavier High School cafeteria",
  banquet_notes: "Doors open at 5:30 for setup volunteers.",
  guest_count: "3",
  items: "- **Entree** — Lasagna\n- **Desserts** — Brownies",
};

export { SAMPLE_VARIABLES as emailSampleVariables };

export const adminListEmailTemplates = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select(
      "key, name, description, subject, markdown_body, available_variables, template_type, audience_type, schedule_enabled, schedule_cron, schedule_next_run_at, schedule_last_run_at, reminder_days_before, updated_at",
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
      .update({
        name: data.name,
        description: data.description,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      })
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
    const { error } = await supabaseAdmin.from("email_templates").delete().eq("key", data.key);
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
        audience_type: z
          .enum(["all_parents", "parents_below_quota", "banquet_no_rsvp", "banquet_attending"])
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const nextRunAt =
      data.enabled && data.cron ? (computeNextRunAt(data.cron)?.toISOString() ?? null) : null;
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
  .inputValidator((input) => z.object({ audience_type: z.string().min(1) }).parse(input))
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
        audience_type: z.enum([
          "all_parents",
          "parents_below_quota",
          "banquet_no_rsvp",
          "banquet_attending",
          "single_parent",
        ]),
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

export const adminUpdateReminderDays = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.enum(["dinner_reminder", "banquet_reminder"]),
        days: z.number().int().min(1).max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({ reminder_days_before: data.days })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminPreviewReminderHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ asOf: z.string().date() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();

    const { data: tpl } = await supabaseAdmin
      .from("email_templates")
      .select("subject, markdown_body, reminder_days_before")
      .eq("key", "dinner_reminder")
      .single();

    if (!tpl?.reminder_days_before) return { reminders: [], reason: "no_days_configured" as const };

    const today = new Date(data.asOf + "T12:00:00Z");
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + tpl.reminder_days_before);
    const todayStr = today.toISOString().slice(0, 10);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data: upcomingMeetings } = await supabaseAdmin
      .from("meetings")
      .select("id, date")
      .gte("date", todayStr)
      .lte("date", cutoffStr);

    if (!upcomingMeetings?.length) return { reminders: [], reason: "no_meetings" as const };

    const meetingDateById = new Map(upcomingMeetings.map((m) => [m.id, m.date]));

    const { data: signUps } = await supabaseAdmin
      .from("sign_ups")
      .select("id, meeting_id, dinner, parents(name, email, unique_guid), students(name)")
      .in(
        "meeting_id",
        upcomingMeetings.map((m) => m.id),
      )
      .is("cancelled_at", null)
      .is("reminded_at", null);

    if (!signUps?.length) return { reminders: [], reason: "none_pending" as const };

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("app_url")
      .eq("id", 1)
      .single();
    const appUrl = settings?.app_url ?? "";

    const reminders = signUps.flatMap((su) => {
      const parent = Array.isArray(su.parents) ? su.parents[0] : su.parents;
      const student = Array.isArray(su.students) ? su.students[0] : su.students;
      if (!parent || !student) return [];
      const rawDate = meetingDateById.get(su.meeting_id);
      if (!rawDate) return [];
      const meetingDate = new Date(rawDate + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      });
      const variables: Record<string, string> = {
        parent_name: parent.name,
        student_name: student.name,
        meeting_date: meetingDate,
        dinner: su.dinner ?? "",
        link_url: `${appUrl}/parent/${parent.unique_guid}`,
      };
      return [
        {
          parentName: parent.name,
          parentEmail: parent.email,
          meetingDate,
          dinner: su.dinner ?? "",
          subject: renderTemplateString(tpl.subject, variables),
        },
      ];
    });

    return { reminders, reason: null };
  });

export const adminPreviewBanquetReminderHeartbeat = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ asOf: z.string().date() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();

    const { data: tpl } = await supabaseAdmin
      .from("email_templates")
      .select("reminder_days_before")
      .eq("key", "banquet_reminder")
      .single();

    if (!tpl?.reminder_days_before) return { reminders: [], reason: "no_days_configured" as const };

    const banquet = await getActiveBanquet();
    if (!banquet) return { reminders: [], reason: "no_banquet" as const };

    const today = new Date(data.asOf + "T12:00:00Z");
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() + tpl.reminder_days_before);
    const todayStr = today.toISOString().slice(0, 10);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    if (banquet.date < todayStr || banquet.date > cutoffStr)
      return { reminders: [], reason: "not_in_window" as const };

    const { data: rsvps } = await supabaseAdmin
      .from("banquet_rsvps")
      .select(
        "guest_count, parents(name, email), banquet_item_signups(item_description, banquet_item_categories(name))",
      )
      .eq("banquet_id", banquet.id)
      .eq("attending", true)
      .is("reminded_at", null);

    if (!rsvps?.length) return { reminders: [], reason: "none_pending" as const };

    const banquetDate = formatBanquetDate(banquet.date);

    const reminders = rsvps.flatMap((rsvp) => {
      const parent = Array.isArray(rsvp.parents) ? rsvp.parents[0] : rsvp.parents;
      if (!parent) return [];
      const items = (rsvp.banquet_item_signups ?? [])
        .map((s) => {
          const cat = Array.isArray(s.banquet_item_categories)
            ? s.banquet_item_categories[0]
            : s.banquet_item_categories;
          const name = cat?.name ?? "Item";
          return s.item_description ? `${name} (${s.item_description})` : name;
        })
        .join(", ");
      return [
        {
          parentName: parent.name,
          parentEmail: parent.email,
          banquetDate,
          guestCount: rsvp.guest_count,
          items,
        },
      ];
    });

    return { reminders, reason: null };
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
