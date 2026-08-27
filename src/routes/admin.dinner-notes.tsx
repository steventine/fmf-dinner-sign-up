import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminDeleteDinnerNote,
  adminDeleteDinnerSource,
  adminListDinnerNotes,
  adminListDinnerSources,
  adminMergeDinnerSources,
  adminPostDinnerNote,
  adminSetDinnerNoteHidden,
  adminUpdateDinnerNote,
  adminUpdateDinnerSource,
} from "@/lib/dinner-ideas.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { NoteFields } from "@/components/DinnerIdeas";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/dinner-notes")({
  component: AdminDinnerNotes,
});

type SourceRow = Awaited<ReturnType<typeof adminListDinnerSources>>["sources"][number];

function AdminDinnerNotes() {
  const qc = useQueryClient();
  const listNotes = useServerFn(adminListDinnerNotes);
  const listSources = useServerFn(adminListDinnerSources);

  const { data: noteData, isLoading } = useQuery({
    queryKey: ["admin-dinner-notes"],
    queryFn: () => listNotes({}),
  });
  const { data: sourceData } = useQuery({
    queryKey: ["admin-dinner-sources"],
    queryFn: () => listSources({}),
  });

  const notes = noteData?.notes ?? [];
  const sources = sourceData?.sources ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dinner ideas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notes parents have shared about what to bring. Hiding a note removes it from the parent
          page but keeps it here, so you can undo.
        </p>
      </div>

      <SeedNoteCard />

      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Notes</h2>
          <span className="text-sm text-muted-foreground">
            {notes.length} total · {notes.filter((n) => n.hidden).length} hidden
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes yet. Post one above to seed the page.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {notes.map((note) => (
              <NoteRow key={note.id} note={note} />
            ))}
          </div>
        )}
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Restaurants and dishes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Fix a name or contact detail, or merge duplicates that crept in.
          </p>
        </div>

        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {sources.map((source) => (
              <SourceRowEditor
                key={source.id}
                source={source}
                allSources={sources}
                onChanged={() => {
                  qc.invalidateQueries({ queryKey: ["admin-dinner-sources"] });
                  qc.invalidateQueries({ queryKey: ["admin-dinner-notes"] });
                }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function NoteRow({
  note,
}: {
  note: Awaited<ReturnType<typeof adminListDinnerNotes>>["notes"][number];
}) {
  const qc = useQueryClient();
  const setHidden = useServerFn(adminSetDinnerNoteHidden);
  const remove = useServerFn(adminDeleteDinnerNote);
  const update = useServerFn(adminUpdateDinnerNote);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(note.body);
  const [servedCount, setServedCount] = useState(note.servedCount?.toString() ?? "");
  const [totalCost, setTotalCost] = useState(note.totalCost?.toString() ?? "");

  function startEditing() {
    setBody(note.body);
    setServedCount(note.servedCount?.toString() ?? "");
    setTotalCost(note.totalCost?.toString() ?? "");
    setEditing(true);
  }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-dinner-notes"] });
    qc.invalidateQueries({ queryKey: ["admin-dinner-sources"] });
  };

  const hide = useMutation({
    mutationFn: (hidden: boolean) => setHidden({ data: { noteId: note.id, hidden } }),
    onSuccess: () => {
      invalidate();
      toast.success(note.hidden ? "Note is visible again" : "Note hidden");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => remove({ data: { noteId: note.id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Note deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          noteId: note.id,
          body: body.trim(),
          servedCount: servedCount ? Number(servedCount) : null,
          totalCost: totalCost || undefined,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Note updated");
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const served =
    note.servedCount && note.totalCost !== null
      ? `Fed ${note.servedCount} for $${note.totalCost.toFixed(0)}`
      : note.servedCount
        ? `Fed about ${note.servedCount}`
        : note.totalCost !== null
          ? `About $${note.totalCost.toFixed(0)}`
          : null;

  return (
    <div className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{note.source?.name ?? "(deleted)"}</span>
        <Badge variant="outline" className="text-xs">
          {note.source?.kind === "homemade" ? "Home-cooked" : "Restaurant"}
        </Badge>
        {note.hidden && (
          <Badge variant="secondary" className="text-xs">
            Hidden
          </Badge>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {note.votes} vote{note.votes === 1 ? "" : "s"}
        </span>
      </div>

      {editing ? (
        <div className="space-y-3 rounded-md border border-border p-3">
          <NoteFields
            idPrefix={`admin-${note.id}`}
            body={body}
            onBodyChange={setBody}
            servedCount={servedCount}
            onServedCountChange={setServedCount}
            totalCost={totalCost}
            onTotalCostChange={setTotalCost}
            label="Note"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !body.trim()}
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note.body}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{note.authorName}</span>
        {note.authorEmail && (
          <>
            <span aria-hidden>·</span>
            <span>{note.authorEmail}</span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
        {served && (
          <>
            <span aria-hidden>·</span>
            <span>{served}</span>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEditing}>
            Edit
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => hide.mutate(!note.hidden)}
          disabled={hide.isPending}
        >
          {note.hidden ? "Un-hide" : "Hide"}
        </Button>
        {confirmDelete ? (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => del.mutate()}
              disabled={del.isPending}
            >
              {del.isPending ? "Deleting…" : "Delete permanently"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
              Never mind
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function SourceRowEditor({
  source,
  allSources,
  onChanged,
}: {
  source: SourceRow;
  allSources: SourceRow[];
  onChanged: () => void;
}) {
  const update = useServerFn(adminUpdateDinnerSource);
  const merge = useServerFn(adminMergeDinnerSources);
  const remove = useServerFn(adminDeleteDinnerSource);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState(source.name);
  const [phone, setPhone] = useState(source.phone ?? "");
  const [website, setWebsite] = useState(source.website ?? "");
  const [leadTime, setLeadTime] = useState(source.orderLeadTime ?? "");
  const [delivers, setDelivers] = useState(source.delivers ?? false);
  const [mergeInto, setMergeInto] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mergeTargets = allSources.filter((s) => s.kind === source.kind && s.id !== source.id);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          sourceId: source.id,
          name: name.trim(),
          phone,
          website,
          orderLeadTime: leadTime,
          delivers,
        },
      }),
    onSuccess: () => {
      onChanged();
      toast.success("Saved");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mergeMut = useMutation({
    mutationFn: () => merge({ data: { fromSourceId: source.id, intoSourceId: mergeInto } }),
    onSuccess: () => {
      onChanged();
      toast.success("Merged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => remove({ data: { sourceId: source.id } }),
    onSuccess: () => {
      onChanged();
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{source.name}</span>
        <Badge variant="outline" className="text-xs">
          {source.kind === "homemade" ? "Home-cooked" : "Restaurant"}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {source.noteCount} note{source.noteCount === 1 ? "" : "s"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Close" : "Edit"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 rounded-md border border-border p-3">
          <div className="space-y-2">
            <Label htmlFor={`sn-${source.id}`}>Name</Label>
            <Input id={`sn-${source.id}`} value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {source.kind === "restaurant" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`sp-${source.id}`}>Phone</Label>
                <Input
                  id={`sp-${source.id}`}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`sl-${source.id}`}>Order-by time</Label>
                <Input
                  id={`sl-${source.id}`}
                  value={leadTime}
                  onChange={(e) => setLeadTime(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={`sw-${source.id}`}>Website</Label>
                <Input
                  id={`sw-${source.id}`}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <Checkbox
                  id={`sd-${source.id}`}
                  checked={delivers}
                  onCheckedChange={(v) => setDelivers(v === true)}
                />
                <Label htmlFor={`sd-${source.id}`} className="font-normal">
                  They deliver
                </Label>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending || !name.trim()}
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>

            {mergeTargets.length > 0 && (
              <>
                <Select value={mergeInto} onValueChange={setMergeInto}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Merge into…" />
                  </SelectTrigger>
                  <SelectContent>
                    {mergeTargets.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => mergeMut.mutate()}
                  disabled={!mergeInto || mergeMut.isPending}
                >
                  {mergeMut.isPending ? "Merging…" : "Merge"}
                </Button>
              </>
            )}

            {confirmDelete ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => del.mutate()}
                  disabled={del.isPending}
                >
                  {del.isPending
                    ? "Deleting…"
                    : `Delete and remove ${source.noteCount} note${source.noteCount === 1 ? "" : "s"}`}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  Never mind
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Seeding: team-authored notes carry no parent and render as "FullMetal Falcons",
// so the page isn't empty before the first parent posts.
function SeedNoteCard() {
  const qc = useQueryClient();
  const post = useServerFn(adminPostDinnerNote);

  const [kind, setKind] = useState<"restaurant" | "homemade">("restaurant");
  const [sourceName, setSourceName] = useState("");
  const [body, setBody] = useState("");
  const [servedCount, setServedCount] = useState("");
  const [totalCost, setTotalCost] = useState("");

  const postMut = useMutation({
    mutationFn: () =>
      post({
        data: {
          kind,
          sourceName: sourceName.trim(),
          body: body.trim(),
          servedCount: servedCount ? Number(servedCount) : null,
          totalCost: totalCost || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-dinner-notes"] });
      qc.invalidateQueries({ queryKey: ["admin-dinner-sources"] });
      toast.success("Note posted");
      setSourceName("");
      setBody("");
      setServedCount("");
      setTotalCost("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="font-semibold">Post a note as the team</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shows on the parent page attributed to FullMetal Falcons.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="seed-kind">Type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as "restaurant" | "homemade")}>
            <SelectTrigger id="seed-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="restaurant">Restaurant</SelectItem>
              <SelectItem value="homemade">Home-cooked dish</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="seed-name">
            {kind === "restaurant" ? "Restaurant name" : "Dish name"}
          </Label>
          <Input
            id="seed-name"
            value={sourceName}
            maxLength={120}
            placeholder={kind === "restaurant" ? "Domino's Pizza" : "Baked ziti"}
            onChange={(e) => setSourceName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="seed-body">Note</Label>
        <Textarea
          id="seed-body"
          rows={4}
          value={body}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Fed about</span>
        <Input
          type="number"
          min={1}
          max={500}
          className="w-20"
          value={servedCount}
          onChange={(e) => setServedCount(e.target.value)}
          aria-label="How many people it fed"
        />
        <span>people for</span>
        <Input
          className="w-24"
          placeholder="$0"
          value={totalCost}
          onChange={(e) => setTotalCost(e.target.value)}
          aria-label="Total cost"
        />
        <span>· both optional</span>
      </div>

      <Button
        onClick={() => postMut.mutate()}
        disabled={postMut.isPending || !sourceName.trim() || !body.trim()}
      >
        {postMut.isPending ? "Posting…" : "Post note"}
      </Button>
    </Card>
  );
}
