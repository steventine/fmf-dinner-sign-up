import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { ChefHat, Clock, Phone, Plus, Store, ThumbsUp, Truck } from "lucide-react";
import {
  postDinnerNote,
  updateDinnerNote,
  toggleDinnerNoteVote,
  updateDinnerSourceContact,
} from "@/lib/dinner-ideas.functions";
import { useDinnerIdeas, type DinnerSource } from "@/hooks/use-dinner-ideas";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Kind = "restaurant" | "homemade";

const PLACEHOLDERS: Record<Kind, string> = {
  restaurant:
    "I ordered 6 pizzas — 3 cheese, 2 pepperoni, 1 sausage — and it was the perfect amount. They also do cookies, so I got 12. Order by 5:30 so it's ready by 6:15.",
  homemade:
    "I made two 9x13 pans plus salad and garlic bread — fed about 24 with a little left over. Assembled it the night before and baked it that afternoon.",
};

const NAME_LABEL: Record<Kind, string> = {
  restaurant: "Which restaurant?",
  homemade: "What did you make?",
};

const NAME_PLACEHOLDER: Record<Kind, string> = {
  restaurant: "Domino's, Panera, the deli on Main…",
  homemade: "Baked ziti, walking tacos, chili bar…",
};

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function servedLine(servedCount: number | null, totalCost: number | null) {
  if (servedCount && totalCost !== null) return `Fed ${servedCount} for $${totalCost.toFixed(0)}`;
  if (servedCount) return `Fed about ${servedCount}`;
  if (totalCost !== null) return `About $${totalCost.toFixed(0)}`;
  return null;
}

export function DinnerIdeas({ guid }: { guid: string }) {
  const { data, isLoading, error } = useDinnerIdeas(guid);
  const [postOpen, setPostOpen] = useState(false);

  const sources = data?.sources ?? [];
  const restaurants = sources.filter((s) => s.kind === "restaurant");
  const homemade = sources.filter((s) => s.kind === "homemade");

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Dinner ideas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            What other families brought, and what it cost.
          </p>
        </div>
        <Button onClick={() => setPostOpen(true)}>
          <Plus className="mr-1.5 size-4" aria-hidden />
          Share what you brought
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading ideas…</p>
      ) : error ? (
        <p className="text-sm text-destructive">
          Couldn't load dinner ideas. Refresh the page to try again.
        </p>
      ) : sources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm font-medium text-foreground">No ideas yet — be the first</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            If you've provided dinner before, tell the next family what you ordered or made, how
            much food it took, and what it cost. It's the most useful thing you can leave behind.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {restaurants.length > 0 && (
            <SourceGroup
              title="Ordering out"
              icon={<Store className="size-4" aria-hidden />}
              sources={restaurants}
              guid={guid}
            />
          )}
          {homemade.length > 0 && (
            <SourceGroup
              title="Home-cooked"
              icon={<ChefHat className="size-4" aria-hidden />}
              sources={homemade}
              guid={guid}
            />
          )}
        </div>
      )}

      <PostNoteDialog guid={guid} open={postOpen} onOpenChange={setPostOpen} sources={sources} />
    </Card>
  );
}

function SourceGroup({
  title,
  icon,
  sources,
  guid,
}: {
  title: string;
  icon: React.ReactNode;
  sources: DinnerSource[];
  guid: string;
}) {
  return (
    <section className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {title}
      </p>
      {sources.map((source) => (
        <SourceCard key={source.id} source={source} guid={guid} />
      ))}
    </section>
  );
}

