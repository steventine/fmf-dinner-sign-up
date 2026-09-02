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
  const season = getActiveSeasonYear();
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

export type ClaimedItem = { household: string; description: string | null };

// Claimed items per category for one banquet, with the claiming household's name.
export async function getClaimedItems(banquetId: string): Promise<Map<string, ClaimedItem[]>> {
  const { data, error } = await supabaseAdmin
    .from("banquet_item_signups")
    .select(
      "category_id, item_description, banquet_item_categories!inner(banquet_id), banquet_rsvps!inner(students(name))",
    )
    .eq("banquet_item_categories.banquet_id", banquetId);
  if (error) throw new Error(error.message);

  const items = new Map<string, ClaimedItem[]>();
  for (const row of data ?? []) {
    const rsvp = Array.isArray(row.banquet_rsvps) ? row.banquet_rsvps[0] : row.banquet_rsvps;
    const student = Array.isArray(rsvp?.students) ? rsvp?.students[0] : rsvp?.students;
    const list = items.get(row.category_id) ?? [];
    list.push({ household: student?.name ?? "A household", description: row.item_description });
    items.set(row.category_id, list);
  }
  return items;
}

export async function getBanquetSummary(banquet: BanquetRow) {
  const [categories, claimedItems, rsvps] = await Promise.all([
    getBanquetCategories(banquet.id),
    getClaimedItems(banquet.id),
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
      claimed: claimedItems.get(c.id)?.length ?? 0,
      items: claimedItems.get(c.id) ?? [],
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
