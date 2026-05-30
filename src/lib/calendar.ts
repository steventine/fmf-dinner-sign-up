export type MeetingRow = {
  meeting_id: string;
  date: string; // YYYY-MM-DD
  season_year: number;
  notes: string | null;
  student_id: string | null;
  household_name: string | null;
  dinner: string | null;
};

// Parse a YYYY-MM-DD as a local date (avoids UTC shift).
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Monday-based week start.
function weekStart(d: Date): Date {
  const day = d.getDay(); // 0=Sun
  const diff = (day + 6) % 7; // Mon=0
  const r = new Date(d);
  r.setDate(d.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function weekKey(dateStr: string): string {
  const ws = weekStart(parseLocalDate(dateStr));
  return ws.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStartIso: string): string {
  const start = parseLocalDate(weekStartIso);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const sameMonth = start.getMonth() === end.getMonth();
  const fmt: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = start.toLocaleDateString(undefined, fmt);
  const endStr = end.toLocaleDateString(
    undefined,
    sameMonth ? { day: "numeric" } : fmt,
  );
  return `Week of ${startStr} – ${endStr}`;
}

export function formatMeetingDate(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function groupByWeek(meetings: MeetingRow[]) {
  const map = new Map<string, MeetingRow[]>();
  for (const m of meetings) {
    const k = weekKey(m.date);
    const arr = map.get(k) ?? [];
    arr.push(m);
    map.set(k, arr);
  }
  return Array.from(map.entries())
    .map(([week, items]) => ({
      week,
      items: items.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

export function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isPast(dateStr: string): boolean {
  return dateStr < todayIso();
}
