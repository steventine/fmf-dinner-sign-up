import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { renderAndSendTemplate } from "./email.server";
import { getActiveSeasonYear, getHouseholdProgress } from "./dinners.server";

export const getPublicSchedule = createServerFn({ method: "GET" }).handler(
  async () => {
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

    const season = await getActiveSeasonYear();
    const households = await Promise.all(
      (students ?? []).map(async (s) => ({
        ...s,
        progress: await getHouseholdProgress(s.id, season),
      })),
    );

    return { meetings: meetings ?? [], households, season };
  },
);

export const requestParentLink = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    // Silent success regardless of result (no enumeration).
    const { data: parent } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid")
      .eq("email", data.email)
      .maybeSingle();

    if (parent) {
      const origin =
        getRequestHeader("origin") ||
        (getRequestHeader("host") ? `https://${getRequestHeader("host")}` : "");
      const url = `${origin}/parent/${parent.unique_guid}`;
      try {
        await renderAndSendTemplate({
          key: "parent_link",
          to: parent.email,
          variables: { parent_name: parent.name, link_url: url },
        });
      } catch (err) {
        console.error("Failed to send parent link email", err);
      }
    }
    return { ok: true };
  });
