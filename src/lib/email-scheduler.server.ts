// Audience resolution, scheduled heartbeat, and shared send logic for the campaign manager.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderEmailHtml, renderTemplateString, sendEmailBatchViaResend } from "./email.server";
import { currentSeasonYear } from "./dinners.server";
import { formatBanquetDate, getActiveBanquet } from "./banquet.server";

type ParentRecipient = {
  id: string;
  name: string;
  email: string;
  unique_guid: string;
  dinners_remaining?: number;
};

// Reminder windows are computed on the team's local calendar, and sends are held
// until this local hour — otherwise the "days before" window opens at midnight
// and the hourly cron would email parents overnight.
const TEAM_TIMEZONE = "America/New_York";
const REMINDER_SEND_HOUR = 5;

// Today's date (YYYY-MM-DD) in the team's timezone. en-CA formats as YYYY-MM-DD.
function teamToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TIMEZONE }).format(new Date());
}

function teamHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TEAM_TIMEZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function resolveAudience(
  audienceType: string,
  parentId?: string,
): Promise<ParentRecipient[]> {
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

  if (audienceType === "banquet_no_rsvp" || audienceType === "banquet_attending") {
    const banquet = await getActiveBanquet();
    if (!banquet) return [];

    // Once the banquet has happened there is no one left to email — this also
    // silences any still-enabled scheduled campaigns targeting these audiences.
    if (banquet.date < teamToday()) return [];

    const { data: rsvps } = await supabaseAdmin
      .from("banquet_rsvps")
      .select("student_id, attending")
      .eq("banquet_id", banquet.id);

    const respondedStudents = new Set((rsvps ?? []).map((r) => r.student_id));
    const attendingStudents = new Set(
      (rsvps ?? []).filter((r) => r.attending).map((r) => r.student_id),
    );

    const { data: parents } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid, student_id")
      .order("name");

    return (parents ?? []).filter((p) =>
      audienceType === "banquet_no_rsvp"
        ? !respondedStudents.has(p.student_id)
        : attendingStudents.has(p.student_id),
    );
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

  // Banquet variables are available to every one-off template (empty when no banquet exists).
  const banquet = await getActiveBanquet();
  const banquetVariables: Record<string, string> = {
    banquet_date: banquet ? formatBanquetDate(banquet.date) : "",
    banquet_time: banquet?.time ?? "",
    banquet_location: banquet?.location ?? "",
    banquet_notes: banquet?.notes ?? "",
  };

  const emails = recipients.map((parent) => {
    const variables: Record<string, string> = {
      parent_name: parent.name,
      link_url: `${appUrl}/parent/${parent.unique_guid}`,
      ...banquetVariables,
      ...(parent.dinners_remaining !== undefined
        ? { dinners_remaining: String(parent.dinners_remaining) }
        : {}),
    };
    return {
      to: parent.email,
      subject: renderTemplateString(subject, variables),
      html: renderEmailHtml(markdownBody, variables),
    };
  });

  const results = await sendEmailBatchViaResend(emails);

  if (recipients.length > 0) {
    await supabaseAdmin.from("email_send_log").insert(
      recipients.map((parent, i) => ({
        template_key: templateKey,
        parent_id: parent.id,
        triggered_by: triggeredBy,
        status: results[i].status,
        error_message: results[i].errorMessage,
      })),
    );
  }

  const sent = results.filter((r) => r.status === "sent").length;
  return { sent, failed: results.length - sent };
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
  if (teamHour() < REMINDER_SEND_HOUR) return;

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

  const todayStr = teamToday();
  const cutoffStr = addDays(todayStr, tpl.reminder_days_before);

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
    .in(
      "meeting_id",
      upcomingMeetings.map((m) => m.id),
    )
    .is("cancelled_at", null)
    .is("reminded_at", null);

  if (!signUps?.length) return;

  const pending: { signUpId: string; parentId: string }[] = [];
  const emails: { to: string; subject: string; html: string }[] = [];

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

    pending.push({ signUpId: su.id, parentId: su.parent_id });
    emails.push({
      to: parent.email,
      subject: renderTemplateString(tpl.subject, variables),
      html: renderEmailHtml(tpl.markdown_body, variables),
    });
  }

  if (!pending.length) return;

  const results = await sendEmailBatchViaResend(emails);
  // Only stamp reminded_at on success so failed reminders retry on the next run.
  const sentSignUpIds = pending
    .filter((_, i) => results[i].status === "sent")
    .map((p) => p.signUpId);

  await supabaseAdmin.from("email_send_log").insert(
    pending.map((p, i) => ({
      template_key: "dinner_reminder",
      parent_id: p.parentId,
      triggered_by: "schedule",
      status: results[i].status,
      error_message: results[i].errorMessage,
    })),
  );

  if (sentSignUpIds.length > 0) {
    await supabaseAdmin
      .from("sign_ups")
      .update({ reminded_at: new Date().toISOString() })
      .in("id", sentSignUpIds);
  }
}

