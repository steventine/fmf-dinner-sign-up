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
import { Textarea } from "@/components/ui/textarea";

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
  const [guidance, setGuidance] = useState("");
  const [guidanceShort, setGuidanceShort] = useState("");

  useEffect(() => {
    if (!data) return;
    setDefReq(String(data.default_dinners_required));
    setPrice(String(data.buyout_price));
    setAppUrl(data.app_url ?? "");
    setGuidance(data.dinner_guidance ?? "");
    setGuidanceShort(data.dinner_guidance_short ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      upd({
        data: {
          default_dinners_required: parseInt(defReq, 10),
          buyout_price: parseFloat(price),
          app_url: appUrl,
          dinner_guidance: guidance,
          dinner_guidance_short: guidanceShort,
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
          <Input
            id="dr"
            type="number"
            min={0}
            value={defReq}
            onChange={(e) => setDefReq(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bp">Buy-out price (USD)</Label>
          <Input
            id="bp"
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="app-url">App URL</Label>
          <Input
            id="app-url"
            type="url"
            placeholder="https://dinner.example.com"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used to build parent sign-up links in emails. No trailing slash.
          </p>
        </div>
        <div className="pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save settings
          </Button>
        </div>
      </Card>

      <Card className="max-w-3xl space-y-4 p-6">
        <div>
          <h2 className="font-semibold">What to bring</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Guidance shown to parents. Blank lines are preserved, so you can use paragraphs.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="guidance">Full text</Label>
          <Textarea
            id="guidance"
            rows={7}
            maxLength={4000}
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Heads the public calendar and the parent's own dinners tab.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="guidance-short">Short reminder (email only)</Label>
          <Textarea
            id="guidance-short"
            rows={3}
            maxLength={500}
            value={guidanceShort}
            onChange={(e) => setGuidanceShort(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Not shown anywhere on the site. Available to the dinner reminder email as{" "}
            <code className="rounded bg-muted px-1 py-0.5">{"{{dinner_guidance}}"}</code> — add that
            to the template on the Emails page to include it.
          </p>
        </div>
        <div className="pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save settings
          </Button>
        </div>
      </Card>
    </div>
  );
}
