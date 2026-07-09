import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminUserId } from "./dinners.server";
import { getRequestHeader } from "@tanstack/react-start/server";
import { sendTemplateToParentAndLog } from "./email.server";
import { EMPTY_PROGRESS, getActiveSeasonYear, getAllHouseholdProgress } from "./dinners.server";

export const adminIsAdmin = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const id = await requireAdminUserId();
    return { ok: true, userId: id };
  } catch {
    return { ok: false as const };
  }
});

// First-user bootstrap: if no admin exists, the calling authenticated user
// becomes the first admin. Safe — once one admin exists, this is a no-op.
export const adminClaimIfFirst = createServerFn({ method: "POST" }).handler(async () => {
  const authHeader = getRequestHeader("authorization");
  if (!authHeader) throw new Error("Unauthorized");
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");

  const { count, error: cErr } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin");
  if (cErr) throw new Error(cErr.message);
  if ((count ?? 0) > 0) return { claimed: false as const };

  const { error: insErr } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: data.user.id, role: "admin" });
  if (insErr) throw new Error(insErr.message);
  return { claimed: true as const };
});

export const adminListMeetings = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data: meetings, error } = await supabaseAdmin
    .from("meetings")
    .select("id, date, season_year, notes")
    .order("date");
  if (error) throw new Error(error.message);

  const { data: signups, error: sErr } = await supabaseAdmin
    .from("sign_ups")
    .select(
      "id, meeting_id, created_at, cancelled_at, student:students(id, name), parent:parents(id, name, email)",
    )
    .is("cancelled_at", null);
  if (sErr) throw new Error(sErr.message);

  const byMeeting = new Map<string, (typeof signups)[number]>();
  for (const s of signups ?? []) byMeeting.set(s.meeting_id, s);

  return (meetings ?? []).map((m) => ({
    ...m,
    signup: byMeeting.get(m.id) ?? null,
  }));
});

export const adminListBuyOuts = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data, error } = await supabaseAdmin
    .from("buy_outs")
    .select(
      "id, season_year, amount, dinners, approved, approved_at, requested_at, student:students(id, name), parent:parents(id, name, email)",
    )
    .order("requested_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminGetSettings = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data, error } = await supabaseAdmin.from("settings").select("*").eq("id", 1).single();
  if (error) throw new Error(error.message);
  return data;
});

export const adminGetOverview = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data: students, error } = await supabaseAdmin
    .from("students")
    .select(
      "id, name, dinners_required, parents(id, name, email), buy_outs(id, amount, approved, approved_at, requested_at, parent:parents(name)), sign_ups(id, created_at, cancelled_at, meeting:meetings(id, date), parent:parents(name))",
    )
    .order("name");
  if (error) throw new Error(error.message);

  const season = await getActiveSeasonYear();
  const progressByStudent = await getAllHouseholdProgress(season);
  const enriched = (students ?? []).map((s) => ({
    ...s,
    progress: progressByStudent.get(s.id) ?? EMPTY_PROGRESS,
  }));
  return { students: enriched, season };
});

export const adminResendParentLink = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ parentId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: p, error } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid")
      .eq("id", data.parentId)
      .single();
    if (error) throw new Error(error.message);
    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("app_url")
      .eq("id", 1)
      .single();
    const url = `${settings?.app_url ?? ""}/parent/${p.unique_guid}`;
    await sendTemplateToParentAndLog({
      key: "parent_link",
      to: p.email,
      parentId: p.id,
      triggeredBy: "admin",
      variables: { parent_name: p.name, link_url: url },
    });
    return { ok: true };
  });