function SourceCard({ source, guid }: { source: DinnerSource; guid: string }) {
  const [contactOpen, setContactOpen] = useState(false);
  const hasContact = !!(source.phone || source.website || source.orderLeadTime || source.delivers);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-foreground">{source.name}</h3>
        <span className="text-xs text-muted-foreground">
          {source.notes.length} note{source.notes.length === 1 ? "" : "s"}
        </span>
      </div>

      {source.kind === "restaurant" &&
        (hasContact ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {source.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden />
                {source.phone}
              </span>
            )}
            {source.orderLeadTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                {source.orderLeadTime}
              </span>
            )}
            {source.delivers != null && (
              <span className="flex items-center gap-1.5">
                <Truck className="size-3.5" aria-hidden />
                {source.delivers ? "Delivers" : "Pickup only"}
              </span>
            )}
            {source.website && (
              <a
                href={source.website}
                target="_blank"
                rel="noreferrer noopener"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Website
              </a>
            )}
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="ml-auto text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Edit
            </button>
          </div>
        ) : (
          // Empty slots read as an invitation — filling them is a separate ten-second
          // job that never blocked anyone from posting their note.
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={() => setContactOpen(true)}>
              Add phone and order-by time
            </Button>
          </div>
        ))}

      <div className="mt-3 space-y-3">
        {source.notes.map((note) => (
          <NoteRow key={note.id} note={note} guid={guid} />
        ))}
      </div>

      {source.kind === "restaurant" && (
        <ContactDialog
          guid={guid}
          source={source}
          open={contactOpen}
          onOpenChange={setContactOpen}
        />
      )}
    </div>
  );
}

