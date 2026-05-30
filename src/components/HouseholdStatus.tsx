import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getStatus,
  progressDetails,
  statusOrder,
  statusStyles,
  type HouseholdProgress,
} from "@/lib/household-status";

export type { HouseholdProgress };

export type Household = {
  id: string;
  name: string;
  dinners_required: number | null;
  progress: HouseholdProgress;
};

export function HouseholdStatus({ households }: { households: Household[] }) {
  const [sort, setSort] = useState<"status" | "name">("status");

  const sorted = [...households].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const sa = statusOrder[getStatus(a.progress)];
    const sb = statusOrder[getStatus(b.progress)];
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Student summary
          </h2>
          <p className="text-sm text-muted-foreground">
            Dinners provided so far this season.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          <Button
            size="sm"
            variant={sort === "status" ? "default" : "ghost"}
            onClick={() => setSort("status")}
            className="h-7 px-3 text-xs"
          >
            By status
          </Button>
          <Button
            size="sm"
            variant={sort === "name" ? "default" : "ghost"}
            onClick={() => setSort("name")}
            className="h-7 px-3 text-xs"
          >
            A–Z
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        {sorted.map((h) => {
          const status = getStatus(h.progress);
          const styles = statusStyles[status];
          return (
            <Card
              key={h.id}
              className={`flex items-center justify-between gap-3 rounded-xl p-4 ${styles.card}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {h.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {progressDetails(h.progress)}
                  </p>
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}
              >
                {styles.label}
              </span>
            </Card>
          );
        })}
        {sorted.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No households yet.
          </Card>
        )}
      </div>
    </section>
  );
}
