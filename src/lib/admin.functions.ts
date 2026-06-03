import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { renderAndSendTemplate } from "./email.server";
import { getActiveSeasonYear, requireAdminUserId } from "./dinners.server";

function formatMeetingDate(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const adminSendDinnerReminder = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ meetingId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();

    const { data: meeting, error: mErr } = await supabaseAdmin
      .from("meetings")
      .select("id, date")
      .eq("id", data.meetingId)
      .single();
    if (mErr) throw new Error(mErr.message);

    const { data: signup, error: sErr } = await supabaseAdmin
      .from("sign_ups")
      .select(
        "id, dinner, parent:parents(id, name, email, unique_guid), student:students(id, name)",
      )
      .eq("meeting_id", data.meetingId)
      .is("cancelled_at", null)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!signup || !signup.parent || !signup.student) {
      throw new Error("No active sign-up for this meeting.");
    }

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("app_url")
      .eq("id", 1)
      .single();
    const link_url = `${settings?.app_url ?? ""}/parent/${signup.parent.unique_guid}`;

    await renderAndSendTemplate({
      key: "dinner_reminder",
      to: signup.parent.email,
      variables: {
        parent_name: signup.parent.name,
        student_name: signup.student.name,
        meeting_date: formatMeetingDate(meeting.date),
        dinner: signup.dinner || "a dinner",
        link_url,
      },
    });

    return { ok: true, sentTo: signup.parent.email };
  });



// ---------- Students (households) ----------
export const adminListStudents = createServerFn({ method: "POST" }).handler(
  async () => {
    await requireAdminUserId();
    const { data, error } = await supabaseAdmin
      .from("students")
      .select("id, name, dinners_required, created_at, parents(id, name, email, unique_guid)")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const adminCreateStudent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().min(1).max(255),
        dinners_required: z.number().int().min(0).max(50).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: row, error } = await supabaseAdmin
      .from("students")
      .insert({ name: data.name, dinners_required: data.dinners_required ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminUpdateStudent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        dinners_required: z.number().int().min(0).max(50).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const patch: { name?: string; dinners_required?: number | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.dinners_required !== undefined)
      patch.dinners_required = data.dinners_required;
    const { error } = await supabaseAdmin
      .from("students")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteStudent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Parents ----------
export const adminCreateParent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        student_id: z.string().uuid(),
        name: z.string().min(1).max(255),
        email: z.string().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: row, error } = await supabaseAdmin
      .from("parents")
      .insert(data)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminUpdateParent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        email: z.string().email().max(255).optional(),
        student_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("parents").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteParent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin.from("parents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminGetParentLink = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ parentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: p, error } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid")
      .eq("id", data.parentId)
      .single();
    if (error) throw new Error(error.message);
    return p;
  });

