import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListEmailTemplates,
  adminListParents,
  adminUpdateEmailTemplate,
  adminUpdateEmailTemplateInfo,
  adminCreateEmailTemplate,
  adminDeleteEmailTemplate,
  adminUpdateEmailSchedule,
  adminResolveAudienceCount,
  adminSendNow,
  adminGetSendHistory,
  adminSendTestEmail,
  emailSampleVariables,
} from "@/lib/admin-emails.functions";
import { EmailTemplateEditor } from "@/components/EmailTemplateEditor";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/emails")({
  component: AdminEmails,
});

type Template = Awaited<ReturnType<typeof adminListEmailTemplates>>[number];

// Variables the campaign audience resolver always provides for one-off sends.
// dinners_remaining is only populated for the parents_below_quota audience but is always listed.
const ONE_OFF_VARIABLES = ["parent_name", "link_url", "dinners_remaining"];

const AUDIENCE_LABELS: Record<string, string> = {
  all_parents: "All parents",
  parents_below_quota: "Parents below dinner quota",
  single_parent: "Single parent (on-demand only)",
};

const DOW_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function buildCron(freq: string, dow: number, dom: number): string {
  if (freq === "weekly") return `0 9 * * ${dow}`;
  if (freq === "monthly") return `0 9 ${dom} * *`;
  return "0 9 * * *";
}

