import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminAddInvite,
  adminListInvites,
  adminRemoveInvite,
} from "@/lib/admin-invites.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/invites")({
  component: AdminInvites,
});

function AdminInvites() {
  const qc = useQueryClient();
  const list = useServerFn(adminListInvites);
  const add = useServerFn(adminAddInvite);
  const remove = useServerFn(adminRemoveInvite);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => list({}),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-invites"] });

  const [email, setEmail] = useState("");
  const addMut = useMutation({
    mutationFn: () => add({ data: { email } }),
    onSuccess: () => { invalidate(); setEmail(""); toast.success("Invited"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const rmMut = useMutation({
    mutationFn: (e: string) => remove({ data: { email: e } }),
    onSuccess: () => { invalidate(); toast.success("Removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin invites</h1>
        <p className="text-sm text-muted-foreground">
          Only emails on this list can create an admin account (via Google or email/password).
        </p>
      </div>

      <Card className="p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => { e.preventDefault(); if (email) addMut.mutate(); }}
        >
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-muted-foreground">Email to invite</label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
            />
          </div>
          <Button type="submit" disabled={!email || addMut.isPending}>Invite</Button>
        </form>
      </Card>

      {isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : (data ?? []).length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">No invites yet.</Card>
      ) : (
        <Card className="divide-y divide-border">
          {(data ?? []).map((row) => (
            <div key={row.email} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{row.email}</div>
                <div className="text-xs text-muted-foreground">
                  Invited {new Date(row.created_at).toLocaleDateString()}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rmMut.mutate(row.email)}
                disabled={rmMut.isPending}
              >
                Remove
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
