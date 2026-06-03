// Audience resolution, scheduled heartbeat, and shared send logic for the campaign manager.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { markdownToEmailHtml, renderTemplateString, sendEmailViaResend } from "./email.server";
import { currentSeasonYear } from "./dinners.server";

type ParentRecipient = {
  id: string;
  name: string;
  email: string;
  unique_guid: string;
  dinners_remaining?: number;
};

async function resolveAudience(audienceType: string, parentId?: string): Promise<ParentRecipient[]> {
  if (audienceType === "single_parent") {
    if (!parentId) return [];
    const { data } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid")
      .eq("id", parentId)
      .maybeSingle();
    return data ? [data] : [];
  }

  if (audienceType === "all_parents") {
    const { data } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid")
      .order("name");
    return data ?? [];
  }

  if (audienceType === "parents_below_quota") {
    const season = currentSeasonYear();
    const { data: students } = await supabaseAdmin.from("students").select("id");
    if (!students?.length) return [];

    const belowQuota = new Set<string>();
    const remainingMap = new Map<string, number>();

    await Promise.all(
      students.map(async (s) => {
        const { data: prog } = await supabaseAdmin.rpc("household_progress", {
          _student_id: s.id,
          _season: season,
        });
        const row = Array.isArray(prog) ? prog[0] : prog;
        if (row && row.provided < row.required) {
          belowQuota.add(s.id);
          remainingMap.set(s.id, row.required - row.provided);
        }
      }),
    );

    if (!belowQuota.size) return [];

    const { data: parents } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid, student_id")
      .in("student_id", [...belowQuota])
      .order("name");

    return (parents ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      unique_guid: p.unique_guid,
      dinners_remaining: remainingMap.get(p.student_id) ?? 0,
    }));
  }

  return [];
}

export async function resolveAudienceCount(audienceType: string): Promise<number> {
  const recipients = await resolveAudience(audienceType);
  return recipients.length;
}