function parseCron(cron: string): { freq: string; dow: number; dom: number } {
  const parts = cron.split(/\s+/);
  if (parts.length !== 5) return { freq: "monthly", dow: 1, dom: 1 };
  const [, , dom, , dow] = parts;
  if (dow !== "*") return { freq: "weekly", dow: parseInt(dow), dom: 1 };
  if (dom !== "*") return { freq: "monthly", dow: 1, dom: parseInt(dom) };
  return { freq: "daily", dow: 1, dom: 1 };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

// ─── New template form ───────────────────────────────────────────────────────

function NewTemplateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (key: string) => void;
}) {
  const create = useServerFn(adminCreateEmailTemplate);
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [markdownBody, setMarkdownBody] = useState("");

  const save = useMutation({
    mutationFn: () =>
      create({ data: { name, description, subject, markdown_body: markdownBody } }),
    onSuccess: ({ key }) => {
      qc.invalidateQueries({ queryKey: ["admin-email-templates"] });
      toast.success("Template created");
      onCreated(key);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-lg font-semibold">New one-off template</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="new-name">Name</Label>
          <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Season welcome" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-desc">Description (optional)</Label>
          <Input id="new-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <EmailTemplateEditor
        subject={subject}
        onSubjectChange={setSubject}
        markdownBody={markdownBody}
        onMarkdownBodyChange={setMarkdownBody}
        availableVariables={ONE_OFF_VARIABLES}
        sampleVariables={emailSampleVariables}
      />

      <div className="flex gap-3">
        <Button
          onClick={() => save.mutate()}
          disabled={!name || !subject || !markdownBody || save.isPending}
        >
          {save.isPending ? "Creating…" : "Create template"}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </Card>
  );
}

// ─── Transactional editor ────────────────────────────────────────────────────

function TransactionalEditor({ template }: { template: Template }) {
  const update = useServerFn(adminUpdateEmailTemplate);
  const sendTest = useServerFn(adminSendTestEmail);
  const qc = useQueryClient();

  const [subject, setSubject] = useState(template.subject);
  const [markdownBody, setMarkdownBody] = useState(template.markdown_body);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    setSubject(template.subject);
    setMarkdownBody(template.markdown_body);
  }, [template.key]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user?.email && !testEmail) setTestEmail(data.user.email);
    });
    return () => { cancelled = true; };
  }, []);

  const isDirty = subject !== template.subject || markdownBody !== template.markdown_body;

  const save = useMutation({
    mutationFn: () => update({ data: { key: template.key, subject, markdown_body: markdownBody } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-email-templates"] }); toast.success("Template saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: () => sendTest({ data: { key: template.key, to: testEmail } }),
    onSuccess: () => toast.success(`Test sent to ${testEmail}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">{template.name}</h2>
        {template.description && (
          <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
        )}
        <Badge variant="outline" className="mt-2 text-xs">Transactional</Badge>
      </div>

      <EmailTemplateEditor
        subject={subject}
        onSubjectChange={setSubject}
        markdownBody={markdownBody}
        onMarkdownBodyChange={setMarkdownBody}
        availableVariables={template.available_variables}
        sampleVariables={emailSampleVariables}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={!isDirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Input type="email" placeholder="you@example.com" value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)} className="w-52" />
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !testEmail}>
            {test.isPending ? "Sending…" : "Send test"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── One-off editor ──────────────────────────────────────────────────────────

function OneOffEditor({ template, onDeleted }: { template: Template; onDeleted: () => void }) {
  const update = useServerFn(adminUpdateEmailTemplate);
  const updateInfo = useServerFn(adminUpdateEmailTemplateInfo);
  const deleteTemplate = useServerFn(adminDeleteEmailTemplate);
  const updateSchedule = useServerFn(adminUpdateEmailSchedule);
  const resolveCount = useServerFn(adminResolveAudienceCount);
  const sendNow = useServerFn(adminSendNow);
  const getHistory = useServerFn(adminGetSendHistory);
  const listParents = useServerFn(adminListParents);
  const qc = useQueryClient();

  const [subject, setSubject] = useState(template.subject);
  const [markdownBody, setMarkdownBody] = useState(template.markdown_body);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const [editDescription, setEditDescription] = useState(template.description);

  const [scheduleEnabled, setScheduleEnabled] = useState(template.schedule_enabled);
  const [scheduleFreq, setScheduleFreq] = useState("monthly");
  const [scheduleDow, setScheduleDow] = useState(1);
  const [scheduleDom, setScheduleDom] = useState(1);
  const [scheduleAudience, setScheduleAudience] = useState(template.audience_type ?? "all_parents");
  const [sendAudience, setSendAudience] = useState("all_parents");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCount, setConfirmCount] = useState<number | null>(null);
  const [selectedParentId, setSelectedParentId] = useState("");

  useEffect(() => {
    setSubject(template.subject);
    setMarkdownBody(template.markdown_body);
    setIsEditingMeta(false);
    setEditName(template.name);
    setEditDescription(template.description);
    setScheduleEnabled(template.schedule_enabled);
    setScheduleAudience(template.audience_type ?? "all_parents");
    if (template.schedule_cron) {
      const { freq, dow, dom } = parseCron(template.schedule_cron);
      setScheduleFreq(freq);
      setScheduleDow(dow);
      setScheduleDom(dom);
    }
    setSendAudience("all_parents");
    setSelectedParentId("");
  }, [template.key]);

  const { data: history } = useQuery({
    queryKey: ["email-send-history", template.key],
    queryFn: () => getHistory({ data: { key: template.key } }),
  });

  const { data: parents } = useQuery({
    queryKey: ["admin-parents"],
    queryFn: () => listParents({}),
    enabled: sendAudience === "single_parent",
  });

  const saveInfo = useMutation({
    mutationFn: () => updateInfo({ data: { key: template.key, name: editName, description: editDescription } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-email-templates"] }); toast.success("Saved"); setIsEditingMeta(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const currentCron = buildCron(scheduleFreq, scheduleDow, scheduleDom);
  const isDirty = subject !== template.subject || markdownBody !== template.markdown_body;
  const isScheduleDirty =
    scheduleEnabled !== template.schedule_enabled ||
    (scheduleEnabled &&
      (currentCron !== template.schedule_cron || scheduleAudience !== (template.audience_type ?? "")));

  const save = useMutation({
    mutationFn: () => update({ data: { key: template.key, subject, markdown_body: markdownBody } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-email-templates"] }); toast.success("Template saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSchedule = useMutation({
    mutationFn: () =>
      updateSchedule({
        data: {
          key: template.key,
          enabled: scheduleEnabled,
          cron: scheduleEnabled ? currentCron : undefined,
          audience_type: scheduleEnabled ? (scheduleAudience as "all_parents" | "parents_below_quota") : undefined,
        },
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-email-templates"] }); toast.success("Schedule saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteTemplate({ data: { key: template.key } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-email-templates"] }); toast.success("Template deleted"); onDeleted(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSendClick = async () => {
    if (sendAudience === "single_parent") {
      setConfirmCount(selectedParentId ? 1 : 0);
    } else {
      try {
        const { count } = await resolveCount({ data: { audience_type: sendAudience } });
        setConfirmCount(count);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to count recipients");
        return;
      }
    }
    setShowConfirm(true);
  };

  const send = useMutation({
    mutationFn: () =>
      sendNow({
        data: {
          key: template.key,
          audience_type: sendAudience as "all_parents" | "parents_below_quota" | "single_parent",
          parent_id: sendAudience === "single_parent" ? selectedParentId : undefined,
        },
      }),
    onSuccess: ({ sent, failed }) => {
      qc.invalidateQueries({ queryKey: ["email-send-history", template.key] });
      toast.success(`Sent ${sent}${failed ? `, ${failed} failed` : ""}`);
      setShowConfirm(false);
    },
    onError: (e: Error) => { toast.error(e.message); setShowConfirm(false); },
  });

  const canSend = sendAudience !== "single_parent" || !!selectedParentId;

  return (
    <>
      <div className="space-y-4">
        <Card className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-3">
            {isEditingMeta ? (
              <div className="flex-1 space-y-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-lg font-semibold"
                  placeholder="Template name"
                  autoFocus
                />
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveInfo.mutate()} disabled={!editName || saveInfo.isPending}>
                    {saveInfo.isPending ? "Saving…" : "Save"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setIsEditingMeta(false); setEditName(template.name); setEditDescription(template.description); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <div>
                  <h2 className="text-lg font-semibold">{template.name}</h2>
                  {template.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                  )}
                  <Badge variant="secondary" className="mt-2 text-xs">One-off</Badge>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingMeta(true)}
                  className="mt-0.5 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => del.mutate()}
              disabled={del.isPending}
            >
              Delete
            </Button>
          </div>

          <EmailTemplateEditor
            subject={subject}
            onSubjectChange={setSubject}
            markdownBody={markdownBody}
            onMarkdownBodyChange={setMarkdownBody}
            availableVariables={ONE_OFF_VARIABLES}
            sampleVariables={emailSampleVariables}
          />

          <Button onClick={() => save.mutate()} disabled={!isDirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save template"}
          </Button>
        </Card>

        {/* Schedule */}
        <Card className="space-y-4 p-6">
          <h3 className="font-semibold">Schedule</h3>

          <div className="flex items-center gap-3">
            <Switch
              id="sched-enabled"
              checked={scheduleEnabled}
              onCheckedChange={setScheduleEnabled}
            />
            <Label htmlFor="sched-enabled">Send on a recurring schedule</Label>
          </div>

          {scheduleEnabled && (
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label>Audience</Label>
                <Select value={scheduleAudience} onValueChange={setScheduleAudience}>
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_parents">{AUDIENCE_LABELS.all_parents}</SelectItem>
                    <SelectItem value="parents_below_quota">{AUDIENCE_LABELS.parents_below_quota}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Frequency</Label>
                <Select value={scheduleFreq} onValueChange={setScheduleFreq}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {scheduleFreq === "weekly" && (
                <div className="space-y-1">
                  <Label>Day of week</Label>
                  <Select value={String(scheduleDow)} onValueChange={(v) => setScheduleDow(parseInt(v))}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOW_LABELS.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scheduleFreq === "monthly" && (
                <div className="space-y-1">
                  <Label>Day of month</Label>
                  <Select value={String(scheduleDom)} onValueChange={(v) => setScheduleDom(parseInt(v))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <p className="text-xs text-muted-foreground self-end pb-2">Runs at 9:00 AM UTC</p>
            </div>
          )}

          {template.schedule_last_run_at && (
            <p className="text-xs text-muted-foreground">
              Last sent: {formatDate(template.schedule_last_run_at)}
            </p>
          )}
          {template.schedule_next_run_at && scheduleEnabled && (
            <p className="text-xs text-muted-foreground">
              Next run: {formatDate(template.schedule_next_run_at)}
            </p>
          )}

          <Button
            onClick={() => saveSchedule.mutate()}
            disabled={!isScheduleDirty || saveSchedule.isPending}
            variant="outline"
          >
            {saveSchedule.isPending ? "Saving…" : "Save schedule"}
          </Button>
        </Card>

        {/* Send now */}
        <Card className="space-y-4 p-6">
          <h3 className="font-semibold">Send now</h3>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="send-audience">Audience</Label>
              <Select value={sendAudience} onValueChange={(v) => { setSendAudience(v); setSelectedParentId(""); }}>
                <SelectTrigger id="send-audience" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(AUDIENCE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sendAudience === "single_parent" && (
              <div className="space-y-1">
                <Label htmlFor="parent-pick">Parent</Label>
                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                  <SelectTrigger id="parent-pick" className="w-72">
                    <SelectValue placeholder="Choose a parent…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(parents ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button onClick={handleSendClick} disabled={!canSend}>
            Send…
          </Button>
        </Card>

        {/* Send history */}
        {history && history.length > 0 && (
          <Card className="p-6">
            <h3 className="mb-3 font-semibold">Recent sends</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Date</th>
                    <th className="pb-2 pr-4 font-medium">Recipient</th>
                    <th className="pb-2 pr-4 font-medium">Triggered by</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.map((log) => {
                    const parent = Array.isArray(log.parents) ? log.parents[0] : log.parents;
                    return (
                      <tr key={log.id}>
                        <td className="py-2 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(log.sent_at)}
                        </td>
                        <td className="py-2 pr-4">{parent?.name ?? "—"}</td>
                        <td className="py-2 pr-4 capitalize">{log.triggered_by}</td>
                        <td className="py-2">
                          <Badge variant={log.status === "sent" ? "secondary" : "destructive"} className="text-xs">
                            {log.status}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send email now?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCount !== null
                ? `This will send "${template.name}" to ${confirmCount} recipient${confirmCount !== 1 ? "s" : ""}.`
                : "Sending…"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => send.mutate()} disabled={send.isPending}>
              {send.isPending ? "Sending…" : "Send"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function AdminEmails() {
  const list = useServerFn(adminListEmailTemplates);

  const { data: templates } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: () => list({}),
  });

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const transactional = useMemo(
    () => (templates ?? []).filter((t) => t.template_type === "transactional"),
    [templates],
  );
  const oneOff = useMemo(
    () => (templates ?? []).filter((t) => t.template_type === "one_off"),
    [templates],
  );

  useEffect(() => {
    if (!selectedKey && transactional.length > 0) setSelectedKey(transactional[0].key);
  }, [transactional, selectedKey]);

  const selected = useMemo(
    () => templates?.find((t) => t.key === selectedKey) ?? null,
    [templates, selectedKey],
  );

  const handleCreated = (key: string) => {
    setIsCreating(false);
    setSelectedKey(key);
  };

  const handleDeleted = () => {
    setSelectedKey(transactional[0]?.key ?? null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email templates</h1>
        <p className="text-sm text-muted-foreground">
          Write templates in Markdown. Use{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{`{{variable_name}}`}</code>{" "}
          placeholders — they're replaced when the email is sent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        {/* Sidebar */}
        <Card className="h-fit p-2">
          <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Transactional
          </p>
          <ul className="space-y-0.5">
            {transactional.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => { setSelectedKey(t.key); setIsCreating(false); }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    selectedKey === t.key && !isCreating ? "bg-accent font-medium" : ""
                  }`}
                >
                  {t.name}
                </button>
              </li>
            ))}
          </ul>

          <Separator className="my-2" />

          <div className="flex items-center justify-between px-3 pb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              One-off
            </p>
            <button
              type="button"
              onClick={() => { setIsCreating(true); setSelectedKey(null); }}
              className="rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-accent"
            >
              + New
            </button>
          </div>
          <ul className="space-y-0.5">
            {oneOff.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => { setSelectedKey(t.key); setIsCreating(false); }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                    selectedKey === t.key && !isCreating ? "bg-accent font-medium" : ""
                  }`}
                >
                  <span className="block truncate">{t.name}</span>
                  {t.schedule_enabled && (
                    <span className="text-xs text-muted-foreground">Scheduled</span>
                  )}
                </button>
              </li>
            ))}
            {oneOff.length === 0 && !isCreating && (
              <li className="px-3 py-2 text-xs text-muted-foreground">
                No one-off templates yet.
              </li>
            )}
          </ul>
        </Card>

        {/* Main panel */}
        <div>
          {isCreating ? (
            <NewTemplateForm onCancel={() => setIsCreating(false)} onCreated={handleCreated} />
          ) : selected?.template_type === "transactional" ? (
            <TransactionalEditor key={selected.key} template={selected} />
          ) : selected?.template_type === "one_off" ? (
            <OneOffEditor key={selected.key} template={selected} onDeleted={handleDeleted} />
          ) : (
            <Card className="p-6 text-sm text-muted-foreground">Select a template to edit.</Card>
          )}
        </div>
      </div>
    </div>
  );
}
