import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminGetSettings, adminListBuyOuts } from "@/lib/admin-read.functions";
import {
  adminApproveBuyOut,
  adminCreateBuyOut,
  adminDeleteBuyOut,
  adminListStudents,
  adminRevokeBuyOut,
  adminUpdateBuyOut,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/buyouts")({
  component: AdminBuyOuts,
});

function AdminBuyOuts() {
  const qc = useQueryClient();
  const list = useServerFn(adminListBuyOuts);
  const listStudents = useServerFn(adminListStudents);
  const getSettings = useServerFn(adminGetSettings);
  const approve = useServerFn(adminApproveBuyOut);
  const revoke = useServerFn(adminRevokeBuyOut);
  const reject = useServerFn(adminDeleteBuyOut);
  const create = useServerFn(adminCreateBuyOut);
  const update = useServerFn(adminUpdateBuyOut);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-buyouts"],
    queryFn: () => list({}),
  });
  const { data: students } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => listStudents({}),
  });
  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getSettings({}),
  });
  const price = Number(settings?.buyout_price ?? 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-buyouts"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const ap = useMutation({
    mutationFn: ({ id, dinners }: { id: string; dinners?: number }) =>
      approve({ data: { buyOutId: id, dinners } }),
    onSuccess: () => {
      invalidate();
      toast.success("Approved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rv = useMutation({
    mutationFn: (id: string) => revoke({ data: { buyOutId: id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Revoked");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rj = useMutation({
    mutationFn: (id: string) => reject({ data: { buyOutId: id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Rejected");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const up = useMutation({
    mutationFn: ({ id, dinners }: { id: string; dinners: number }) =>
      update({ data: { buyOutId: id, dinners } }),
    onSuccess: () => {
      invalidate();
      toast.success("Updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [studentId, setStudentId] = useState("");
  const [newDinners, setNewDinners] = useState("1");
  const cr = useMutation({
    mutationFn: () =>
      create({
        data: {
          student_id: studentId,
          dinners: Math.max(1, parseInt(newDinners || "1", 10)),
          approved: true,
        },
      }),
    onSuccess: () => {
      invalidate();
      setStudentId("");
      setNewDinners("1");
      toast.success("Buy-out recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = data ?? [];
  const pending = rows.filter((r) => !r.approved);
  const approved = rows.filter((r) => r.approved);

  const newCount = Math.max(1, parseInt(newDinners || "1", 10));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buy-Outs</h1>
        <p className="text-sm text-muted-foreground">
          Approve requests, or enter a buy-out when a parent sends payment without submitting a
          request. Current price: ${price.toFixed(2)} per dinner.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-muted-foreground text-sm font-bold">
          Pending ({pending.length})<br />
          Approve requests when payment has been received from the family.
        </h2>
        {isLoading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
        ) : pending.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No pending requests.
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {pending.map((b) => (
              <PendingRow
                key={b.id}
                row={b}
                onApprove={(dinners) => ap.mutate({ id: b.id, dinners })}
                onReject={() => {
                  if (
                    confirm(`Reject buy-out request for ${b.student?.name}? This cannot be undone.`)
                  ) {
                    rj.mutate(b.id);
                  }
                }}
                disabled={ap.isPending || rj.isPending}
              />
            ))}
          </Card>
        )}
      </section>

      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-medium">
          If payment has been received from a family but no Pending Request is listed above, enter
          the Buy-Out here.
        </h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Student</label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                {(students ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground">Dinners</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={newDinners}
              onChange={(e) => setNewDinners(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground pb-2">
            = <strong>${(newCount * price).toFixed(2)}</strong>
          </div>
          <Button onClick={() => cr.mutate()} disabled={!studentId || cr.isPending}>
            Record &amp; approve
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Amount is computed from the configured buy-out price. Recorded buy-outs are attributed to
          the student's first parent on file and immediately approved.
        </p>
      </Card>

      <section className="space-y-2">
        <h2 className="text-sm text-muted-foreground font-bold">Approved ({approved.length})</h2>
        {approved.length > 0 && (
          <Card className="divide-y divide-border">
            {approved.map((b) => (
              <ApprovedRow
                key={b.id}
                row={b}
                onRevoke={() => rv.mutate(b.id)}
                onUpdate={(dinners) => up.mutate({ id: b.id, dinners })}
                busy={up.isPending || rv.isPending}
              />
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

type BuyOutRow = {
  id: string;
  amount: number;
  dinners: number;
  requested_at: string;
  approved_at: string | null;
  student: { name: string } | null;
  parent: { name: string } | null;
};

function PendingRow({
  row,
  onApprove,
  onReject,
  disabled,
}: {
  row: BuyOutRow;
  onApprove: (dinners: number) => void;
  onReject: () => void;
  disabled: boolean;
}) {
  const [dinners, setDinners] = useState(String(row.dinners));
  useEffect(() => setDinners(String(row.dinners)), [row.dinners]);
  const n = Math.max(1, parseInt(dinners || "1", 10));
  const changed = n !== row.dinners;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <div className="font-medium">{row.student?.name}</div>
        <div className="text-sm text-muted-foreground">
          Requested by {row.parent?.name} · {new Date(row.requested_at).toLocaleDateString()} ·{" "}
          {row.dinners} dinner{row.dinners === 1 ? "" : "s"} · ${Number(row.amount).toFixed(2)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Approve as</label>
        <Input
          type="number"
          min={1}
          max={50}
          value={dinners}
          onChange={(e) => setDinners(e.target.value)}
          className="w-20"
        />
        <Button size="sm" onClick={() => onApprove(changed ? n : row.dinners)} disabled={disabled}>
          Approve
        </Button>
        <Button size="sm" variant="outline" onClick={onReject} disabled={disabled}>
          Reject
        </Button>
      </div>
    </div>
  );
}

function ApprovedRow({
  row,
  onRevoke,
  onUpdate,
  busy,
}: {
  row: BuyOutRow;
  onRevoke: () => void;
  onUpdate: (dinners: number) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [dinners, setDinners] = useState(String(row.dinners));
  useEffect(() => setDinners(String(row.dinners)), [row.dinners]);
  const n = Math.max(1, parseInt(dinners || "1", 10));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
      <div>
        <div className="font-medium">{row.student?.name}</div>
        <div className="text-sm text-muted-foreground">
          {row.parent?.name} · approved{" "}
          {row.approved_at ? new Date(row.approved_at).toLocaleDateString() : "—"} · {row.dinners}{" "}
          dinner{row.dinners === 1 ? "" : "s"} · ${Number(row.amount).toFixed(2)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input
              type="number"
              min={1}
              max={50}
              value={dinners}
              onChange={(e) => setDinners(e.target.value)}
              className="w-20"
            />
            <Button
              size="sm"
              onClick={() => {
                onUpdate(n);
                setEditing(false);
              }}
              disabled={busy}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDinners(String(row.dinners));
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (
                  confirm(
                    `Revoke buy-out for ${row.student?.name}? It will be moved back to pending.`,
                  )
                ) {
                  onRevoke();
                }
              }}
            >
              Revoke
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