// The note body plus the two optional numbers — shared by the post dialog, the
// parent's inline edit, and the admin page so the three stay in step.
export function NoteFields({
  idPrefix,
  body,
  onBodyChange,
  servedCount,
  onServedCountChange,
  totalCost,
  onTotalCostChange,
  label = "What should the next family know?",
  placeholder,
}: {
  idPrefix: string;
  body: string;
  onBodyChange: (v: string) => void;
  servedCount: string;
  onServedCountChange: (v: string) => void;
  totalCost: string;
  onTotalCostChange: (v: string) => void;
  label?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-body`}>{label}</Label>
        <Textarea
          id={`${idPrefix}-body`}
          rows={5}
          value={body}
          maxLength={4000}
          placeholder={placeholder}
          onChange={(e) => onBodyChange(e.target.value)}
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
          onChange={(e) => onServedCountChange(e.target.value)}
          aria-label="How many people it fed"
        />
        <span>people for</span>
        <Input
          className="w-24"
          placeholder="$0"
          value={totalCost}
          onChange={(e) => onTotalCostChange(e.target.value)}
          aria-label="Total cost"
        />
        <span>· both optional</span>
      </div>
    </div>
  );
}

function NoteRow({ note, guid }: { note: DinnerSource["notes"][number]; guid: string }) {
  const vote = useServerFn(toggleDinnerNoteVote);
  const update = useServerFn(updateDinnerNote);
  const qc = useQueryClient();

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

  const voteMut = useMutation({
    mutationFn: () => vote({ data: { guid, noteId: note.id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dinner-ideas", guid] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      update({
        data: {
          guid,
          noteId: note.id,
          body: body.trim(),
          servedCount: servedCount ? Number(servedCount) : null,
          totalCost: totalCost || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Note updated.");
      qc.invalidateQueries({ queryKey: ["dinner-ideas", guid] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const served = servedLine(note.servedCount, note.totalCost);

  if (editing) {
    return (
      <div className="space-y-3 border-t border-border pt-3">
        <NoteFields
          idPrefix={`edit-${note.id}`}
          body={body}
          onBodyChange={setBody}
          servedCount={servedCount}
          onServedCountChange={setServedCount}
          totalCost={totalCost}
          onTotalCostChange={setTotalCost}
          label="Your note"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !body.trim()}
          >
            {saveMut.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-3">
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>
          {note.author} · {formatMonth(note.createdAt)}
        </span>
        {served && (
          <>
            <span aria-hidden>·</span>
            <span>{served}</span>
          </>
        )}
        {note.mine && (
          <button
            type="button"
            onClick={startEditing}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Edit
          </button>
        )}
        <Button
          variant={note.votedByMe ? "secondary" : "ghost"}
          size="sm"
          className="ml-auto h-7 px-2 text-xs"
          onClick={() => voteMut.mutate()}
          disabled={voteMut.isPending}
          aria-pressed={note.votedByMe}
          aria-label={note.votedByMe ? "Remove your helpful vote" : "Mark this note helpful"}
        >
          <ThumbsUp className="mr-1 size-3.5" aria-hidden />
          {note.votes}
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------- Posting a note ---------------------------- */

function PostNoteDialog({
  guid,
  open,
  onOpenChange,
  sources,
}: {
  guid: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sources: DinnerSource[];
}) {
  const post = useServerFn(postDinnerNote);
  const qc = useQueryClient();

  // Nothing is preselected: the kind must be chosen before the rest of the form
  // exists, so a note can never be filed under the wrong one.
  const [kind, setKind] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [servedCount, setServedCount] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  function reset() {
    setKind(null);
    setName("");
    setSourceId(null);
    setBody("");
    setServedCount("");
    setTotalCost("");
    setNameError(null);
  }

  const matches = useMemo(() => {
    if (!kind || !name.trim() || sourceId) return [];
    const q = name.trim().toLowerCase();
    return sources
      .filter((s) => s.kind === kind && s.name.toLowerCase().includes(q))
      .filter((s) => s.name.toLowerCase() !== q)
      .slice(0, 5);
  }, [kind, name, sourceId, sources]);

  const exactMatch = useMemo(() => {
    if (!kind || !name.trim()) return null;
    const q = name.trim().toLowerCase();
    return sources.find((s) => s.kind === kind && s.name.toLowerCase() === q) ?? null;
  }, [kind, name, sources]);

  const postMut = useMutation({
    mutationFn: () =>
      post({
        data: {
          guid,
          kind: kind!,
          // An exact typed name resolves to the existing entry rather than a duplicate.
          sourceId: sourceId ?? exactMatch?.id,
          sourceName: (sourceId ?? exactMatch) ? undefined : name.trim(),
          body: body.trim(),
          servedCount: servedCount ? Number(servedCount) : null,
          totalCost: totalCost || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Posted — thanks for helping the next family.");
      qc.invalidateQueries({ queryKey: ["dinner-ideas", guid] });
      close();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit() {
    if (!name.trim()) {
      setNameError(kind === "homemade" ? "Name the dish first" : "Name the restaurant first");
      return;
    }
    postMut.mutate();
  }

  // Every close path routes through here. The footer's Cancel used to call
  // onOpenChange directly, which closed the dialog without clearing the draft,
  // so reopening showed the previous note.
  function close() {
    onOpenChange(false);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) onOpenChange(true);
        else close();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share what you brought</DialogTitle>
          <DialogDescription>
            {kind
              ? "Tell the next family what worked — quantities and cost are the most useful part."
              : "First — how did you handle dinner?"}
          </DialogDescription>
        </DialogHeader>

        {!kind ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <KindChoice
              icon={<Store className="size-6" aria-hidden />}
              title="I ordered out"
              hint="Pizza, sandwiches, takeout"
              onClick={() => setKind("restaurant")}
            />
            <KindChoice
              icon={<ChefHat className="size-6" aria-hidden />}
              title="I cooked"
              hint="Made it at home and brought it"
              onClick={() => setKind("homemade")}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {kind === "restaurant" ? (
                  <Store className="size-4" aria-hidden />
                ) : (
                  <ChefHat className="size-4" aria-hidden />
                )}
                {kind === "restaurant" ? "I ordered out" : "I cooked"}
              </span>
              <button
                type="button"
                onClick={reset}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Change
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="di-name">{NAME_LABEL[kind]}</Label>
              <Input
                id="di-name"
                value={name}
                autoFocus
                maxLength={120}
                placeholder={NAME_PLACEHOLDER[kind]}
                onChange={(e) => {
                  setName(e.target.value);
                  setSourceId(null);
                  setNameError(null);
                }}
              />
              {nameError && <p className="text-sm text-destructive">{nameError}</p>}

              {matches.length > 0 && (
                <div className="overflow-hidden rounded-md border border-border">
                  {matches.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setName(m.name);
                        setSourceId(m.id);
                      }}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span>{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.notes.length} note{m.notes.length === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                  {!exactMatch && (
                    <div className="border-t border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                      Or keep typing to add “{name.trim()}” as a new{" "}
                      {kind === "restaurant" ? "restaurant" : "dish"}
                    </div>
                  )}
                </div>
              )}
            </div>

            <NoteFields
              idPrefix="di"
              body={body}
              onBodyChange={setBody}
              servedCount={servedCount}
              onServedCountChange={setServedCount}
              totalCost={totalCost}
              onTotalCostChange={setTotalCost}
              placeholder={PLACEHOLDERS[kind]}
            />
          </div>
        )}

        {kind && (
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={postMut.isPending || !body.trim()}>
              {postMut.isPending ? "Posting…" : "Post note"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function KindChoice({
  icon,
  title,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border p-4 text-left transition-colors hover:border-primary hover:bg-accent"
    >
      <span className="text-primary">{icon}</span>
      <span className="mt-2 block font-medium text-foreground">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

/* ------------------------- Restaurant contact info ------------------------- */

function ContactDialog({
  guid,
  source,
  open,
  onOpenChange,
}: {
  guid: string;
  source: DinnerSource;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const update = useServerFn(updateDinnerSourceContact);
  const qc = useQueryClient();

  const [phone, setPhone] = useState(source.phone ?? "");
  const [website, setWebsite] = useState(source.website ?? "");
  const [leadTime, setLeadTime] = useState(source.orderLeadTime ?? "");
  const [delivers, setDelivers] = useState(source.delivers ?? false);

  // Re-seed each time it opens, so a cancelled edit doesn't come back and a detail
  // someone else fixed in the meantime shows up.
  useEffect(() => {
    if (!open) return;
    setPhone(source.phone ?? "");
    setWebsite(source.website ?? "");
    setLeadTime(source.orderLeadTime ?? "");
    setDelivers(source.delivers ?? false);
  }, [open, source.phone, source.website, source.orderLeadTime, source.delivers]);

  const save = useMutation({
    mutationFn: () =>
      update({
        data: {
          guid,
          sourceId: source.id,
          phone,
          website,
          orderLeadTime: leadTime,
          delivers,
        },
      }),
    onSuccess: () => {
      toast.success("Details saved.");
      qc.invalidateQueries({ queryKey: ["dinner-ideas", guid] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{source.name}</DialogTitle>
          <DialogDescription>
            Anyone can keep these up to date — if you spot a wrong number, fix it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="dc-phone">Phone</Label>
            <Input
              id="dc-phone"
              value={phone}
              maxLength={40}
              placeholder="123-456-7890"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dc-lead">Order-by time</Label>
            <Input
              id="dc-lead"
              value={leadTime}
              maxLength={80}
              placeholder="Order by 5:30 for a 6:15 pickup"
              onChange={(e) => setLeadTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dc-site">Website</Label>
            <Input
              id="dc-site"
              value={website}
              maxLength={300}
              placeholder="https://…"
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="dc-delivers"
              checked={delivers}
              onCheckedChange={(v) => setDelivers(v === true)}
            />
            <Label htmlFor="dc-delivers" className="font-normal">
              They deliver
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------- Peek shown inside the sign-up dialog --------------------- */

export function DinnerIdeasPeek({ guid, sources }: { guid: string; sources: DinnerSource[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;

  return (
    <div className="rounded-md border border-border">
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-left text-muted-foreground hover:text-foreground"
        >
          Need ideas? See what other families brought{" "}
          <span className="underline underline-offset-2">{open ? "Hide" : "Show"}</span>
        </button>
        <Link
          to="/parent/$guid/ideas"
          params={{ guid }}
          className="ml-auto shrink-0 text-xs text-primary underline underline-offset-2"
        >
          See all
        </Link>
      </div>
      {open && (
        <div className="max-h-56 space-y-2 overflow-y-auto border-t border-border px-3 py-2">
          {sources.map((s) => (
            <div key={s.id}>
              <p className="text-sm font-medium text-foreground">
                {s.name}
                {s.kind === "homemade" && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    home-cooked
                  </span>
                )}
              </p>
              {s.notes[0] && (
                <p className="line-clamp-2 text-xs text-muted-foreground">{s.notes[0].body}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
