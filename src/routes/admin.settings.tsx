import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminGetSettings } from "@/lib/admin-read.functions";
import { adminUpdateSettings } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettings,
});

function AdminSettings() {
  const qc = useQueryClient();
  const get = useServerFn(adminGetSettings);
  const upd = useServerFn(adminUpdateSettings);

  const { data } = useQuery({ queryKey: ["admin-settings"], queryFn: () => get({}) });

  const [defReq, setDefReq] = useState("");
  const [price, setPrice] = useState("");
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    setDefReq(String(data.default_dinners_required));
    setPrice(String(data.buyout_price));
    setAppUrl(data.app_url ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      upd({
        data: {
          default_dinners_required: parseInt(defReq, 10),
          buyout_price: parseFloat(price),
          app_url: appUrl,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Defaults for the current season.</p>
      </div>

      <Card className="max-w-xl space-y-4 p-6">
        <div className="space-y-2">
          <Label htmlFor="dr">Default dinners required</Label>
          <Input id="dr" type="number" min={0} value={defReq} onChange={(e) => setDefReq(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp">Buy-out price (USD)</Label>
          <Input id="bp" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-url">App URL</Label>
          <Input id="app-url" type="url" placeholder="https://dinner.example.com" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} />
          <p className="text-xs text-muted-foreground">Used to build parent sign-up links in emails. No trailing slash.</p>
        </div>
        <div className="pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save settings</Button>
        </div>
      </Card>
    </div>
  );
}