// Reminds attending households what they signed up to bring, X days before the banquet.
// Editing an RSVP clears reminded_at, so an updated reminder re-sends.
export async function runBanquetReminderHeartbeat(): Promise<void> {
  if (teamHour() < REMINDER_SEND_HOUR) return;

  const { data: tpl } = await supabaseAdmin
    .from("email_templates")
    .select("subject, markdown_body, reminder_days_before")
    .eq("key", "banquet_reminder")
    .single();

  if (!tpl?.reminder_days_before) return;

  const banquet = await getActiveBanquet();
  if (!banquet) return;

  const todayStr = teamToday();
  const cutoffStr = addDays(todayStr, tpl.reminder_days_before);
  if (banquet.date < todayStr || banquet.date > cutoffStr) return;

  const { data: rsvps } = await supabaseAdmin
    .from("banquet_rsvps")
    .select(
      "id, guest_count, parent_id, parents(name, email, unique_guid), banquet_item_signups(item_description, banquet_item_categories(name))",
    )
    .eq("banquet_id", banquet.id)
    .eq("attending", true)
    .is("reminded_at", null);

  if (!rsvps?.length) return;

  const { data: settings } = await supabaseAdmin
    .from("settings")
    .select("app_url")
    .eq("id", 1)
    .single();
  const appUrl = settings?.app_url ?? "";
  const banquetDate = formatBanquetDate(banquet.date);

  const pending: { rsvpId: string; parentId: string }[] = [];
  const emails: { to: string; subject: string; html: string }[] = [];

  for (const rsvp of rsvps) {
    const parent = Array.isArray(rsvp.parents) ? rsvp.parents[0] : rsvp.parents;
    if (!parent) continue;

    const items = (rsvp.banquet_item_signups ?? [])
      .map((s) => {
        const cat = Array.isArray(s.banquet_item_categories)
          ? s.banquet_item_categories[0]
          : s.banquet_item_categories;
        const name = cat?.name ?? "Item";
        return `- **${name}**${s.item_description ? ` — ${s.item_description}` : ""}`;
      })
      .join("\n");

    const variables: Record<string, string> = {
      parent_name: parent.name,
      banquet_date: banquetDate,
      banquet_time: banquet.time ?? "",
      banquet_location: banquet.location ?? "",
      banquet_notes: banquet.notes ?? "",
      guest_count: String(rsvp.guest_count),
      items,
      link_url: `${appUrl}/parent/${parent.unique_guid}`,
    };

    pending.push({ rsvpId: rsvp.id, parentId: rsvp.parent_id });
    emails.push({
      to: parent.email,
      subject: renderTemplateString(tpl.subject, variables),
      html: renderEmailHtml(tpl.markdown_body, variables),
    });
  }

  if (!pending.length) return;

  const results = await sendEmailBatchViaResend(emails);
  // Only stamp reminded_at on success so failed reminders retry on the next run.
  const sentRsvpIds = pending.filter((_, i) => results[i].status === "sent").map((p) => p.rsvpId);

  await supabaseAdmin.from("email_send_log").insert(
    pending.map((p, i) => ({
      template_key: "banquet_reminder",
      parent_id: p.parentId,
      triggered_by: "schedule",
      status: results[i].status,
      error_message: results[i].errorMessage,
    })),
  );

  if (sentRsvpIds.length > 0) {
    await supabaseAdmin
      .from("banquet_rsvps")
      .update({ reminded_at: new Date().toISOString() })
      .in("id", sentRsvpIds);
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