export async function sendToAudience(args: {
  templateKey: string;
  audienceType: string;
  subject: string;
  markdownBody: string;
  appUrl: string;
  parentId?: string;
  triggeredBy: "admin" | "schedule";
}): Promise<{ sent: number; failed: number }> {
  const { templateKey, audienceType, subject, markdownBody, appUrl, parentId, triggeredBy } = args;
  const recipients = await resolveAudience(audienceType, parentId);

  let sent = 0;
  let failed = 0;

  for (const parent of recipients) {
    const variables: Record<string, string> = {
      parent_name: parent.name,
      link_url: `${appUrl}/parent/${parent.unique_guid}`,
      ...(parent.dinners_remaining !== undefined
        ? { dinners_remaining: String(parent.dinners_remaining) }
        : {}),
    };

    const resolvedSubject = renderTemplateString(subject, variables);
    const html = markdownToEmailHtml(renderTemplateString(markdownBody, variables));

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;

    try {
      await sendEmailViaResend({ to: parent.email, subject: resolvedSubject, html });
      sent++;
    } catch (e) {
      failed++;
      status = "failed";
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    await supabaseAdmin.from("email_send_log").insert({
      template_key: templateKey,
      parent_id: parent.id,
      triggered_by: triggeredBy,
      status,
      error_message: errorMessage,
    });
  }

  return { sent, failed };
}

// Parses our supported cron patterns (daily/weekly/monthly) to compute the next run time.
export function computeNextRunAt(cron: string, after: Date = new Date()): Date | null {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [, hour, dom, , dow] = parts;
    const h = parseInt(hour, 10);
    const next = new Date(after);
    next.setUTCSeconds(0, 0);
    next.setUTCMinutes(0);

    if (dow !== "*" && dom === "*") {
      // Weekly — advance to next matching weekday
      const target = parseInt(dow, 10);
      next.setUTCHours(h);
      let days = (target - next.getUTCDay() + 7) % 7;
      if (days === 0) days = 7;
      next.setUTCDate(next.getUTCDate() + days);
    } else if (dom !== "*") {
      // Monthly — advance to next matching day of month
      const target = parseInt(dom, 10);
      next.setUTCHours(h);
      next.setUTCDate(target);
      if (next <= after) {
        next.setUTCMonth(next.getUTCMonth() + 1);
        next.setUTCDate(target);
      }
    } else {
      // Daily
      next.setUTCHours(h);
      if (next <= after) next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  } catch {
    return new Date(after.getTime() + 24 * 60 * 60 * 1000);
  }
}

export async function runMeetingReminderHeartbeat(): Promise<void> {
  const { data: tpl } = await supabaseAdmin
    .from("email_templates")
    .select("subject, markdown_body, reminder_days_before")
    .eq("key", "dinner_reminder")
    .single();

  if (!tpl?.reminder_days_before) return;

  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("app_url")
    .eq("id", 1)
    .single();
  const appUrl = settings?.app_url ?? "";

  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + tpl.reminder_days_before);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Filter by date on meetings first, then look up unreminded sign_ups for those meetings.
  const { data: upcomingMeetings } = await supabaseAdmin
    .from("meetings")
    .select("id, date")
    .gte("date", todayStr)
    .lte("date", cutoffStr);

  if (!upcomingMeetings?.length) return;

  const meetingDateById = new Map(upcomingMeetings.map((m) => [m.id, m.date]));

  const { data: signUps } = await supabaseAdmin
    .from("sign_ups")
    .select("id, meeting_id, dinner, parent_id, parents(name, email, unique_guid), students(name)")
    .in("meeting_id", upcomingMeetings.map((m) => m.id))
    .is("cancelled_at", null)
    .is("reminded_at", null);

  if (!signUps?.length) return;

  for (const su of signUps) {
    const parent = Array.isArray(su.parents) ? su.parents[0] : su.parents;
    const student = Array.isArray(su.students) ? su.students[0] : su.students;
    if (!parent || !student) continue;

    const rawDate = meetingDateById.get(su.meeting_id);
    if (!rawDate) continue;
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

    const resolvedSubject = renderTemplateString(tpl.subject, variables);
    const html = markdownToEmailHtml(renderTemplateString(tpl.markdown_body, variables));

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;

    try {
      await sendEmailViaResend({ to: parent.email, subject: resolvedSubject, html });
    } catch (e) {
      status = "failed";
      errorMessage = e instanceof Error ? e.message : String(e);
    }

    await Promise.all([
      supabaseAdmin.from("email_send_log").insert({
        template_key: "dinner_reminder",
        parent_id: su.parent_id,
        triggered_by: "schedule",
        status,
        error_message: errorMessage,
      }),
      supabaseAdmin
        .from("sign_ups")
        .update({ reminded_at: new Date().toISOString() })
        .eq("id", su.id),
    ]);
  }
}

export async function runScheduledEmailHeartbeat(): Promise<void> {
  const now = new Date();

  const { data: due } = await supabaseAdmin
    .from("email_templates")
    .select("key, audience_type, subject, markdown_body, schedule_cron")
    .eq("template_type", "one_off")
    .eq("schedule_enabled", true)
    .lte("schedule_next_run_at", now.toISOString())
    .neq("audience_type", "single_parent");

  if (!due?.length) return;

  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("app_url")
    .eq("id", 1)
    .single();
  const appUrl = settings?.app_url ?? "";

  for (const tpl of due) {
    if (!tpl.audience_type || !tpl.schedule_cron) continue;
    try {
      await sendToAudience({
        templateKey: tpl.key,
        audienceType: tpl.audience_type,
        subject: tpl.subject,
        markdownBody: tpl.markdown_body,
        appUrl,
        triggeredBy: "schedule",
      });
    } catch (e) {
      console.error(`Heartbeat: failed sending template ${tpl.key}:`, e);
    }

    await supabaseAdmin
      .from("email_templates")
      .update({
        schedule_last_run_at: now.toISOString(),
        schedule_next_run_at: computeNextRunAt(tpl.schedule_cron, now)?.toISOString() ?? null,
      })
      .eq("key", tpl.key);
  }
}
