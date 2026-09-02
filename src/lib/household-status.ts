export type HouseholdProgress = {
  required: number;
  signed_up: number;
  approved_buyouts: number;
  pending_buyouts: number;
  provided: number;
};

export type Status = "fulfilled" | "pending" | "partial" | "none";

export function getStatus(p: HouseholdProgress): Status {
  // A household set to 0 dinners required (admins, staff) has nothing left to
  // do, so 0 >= 0 lands it in "fulfilled" like anyone else who is done.
  if (p.provided >= p.required) return "fulfilled";
  if (p.provided + p.pending_buyouts >= p.required && p.pending_buyouts > 0)
    return "pending";
  if (p.provided > 0) return "partial";
  return "none";
}

export const statusOrder: Record<Status, number> = {
  none: 0,
  partial: 1,
  pending: 2,
  fulfilled: 3,
};

export const statusStyles: Record<
  Status,
  { badge: string; card: string; label: string }
> = {
  fulfilled: {
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
    card: "bg-emerald-50 border-emerald-200",
    label: "Fulfilled",
  },
  pending: {
    badge: "bg-sky-100 text-sky-800 border-sky-200",
    card: "bg-sky-50 border-sky-200",
    label: "Pending approval",
  },
  partial: {
    badge: "bg-amber-100 text-amber-900 border-amber-200",
    card: "bg-amber-50 border-amber-200",
    label: "Partial",
  },
  none: {
    badge: "bg-rose-100 text-rose-800 border-rose-200",
    card: "bg-rose-50 border-rose-200",
    label: "Not started",
  },
};

export function progressDetails(p: HouseholdProgress): string {
  const base =
    `${p.provided} of ${p.required} provided · ` +
    `${p.signed_up} sign-up${p.signed_up === 1 ? "" : "s"} · ` +
    `${p.approved_buyouts} approved buy-out${p.approved_buyouts === 1 ? "" : "s"}`;
  return p.pending_buyouts > 0
    ? `${base} · ${p.pending_buyouts} pending buy-out${p.pending_buyouts === 1 ? "" : "s"}`
    : base;
}
