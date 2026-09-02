import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTemplateToParentAndLog } from "./email.server";
import { EMPTY_PROGRESS, getActiveSeasonYear, getAllHouseholdProgress } from "./dinners.server";
import { getActiveBanquet, getBanquetSummary } from "./banquet.server";

export const getPublicSchedule = createServerFn({ method: "GET" }).handler(async () => {
  const { data: meetings, error } = await supabaseAdmin
    .from("v_meeting_status")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(error.message);

  const { data: students, error: stErr } = await supabaseAdmin
    .from("students")
    .select("id, name, dinners_required")
    .order("name");
  if (stErr) throw new Error(stErr.message);

  const season = getActiveSeasonYear();
  const progressByStudent = await getAllHouseholdProgress(season);
  const households = (students ?? []).map((s) => ({
    ...s,
    progress: progressByStudent.get(s.id) ?? EMPTY_PROGRESS,
  }));

  const activeBanquet = await getActiveBanquet();
  const banquet = activeBanquet ? await getBanquetSummary(activeBanquet) : null;

  const { data: settingsRow } = await supabaseAdmin
    .from("settings")
    .select("dinner_guidance")
    .eq("id", 1)
    .single();

  return {
    meetings: meetings ?? [],
    households,
    season,
    banquet,
    guidance: settingsRow?.dinner_guidance ?? "",
  };
});

export const requestParentLink = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email().max(255) }).parse(input))
  .handler(async ({ data }) => {
    // Silent success regardless of result (no enumeration).
    const { data: parent } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid")
      .eq("email", data.email)
      .maybeSingle();

    if (parent) {
      const { data: settings } = await supabaseAdmin
        .from("settings")
        .select("app_url")
        .eq("id", 1)
        .single();
      const url = `${settings?.app_url ?? ""}/parent/${parent.unique_guid}`;
      try {
        await sendTemplateToParentAndLog({
          key: "parent_link",
          to: parent.email,
          parentId: parent.id,
          triggeredBy: "parent",
          variables: { parent_name: parent.name, link_url: url },
        });
      } catch (err) {
        console.error("Failed to send parent link email", err);
      }
    }
    return { ok: true };
  });
