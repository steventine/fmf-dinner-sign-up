import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveSeasonYear, getHouseholdProgress, getParentByGuid } from "./dinners.server";

const GuidSchema = z.string().uuid();

export const getParentContext = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ guid: GuidSchema }).parse(input))
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);

    // Everything below only depends on the parent row, so run it in parallel.
    // Progress needs the season, so those two stay chained inside the batch.
    const [
      { data: household, error: hhErr },
      { season, progress },
      { data: meetings, error: mErr },
      { data: mySignUps, error: suErr },
      { data: buyOuts, error: boErr },
      { data: settingsRow, error: setErr },
    ] = await Promise.all([
      supabaseAdmin
        .from("students")
        .select("id, name, dinners_required")
        .eq("id", parent.student_id)
        .single(),
      getActiveSeasonYear().then(async (season) => ({
        season,
        progress: await getHouseholdProgress(parent.student_id, season),
      })),
      supabaseAdmin
        .from("v_meeting_status")
        .select("meeting_id, date, season_year, notes, student_id, household_name, dinner")
        .order("date", { ascending: true }),
      supabaseAdmin
        .from("sign_ups")
        .select("id, meeting_id, parent_id, dinner, created_at, cancelled_at")
        .eq("student_id", parent.student_id)
        .is("cancelled_at", null),
      supabaseAdmin
        .from("buy_outs")
        .select("id, season_year, amount, dinners, requested_at, approved, approved_at")
        .eq("student_id", parent.student_id)
        .order("requested_at", { ascending: false }),
      supabaseAdmin.from("settings").select("buyout_price").eq("id", 1).single(),
    ]);
    if (hhErr) throw new Error(hhErr.message);
    if (mErr) throw new Error(mErr.message);
    if (suErr) throw new Error(suErr.message);
    if (boErr) throw new Error(boErr.message);
    if (setErr) throw new Error(setErr.message);

    return {
      parent: { id: parent.id, name: parent.name },
      household,
      season,
      progress,
      meetings: meetings ?? [],
      mySignUps: mySignUps ?? [],
      buyOuts: buyOuts ?? [],
      buyoutPrice: Number(settingsRow.buyout_price),
    };
  });

export const signUpForMeeting = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        guid: GuidSchema,
        meetingId: z.string().uuid(),
        dinner: z.string().trim().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const { error } = await supabaseAdmin.from("sign_ups").insert({
      meeting_id: data.meetingId,
      parent_id: parent.id,
      student_id: parent.student_id,
      dinner: data.dinner,
    });
    if (error) {
      // Unique-index violation = meeting already taken
      if (error.code === "23505") {
        throw new Error("This meeting is already taken by another household.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const cancelSignUp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ guid: GuidSchema, signUpId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("sign_ups")
      .select("id, parent_id, cancelled_at")
      .eq("id", data.signUpId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Sign-up not found");
    if (row.parent_id !== parent.id) {
      throw new Error("You can only cancel sign-ups you created.");
    }
    if (row.cancelled_at) return { ok: true };
    const { error } = await supabaseAdmin
      .from("sign_ups")
      .update({ cancelled_at: new Date().toISOString() })
      .eq("id", data.signUpId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const requestBuyOut = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ guid: GuidSchema, dinners: z.number().int().min(1).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const season = await getActiveSeasonYear();
    const { data: settings, error: sErr } = await supabaseAdmin
      .from("settings")
      .select("buyout_price")
      .eq("id", 1)
      .single();
    if (sErr) throw new Error(sErr.message);
    const amount = Number(settings.buyout_price) * data.dinners;
    const { error } = await supabaseAdmin.from("buy_outs").insert({
      student_id: parent.student_id,
      parent_id: parent.id,
      season_year: season,
      amount,
      dinners: data.dinners,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