// ---------- Meetings ----------
export const adminCreateMeeting = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        notes: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const d = new Date(data.date + "T12:00:00Z");
    const m = d.getUTCMonth();
    const season_year = m >= 7 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    const { data: row, error } = await supabaseAdmin
      .from("meetings")
      .insert({ date: data.date, season_year, notes: data.notes ?? null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminDeleteMeeting = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin.from("meetings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateMeeting = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        notes: z.string().max(1000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("meetings")
      .update({ notes: data.notes && data.notes.trim() ? data.notes : null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteSignUp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ signUpId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("sign_ups")
      .delete()
      .eq("id", data.signUpId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCreateSignUp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        meeting_id: z.string().uuid(),
        parent_id: z.string().uuid(),
        dinner: z.string().trim().max(120).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: parent, error: pErr } = await supabaseAdmin
      .from("parents")
      .select("id, student_id")
      .eq("id", data.parent_id)
      .single();
    if (pErr) throw new Error(pErr.message);
    const { error } = await supabaseAdmin.from("sign_ups").insert({
      meeting_id: data.meeting_id,
      parent_id: parent.id,
      student_id: parent.student_id,
      dinner: data.dinner && data.dinner.length > 0 ? data.dinner : null,
    });
    if (error) {
      if (error.code === "23505") {
        throw new Error("This meeting is already signed up for. Remove the existing sign-up first.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- Season schedule generation ----------
function tuThuDatesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  if (e < s) return out;
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow === 2 || dow === 4) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const seasonRangeSchema = z
  .object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((v) => v.end >= v.start, { message: "End date must be on or after start date" });

export const adminPreviewSeasonSchedule = createServerFn({ method: "POST" })
  .inputValidator((input) => seasonRangeSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { start, end } = data;
    const candidates = tuThuDatesInRange(start, end);
    const { data: existing, error } = await supabaseAdmin
      .from("meetings")
      .select("date")
      .gte("date", start)
      .lte("date", end);
    if (error) throw new Error(error.message);
    const existingSet = new Set((existing ?? []).map((r) => r.date));
    const toCreate = candidates.filter((d) => !existingSet.has(d));
    return {
      total: candidates.length,
      skipped: candidates.length - toCreate.length,
      toCreate: toCreate.length,
    };
  });

export const adminGenerateSeasonSchedule = createServerFn({ method: "POST" })
  .inputValidator((input) => seasonRangeSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { start, end } = data;
    const candidates = tuThuDatesInRange(start, end);
    const { data: existing, error: exErr } = await supabaseAdmin
      .from("meetings")
      .select("date")
      .gte("date", start)
      .lte("date", end);
    if (exErr) throw new Error(exErr.message);
    const existingSet = new Set((existing ?? []).map((r) => r.date));
    const missing = candidates.filter((d) => !existingSet.has(d));
    if (missing.length === 0) return { created: 0, skipped: candidates.length };

    const startYear = new Date(start + "T12:00:00Z").getUTCFullYear();
    const startMonth = new Date(start + "T12:00:00Z").getUTCMonth();
    const seasonYear = startMonth >= 7 ? startYear : startYear - 1;

    const rows = missing.map((date) => ({
      date,
      season_year: seasonYear,
      notes: null,
    }));
    const { error } = await supabaseAdmin.from("meetings").insert(rows);
    if (error) throw new Error(error.message);
    return { created: missing.length, skipped: candidates.length - missing.length };
  });

// ---------- Settings ----------
export const adminUpdateSettings = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        default_dinners_required: z.number().int().min(0).max(50).optional(),
        buyout_price: z.number().min(0).max(10000).optional(),
        app_url: z.string().max(255).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("settings")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Buy-outs ----------
export const adminCreateBuyOut = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        student_id: z.string().uuid(),
        parent_id: z.string().uuid().optional(),
        dinners: z.number().int().min(1).max(50),
        season_year: z.number().int().min(2000).max(2100).optional(),
        approved: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdminUserId();

    let parentId = data.parent_id;
    if (!parentId) {
      const { data: p, error: pErr } = await supabaseAdmin
        .from("parents")
        .select("id")
        .eq("student_id", data.student_id)
        .order("created_at")
        .limit(1)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      if (!p) throw new Error("Student has no parent on file. Add a parent first.");
      parentId = p.id;
    }

    const { data: s, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("buyout_price")
      .eq("id", 1)
      .single();
    if (sErr) throw new Error(sErr.message);
    const amount = Number(s.buyout_price) * data.dinners;

    const season = data.season_year ?? (await getActiveSeasonYear());

    const approved = data.approved ?? true;
    const { error } = await supabaseAdmin.from("buy_outs").insert({
      student_id: data.student_id,
      parent_id: parentId,
      season_year: season,
      amount,
      dinners: data.dinners,
      approved,
      approved_by: approved ? adminId : null,
      approved_at: approved ? new Date().toISOString() : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminApproveBuyOut = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        buyOutId: z.string().uuid(),
        dinners: z.number().int().min(1).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdminUserId();
    const patch: {
      approved: boolean;
      approved_by: string;
      approved_at: string;
      dinners?: number;
      amount?: number;
    } = {
      approved: true,
      approved_by: adminId,
      approved_at: new Date().toISOString(),
    };
    if (data.dinners !== undefined) {
      const { data: s, error: sErr } = await supabaseAdmin
        .from("settings")
        .select("buyout_price")
        .eq("id", 1)
        .single();
      if (sErr) throw new Error(sErr.message);
      patch.dinners = data.dinners;
      patch.amount = Number(s.buyout_price) * data.dinners;
    }
    const { error } = await supabaseAdmin
      .from("buy_outs")
      .update(patch)
      .eq("id", data.buyOutId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateBuyOut = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        buyOutId: z.string().uuid(),
        dinners: z.number().int().min(1).max(50),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: s, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("buyout_price")
      .eq("id", 1)
      .single();
    if (sErr) throw new Error(sErr.message);
    const amount = Number(s.buyout_price) * data.dinners;
    const { error } = await supabaseAdmin
      .from("buy_outs")
      .update({ dinners: data.dinners, amount })
      .eq("id", data.buyOutId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRevokeBuyOut = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ buyOutId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("buy_outs")
      .update({ approved: false, approved_by: null, approved_at: null })
      .eq("id", data.buyOutId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteBuyOut = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ buyOutId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("buy_outs")
      .delete()
      .eq("id", data.buyOutId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminCancelSignUp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ signUpId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("sign_ups")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", data.signUpId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
