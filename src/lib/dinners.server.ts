// Server-only helpers for parent guid authentication and household logic.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ParentRow = {
  id: string;
  student_id: string;
  name: string;
  email: string;
  unique_guid: string;
};

export async function getParentByGuid(guid: string): Promise<ParentRow> {
  const { data, error } = await supabaseAdmin
    .from("parents")
    .select("id, student_id, name, email, unique_guid")
    .eq("unique_guid", guid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Invalid parent link");
  return data as ParentRow;
}

export function currentSeasonYear(today = new Date()): number {
  // School-year season: Aug–Dec belongs to year that started in August; Jan–Jul belongs to prior August.
  const y = today.getFullYear();
  const m = today.getMonth(); // 0-11
  return m >= 7 ? y : y - 1;
}

export async function getActiveSeasonYear(today = new Date()): Promise<number> {
  const todayIso = today.toISOString().slice(0, 10);
  const { data, error } = await supabaseAdmin
    .from("meetings")
    .select("season_year")
    .gte("date", todayIso)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.season_year ?? currentSeasonYear(today);
}

export async function getHouseholdProgress(studentId: string, season: number) {
  const { data, error } = await supabaseAdmin.rpc("household_progress", {
    _student_id: studentId,
    _season: season,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return {
    required: row?.required ?? 0,
    signed_up: row?.signed_up ?? 0,
    approved_buyouts: row?.approved_buyouts ?? 0,
    pending_buyouts: row?.pending_buyouts ?? 0,
    provided: row?.provided ?? 0,
  };
}

export async function requireAdminUserId(): Promise<string> {
  // Imported lazily to keep this file free of TanStack types.
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const authHeader = getRequestHeader("authorization");
  if (!authHeader) throw new Error("Unauthorized");
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: roleRow, error: roleErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (roleErr) throw new Error(roleErr.message);
  if (!roleRow) throw new Error("Forbidden: admin role required");
  return data.user.id;
}

