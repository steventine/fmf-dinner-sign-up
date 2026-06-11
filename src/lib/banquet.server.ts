// Server-only helpers for the end-of-year banquet.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveSeasonYear } from "./dinners.server";

export const DEFAULT_BANQUET_CATEGORIES = [
  { name: "Entree", description: "Please bring a meal that will feed 8-10 people", capacity: 12 },
  { name: "Sides", description: "Please bring a side that can feed 8-15 people", capacity: 4 },
  {
    name: "Desserts",
    description: "Please bring a dessert that will feed 5-10 people",
    capacity: 5,
  },
  { name: "Water", description: "Please bring 1 case of bottled water", capacity: 4 },
  {
    name: "Bottled or Canned Soft Drinks",
    description: "Bottled or canned items only",
    capacity: 4,
  },
];

export type BanquetRow = {
  id: string;
  season_year: number;
  date: string;
  time: string | null;
  location: string | null;
  notes: string | null;
};

export async function getActiveBanquet(): Promise<BanquetRow | null> {
  const season = await getActiveSeasonYear();
  const { data, error } = await supabaseAdmin
    .from("banquets")
    .select("id, season_year, date, time, location, notes")
    .eq("season_year", season)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getBanquetCategories(banquetId: string) {
  const { data, error } = await supabaseAdmin
    .from("banquet_item_categories")
    .select("id, name, description, capacity, sort_order")
    .eq("banquet_id", banquetId)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Claimed count per category for one banquet.
export async function getClaimedCounts(banquetId: string): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("banquet_item_signups")
    .select("category_id, banquet_item_categories!inner(banquet_id)")
    .eq("banquet_item_categories.banquet_id", banquetId);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

export async function getBanquetSummary(banquet: BanquetRow) {
  const [categories, counts, rsvps] = await Promise.all([
    getBanquetCategories(banquet.id),
    getClaimedCounts(banquet.id),
    supabaseAdmin
      .from("banquet_rsvps")
      .select("attending, guest_count")
      .eq("banquet_id", banquet.id)
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        return data ?? [];
      }),
  ]);

  const attending = rsvps.filter((r) => r.attending);
  return {
    date: banquet.date,
    time: banquet.time,
    location: banquet.location,
    notes: banquet.notes,
    totals: {
      rsvpHouseholds: attending.length,
      guests: attending.reduce((sum, r) => sum + r.guest_count, 0),
    },
    categories: categories.map((c) => ({
      name: c.name,
      description: c.description,
      capacity: c.capacity,
      claimed: counts.get(c.id) ?? 0,
    })),
  };
}

export function formatBanquetDate(rawDate: string): string {
  return new Date(rawDate + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
