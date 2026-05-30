import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminGetOverview } from "@/lib/admin-read.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getStatus,
  progressDetails,
  statusOrder,
  statusStyles,
} from "@/lib/household-status";

export const Route = createFileRoute("/admin/overview")({
  component: AdminOverview,
});

function AdminOverview() {
  const get = useServerFn(adminGetOverview);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => get({}),
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [sort, setSort] = useState<"status" | "name">("status");

  if (isLoading)
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Loading…
      </Card>
    );
  const students = data?.students ?? [];

  const sorted = [...students].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const sa = statusOrder[getStatus(a.progress)];
    const sb = statusOrder[getStatus(b.progress)];
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Status overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Season {data?.season}. Click History for full detail.
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
        {sorted.map((s) => {
          const active = (s.sign_ups ?? []).filter((su) => !su.cancelled_at);
          const isOpen = openId === s.id;
          const status = getStatus(s.progress);
          const styles = statusStyles[status];
          return (
            <Card key={s.id} className={`rounded-xl p-4 ${styles.card}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
                    {s.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {progressDetails(s.progress)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles.badge}`}
                  >
                    {styles.label}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenId(isOpen ? null : s.id)}
                  >
                    {isOpen ? "Hide" : "History"}
                  </Button>
                </div>
              </div>
              {isOpen && (
                <div className="mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      Sign-ups
                    </div>
                    {active.length === 0 ? (
                      <div className="text-sm text-muted-foreground">None</div>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {active
                          .sort((a, b) =>
                            (a.meeting?.date ?? "").localeCompare(
                              b.meeting?.date ?? "",
                            ),
                          )
                          .map((su) => (
                            <li key={su.id}>
                              <span className="font-medium">
                                {su.meeting?.date}
                              </span>{" "}
                              — {su.parent?.name}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                      Buy-outs
                    </div>
                    {(s.buy_outs ?? []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">None</div>
                    ) : (
                      <ul className="space-y-1 text-sm">
                        {s.buy_outs!.map((b) => (
                          <li key={b.id}>
                            ${Number(b.amount).toFixed(2)} — {b.parent?.name} ·{" "}
                            {b.approved ? (
                              <span className="text-emerald-700">
                                approved{" "}
                                {b.approved_at &&
                                  new Date(b.approved_at).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-amber-700">pending</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
