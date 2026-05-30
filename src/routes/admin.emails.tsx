import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListEmailTemplates,
  adminUpdateEmailTemplate,
  adminSendTestEmail,
} from "@/lib/admin-emails.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/emails")({
  component: AdminEmails,
});

// Sample values shown in the live preview. Keep in sync with admin-emails.functions.ts.
const SAMPLE_VARIABLES: Record<string, string> = {
  parent_name: "Sample Parent",
  link_url: "https://example.com/parent/sample-guid",
  meeting_date: "Tuesday, Dec 3",
  student_name: "Sample Student",
  dinner: "Lasagna",
};

function renderPreview(input: string): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(SAMPLE_VARIABLES, name)
      ? SAMPLE_VARIABLES[name]
      : match,
  );
}

function AdminEmails() {
  const qc = useQueryClient();
  const list = useServerFn(adminListEmailTemplates);
  const update = useServerFn(adminUpdateEmailTemplate);
  const sendTest = useServerFn(adminSendTestEmail);

  const { data: templates } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: () => list({}),
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (!templates || templates.length === 0) return;
    if (!selectedKey) setSelectedKey(templates[0].key);
  }, [templates, selectedKey]);

  const selected = useMemo(
    () => templates?.find((t) => t.key === selectedKey) ?? null,
    [templates, selectedKey],
  );

  useEffect(() => {
    if (!selected) return;
    setSubject(selected.subject);
    setHtmlBody(selected.html_body);
  }, [selected]);

  // Default the test recipient to the logged-in admin's email.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user?.email && !testEmail) {
        setTestEmail(data.user.email);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No template selected");
      return update({
        data: { key: selected.key, subject, html_body: htmlBody },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-email-templates"] });
      toast.success("Template saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error("No template selected");
      if (!testEmail) throw new Error("Enter a test email address");
      return sendTest({ data: { key: selected.key, to: testEmail } });
    },
    onSuccess: () => toast.success(`Test email sent to ${testEmail}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const previewSubject = useMemo(() => renderPreview(subject), [subject]);
  const previewHtml = useMemo(() => renderPreview(htmlBody), [htmlBody]);

  const isDirty =
    selected !== null &&
    (subject !== selected.subject || htmlBody !== selected.html_body);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email templates</h1>
        <p className="text-sm text-muted-foreground">
          Edit the emails the app sends. Use{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{{variable_name}}`}</code>{" "}
          placeholders — they're replaced when the email is sent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        <Card className="h-fit p-2">
          <ul className="space-y-1">
            {(templates ?? []).map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => setSelectedKey(t.key)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    selectedKey === t.key ? "bg-accent font-medium" : ""
                  }`}
                >
                  {t.name}
                </button>
              </li>
            ))}
            {(!templates || templates.length === 0) && (
              <li className="px-3 py-2 text-sm text-muted-foreground">
                No templates yet.
              </li>
            )}
          </ul>
        </Card>

        {selected ? (
          <div className="space-y-6">
            <Card className="space-y-4 p-6">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                {selected.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.description}
                  </p>
                )}
                {selected.available_variables?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selected.available_variables.map((v) => (
                      <Badge key={v} variant="secondary" className="font-mono text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="html">HTML body</Label>
                <Textarea
                  id="html"
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="min-h-[260px] font-mono text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button onClick={() => save.mutate()} disabled={!isDirty || save.isPending}>
                  {save.isPending ? "Saving…" : "Save template"}
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="w-56"
                  />
                  <Button
                    variant="outline"
                    onClick={() => test.mutate()}
                    disabled={test.isPending || !testEmail}
                  >
                    {test.isPending ? "Sending…" : "Send test"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="space-y-3 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Preview
                </h3>
                <span className="text-xs text-muted-foreground">
                  Sample values substituted
                </span>
              </div>
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <span className="text-xs text-muted-foreground">Subject:</span>{" "}
                <span className="font-medium">{previewSubject}</span>
              </div>
              <iframe
                title="Email preview"
                srcDoc={previewHtml}
                sandbox=""
                className="h-[420px] w-full rounded-md border border-border bg-white"
              />
            </Card>
          </div>
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            Select a template to edit.
          </Card>
        )}
      </div>
    </div>
  );
}
