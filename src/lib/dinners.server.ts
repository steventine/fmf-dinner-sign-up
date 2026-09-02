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

// The season is an academic year, labeled by the calendar year it starts in:
// season 2026 runs 2026-07-01 through 2027-06-30. July is the boundary because
// meetings only ever run Sept–March, so cutting in the summer dead zone can
// never split a season in two.
const SEASON_START_MONTH = 7; // 1-based

// The single source of truth for "which season does this date belong to?".
// Every season_year written to the database must come from here — deriving it
// per batch, or reading it back off a neighbouring row, is how meetings ended
// up mislabeled before.
export function seasonYearForDate(date: string | Date): number {
  // "YYYY-MM-DD" is parsed by hand so a date-only string can't be shifted
  // across the boundary by the server's timezone.
  const [y, m] =
    typeof date === "string"
      ? [Number(date.slice(0, 4)), Number(date.slice(5, 7))]
      : [date.getFullYear(), date.getMonth() + 1];
  return m >= SEASON_START_MONTH ? y : y - 1;
}

export function getActiveSeasonYear(today = new Date()): number {
  return seasonYearForDate(today);
}

export type HouseholdProgress = {
  required: number;
  signed_up: number;
  approved_buyouts: number;
  pending_buyouts: number;
  provided: number;
};

export const EMPTY_PROGRESS: HouseholdProgress = {
  required: 0,
  signed_up: 0,
  approved_buyouts: 0,
  pending_buyouts: 0,
  provided: 0,
};

// Progress for every student in one set-based RPC — use this instead of calling
// getHouseholdProgress in a loop.
export async function getAllHouseholdProgress(
  season: number,
): Promise<Map<string, HouseholdProgress>> {
  const { data, error } = await supabaseAdmin.rpc("household_progress_all", {
    _season: season,
  });
  if (error) throw new Error(error.message);
  const map = new Map<string, HouseholdProgress>();
  for (const row of data ?? []) {
    map.set(row.student_id, {
      required: row.required ?? 0,
      signed_up: row.signed_up ?? 0,
      approved_buyouts: row.approved_buyouts ?? 0,
      pending_buyouts: row.pending_buyouts ?? 0,
      provided: row.provided ?? 0,
    });
  }
  return map;
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
