import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListMeetings } from "@/lib/admin-read.functions";
import { parseLocalDate } from "@/lib/calendar";
import {
  adminCreateMeeting,
  adminCreateSignUp,
  adminDeleteMeeting,
  adminDeleteSignUp,
  adminGenerateSeasonSchedule,
  adminListStudents,
  adminPreviewSeasonSchedule,
  adminSendDinnerReminder,
  adminUpdateMeeting,
} from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/admin/meetings")({
  component: AdminMeetings,
});

function nextWeekday(day: 2 | 4): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  while (d.getDay() !== day) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

type MeetingRow = Awaited<ReturnType<typeof adminListMeetings>>[number];

function AdminMeetings() {
  const qc = useQueryClient();
  const list = useServerFn(adminListMeetings);
  const create = useServerFn(adminCreateMeeting);
  const del = useServerFn(adminDeleteMeeting);
  const preview = useServerFn(adminPreviewSeasonSchedule);
  const generate = useServerFn(adminGenerateSeasonSchedule);
  const listStudents = useServerFn(adminListStudents);
  const updateMeeting = useServerFn(adminUpdateMeeting);
  const deleteSignUp = useServerFn(adminDeleteSignUp);
  const createSignUp = useServerFn(adminCreateSignUp);
  const sendReminder = useServerFn(adminSendDinnerReminder);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-meetings"],
    queryFn: () => list({}),
  });

  const [date, setDate] = useState(nextWeekday(2));
  const [notes, setNotes] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const fourMonthsOut = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 4);
    return d.toISOString().slice(0, 10);
  })();
  const [genStart, setGenStart] = useState(today);
  const [genEnd, setGenEnd] = useState(fourMonthsOut);
  const rangeValid =
    /^\d{4}-\d{2}-\d{2}$/.test(genStart) &&
    /^\d{4}-\d{2}-\d{2}$/.test(genEnd) &&
    genEnd >= genStart;

  const previewQ = useQuery({
    queryKey: ["admin-season-preview", genStart, genEnd],
    queryFn: () => preview({ data: { start: genStart, end: genEnd } }),
    enabled: genOpen && rangeValid,
    retry: false,
  });

  // Edit dialog state
  const [editMeeting, setEditMeeting] = useState<MeetingRow | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [editDinner, setEditDinner] = useState("");

  useEffect(() => {
    if (editMeeting) {
      setEditNotes(editMeeting.notes ?? "");
      setEditParentId("");
      setEditDinner("");
    }
  }, [editMeeting]);

  const studentsQ = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => listStudents({}),
    enabled: !!editMeeting,
  });

  const createM = useMutation({
    mutationFn: (input: { date: string; notes?: string }) => create({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      setNotes("");
      toast.success("Meeting added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      toast.success("Meeting removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const genM = useMutation({
    mutationFn: () => generate({ data: { start: genStart, end: genEnd } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      qc.invalidateQueries({ queryKey: ["admin-season-preview"] });
      setGenOpen(false);
      toast.success(
        res.created === 0
          ? "Schedule already complete — nothing to add."
          : `Created ${res.created} meeting${res.created === 1 ? "" : "s"}.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotesM = useMutation({
    mutationFn: () =>
      updateMeeting({ data: { id: editMeeting!.id, notes: editNotes } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      toast.success("Notes saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSignUpM = useMutation({
    mutationFn: (signUpId: string) => deleteSignUp({ data: { signUpId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      toast.success("Sign-up removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addSignUpM = useMutation({
    mutationFn: () =>
      createSignUp({
        data: {
          meeting_id: editMeeting!.id,
          parent_id: editParentId,
          dinner: editDinner.trim() || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-meetings"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      setEditParentId("");
      setEditDinner("");
      toast.success("Signed up");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const sendReminderM = useMutation({
    mutationFn: (meetingId: string) => sendReminder({ data: { meetingId } }),
    onSuccess: (res) => toast.success(`Reminder sent to ${res.sentTo}`),
    onError: (e: Error) => toast.error(e.message),
  });



  // Refresh editMeeting reference from latest list when data changes
  const currentEdit =
    editMeeting && data ? data.find((m) => m.id === editMeeting.id) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            Add or remove team meeting dates. Unfilled future meetings are highlighted.
          </p>
        </div>
        <Button variant="outline" onClick={() => setGenOpen(true)}>
          Generate season schedule
        </Button>
      </div>

      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate season schedule</DialogTitle>
            <DialogDescription>
              Pick a date range. Every Tuesday and Thursday in the range will be added.
              Existing dates are skipped, so this is safe to re-run.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="gs">Start date</Label>
              <Input
                id="gs"
                type="date"
                value={genStart}
                onChange={(e) => setGenStart(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ge">End date</Label>
              <Input
                id="ge"
                type="date"
                value={genEnd}
                onChange={(e) => setGenEnd(e.target.value)}
              />
            </div>
          </div>
          {!rangeValid ? (
            <div className="text-sm text-destructive">
              Enter a valid start and end date. End must be on or after start.
            </div>
          ) : previewQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Calculating…</div>
          ) : previewQ.error ? (
            <div className="text-sm text-destructive">{(previewQ.error as Error).message}</div>
          ) : previewQ.data ? (
            <div className="space-y-1 text-sm">
              <div>Tue + Thu dates in range: {previewQ.data.total}</div>
              <div>Already scheduled: {previewQ.data.skipped}</div>
              <div className="font-medium">Will be created: {previewQ.data.toCreate}</div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => genM.mutate()}
              disabled={
                genM.isPending ||
                !rangeValid ||
                previewQ.isLoading ||
                !!previewQ.error ||
                (previewQ.data?.toCreate ?? 0) === 0
              }
            >
              {genM.isPending
                ? "Creating…"
                : previewQ.data
                  ? `Create ${previewQ.data.toCreate} meeting${previewQ.data.toCreate === 1 ? "" : "s"}`
                  : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMeeting} onOpenChange={(o) => !o && setEditMeeting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit meeting
              {currentEdit && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {parseLocalDate(currentEdit.date).toLocaleDateString(undefined, { weekday: "short" })}, {currentEdit.date}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>Update the note or change the sign-up.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Optional notes for this meeting"
              rows={3}
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => saveNotesM.mutate()}
                disabled={saveNotesM.isPending || editNotes === (currentEdit?.notes ?? "")}
              >
                {saveNotesM.isPending ? "Saving…" : "Save notes"}
              </Button>
            </div>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label>Sign-up</Label>
            {currentEdit?.signup ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="text-sm">
                  <div className="font-medium">{currentEdit.signup.student?.name}</div>
                  <div className="text-muted-foreground">
                    Signed up by {currentEdit.signup.parent?.name}
                    {currentEdit.signup.parent?.email && (
                      <> ({currentEdit.signup.parent.email})</>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (confirm("Remove this sign-up?"))
                      removeSignUpM.mutate(currentEdit.signup!.id);
                  }}
                  disabled={removeSignUpM.isPending}
                >
                  Remove sign-up
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                <div className="text-sm text-muted-foreground">
                  No one is signed up. Sign up a parent on their behalf:
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-parent">Parent</Label>
                  <Select value={editParentId} onValueChange={setEditParentId}>
                    <SelectTrigger id="edit-parent">
                      <SelectValue placeholder="Choose a parent…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(studentsQ.data ?? []).flatMap((s) =>
                        (s.parents ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} — {s.name}
                          </SelectItem>
                        )),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-dinner">Dinner (optional)</Label>
                  <Input
                    id="edit-dinner"
                    value={editDinner}
                    onChange={(e) => setEditDinner(e.target.value)}
                    placeholder="e.g. Lasagna"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => addSignUpM.mutate()}
                    disabled={!editParentId || addSignUpM.isPending}
                  >
                    {addSignUpM.isPending ? "Signing up…" : "Sign up"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMeeting(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createM.mutate({ date, notes: notes.trim() || undefined });
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setDate(nextWeekday(2))}>
              Next Tue
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDate(nextWeekday(4))}>
              Next Thu
            </Button>
          </div>
          <div className="flex-1 space-y-1 min-w-[200px]">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" disabled={createM.isPending}>Add meeting</Button>
        </form>
      </Card>

      {isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {(data ?? []).map((m) => {
            const isFuture = m.date >= today;
            const isUnfilled = !m.signup && isFuture;
            return (
              <div
                key={m.id}
                className={`flex flex-wrap items-center justify-between gap-3 p-4 ${isUnfilled ? "bg-amber-50" : ""}`}
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {parseLocalDate(m.date).toLocaleDateString(undefined, { weekday: "short" })}, {m.date}
                    {!isFuture && <span className="ml-2 text-xs text-muted-foreground">(past)</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {m.signup ? (
                      <>
                        <span className="font-medium text-foreground">{m.signup.student?.name}</span>
                        {" · "}signed up by{" "}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default underline decoration-dotted">
                                {m.signup.parent?.name}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{m.signup.parent?.email}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </>
                    ) : (
                      <span className={isUnfilled ? "text-amber-700 font-medium" : ""}>Available</span>
                    )}
                    {m.notes && <span className="ml-2 italic">— {m.notes}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {m.signup && isFuture && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendReminderM.mutate(m.id)}
                      disabled={sendReminderM.isPending && sendReminderM.variables === m.id}
                    >
                      {sendReminderM.isPending && sendReminderM.variables === m.id
                        ? "Sending…"
                        : "Send reminder email"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setEditMeeting(m)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Remove this meeting? Any sign-up will be deleted.")) delM.mutate(m.id);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
          {(data ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No meetings yet.</div>
          )}
        </Card>
      )}
    </div>
  );
}
