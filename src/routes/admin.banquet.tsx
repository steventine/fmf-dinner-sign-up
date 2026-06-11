import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminCreateBanquet,
  adminDeleteBanquet,
  adminDeleteCategory,
  adminDeleteRsvp,
  adminGetBanquet,
  adminSendBanquetInvites,
  adminUpdateBanquet,
  adminUpsertCategory,
} from "@/lib/banquet.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/banquet")({
  component: AdminBanquet,
});

type BanquetData = Awaited<ReturnType<typeof adminGetBanquet>>;
type Category = BanquetData["categories"][number];
type Rsvp = BanquetData["rsvps"][number];

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function AdminBanquet() {
  const get = useServerFn(adminGetBanquet);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-banquet"],
    queryFn: () => get({}),
  });

  if (isLoading) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Banquet</h1>
        <p className="text-sm text-muted-foreground">
          Manage the end-of-year banquet: details, potluck categories, and RSVPs.
        </p>
      </div>

      {!data?.banquet ? (
        <CreateBanquetCard />
      ) : (
        <>
          <DetailsCard banquet={data.banquet} rsvpCount={data.rsvps.length} />
          <CategoriesCard banquet={data.banquet} categories={data.categories} />
          <RsvpsCard categories={data.categories} rsvps={data.rsvps} />
        </>
      )}
    </div>
  );
}

function CreateBanquetCard() {
  const qc = useQueryClient();
  const create = useServerFn(adminCreateBanquet);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const createM = useMutation({
    mutationFn: () =>
      create({
        data: {
          date,
          time: time.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banquet"] });
      toast.success("Banquet created with default potluck categories");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-4">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          createM.mutate();
        }}
      >
        <div className="text-sm text-muted-foreground">
          No banquet exists for this season yet. Creating one adds the default potluck categories
          (Entree, Sides, Desserts, Water, Soft Drinks), which you can adjust below.
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="b-date">Date</Label>
            <Input
              id="b-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="b-time">Time (optional)</Label>
            <Input
              id="b-time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="e.g. 6:00 PM"
            />
          </div>
          <div className="flex-1 space-y-1 min-w-[200px]">
            <Label htmlFor="b-loc">Location (optional)</Label>
            <Input id="b-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <Button type="submit" disabled={!date || createM.isPending}>
            {createM.isPending ? "Creating…" : "Create banquet"}
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="b-notes">Notes (optional)</Label>
          <Textarea
            id="b-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </Card>
  );
}

function DetailsCard({
  banquet,
  rsvpCount,
}: {
  banquet: NonNullable<BanquetData["banquet"]>;
  rsvpCount: number;
}) {
  const qc = useQueryClient();
  const update = useServerFn(adminUpdateBanquet);
  const sendInvites = useServerFn(adminSendBanquetInvites);
  const deleteBanquet = useServerFn(adminDeleteBanquet);
  const [date, setDate] = useState(banquet.date);
  const [time, setTime] = useState(banquet.time ?? "");
  const [location, setLocation] = useState(banquet.location ?? "");
  const [notes, setNotes] = useState(banquet.notes ?? "");

  const dirty =
    date !== banquet.date ||
    time !== (banquet.time ?? "") ||
    location !== (banquet.location ?? "") ||
    notes !== (banquet.notes ?? "");

  const updateM = useMutation({
    mutationFn: () =>
      update({
        data: {
          banquetId: banquet.id,
          date,
          time: time.trim() || undefined,
          location: location.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banquet"] });
      toast.success("Banquet updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invitesM = useMutation({
    mutationFn: () => sendInvites({ data: { banquetId: banquet.id } }),
    onSuccess: ({ sent, failed }) =>
      toast.success(
        `Invitations sent to ${sent} parent${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}`,
      ),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteBanquet({ data: { banquetId: banquet.id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banquet"] });
      toast.success("Banquet deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">Banquet details</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (
                confirm(
                  "Send banquet invitations to all parents of households that have not RSVPed yet?",
                )
              )
                invitesM.mutate();
            }}
            disabled={invitesM.isPending}
          >
            {invitesM.isPending ? "Sending…" : "Send invitations"}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              if (
                confirm(
                  `Delete this banquet? This permanently removes the banquet, its categories, and all ${rsvpCount} RSVP${rsvpCount === 1 ? "" : "s"} with their item sign-ups.`,
                )
              )
                deleteM.mutate();
            }}
            disabled={deleteM.isPending}
          >
            {deleteM.isPending ? "Deleting…" : "Delete banquet"}
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="d-date">Date</Label>
          <Input id="d-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="d-time">Time</Label>
          <Input
            id="d-time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            placeholder="e.g. 6:00 PM"
          />
        </div>
        <div className="flex-1 space-y-1 min-w-[200px]">
          <Label htmlFor="d-loc">Location</Label>
          <Input id="d-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="d-notes">Notes</Label>
        <Textarea id="d-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => updateM.mutate()}
          disabled={!dirty || !date || updateM.isPending}
        >
          {updateM.isPending ? "Saving…" : "Save details"}
        </Button>
      </div>
    </Card>
  );
}

function CategoriesCard({
  banquet,
  categories,
}: {
  banquet: NonNullable<BanquetData["banquet"]>;
  categories: Category[];
}) {
  const qc = useQueryClient();
  const upsert = useServerFn(adminUpsertCategory);
  const del = useServerFn(adminDeleteCategory);

  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("4");

  const open = adding || !!editing;

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setDescription(editing.description);
      setCapacity(String(editing.capacity));
    } else if (adding) {
      setName("");
      setDescription("");
      setCapacity("4");
    }
  }, [editing, adding]);

  function closeDialog() {
    setEditing(null);
    setAdding(false);
  }

  const upsertM = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          banquetId: banquet.id,
          categoryId: editing?.id,
          name: name.trim(),
          description: description.trim(),
          capacity: Number(capacity),
          sortOrder: editing?.sort_order ?? categories.length,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banquet"] });
      toast.success(editing ? "Category updated" : "Category added");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (categoryId: string) => del({ data: { categoryId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banquet"] });
      toast.success("Category removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const capacityNum = Number(capacity);
  const valid = name.trim().length > 0 && Number.isInteger(capacityNum) && capacityNum >= 0;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-2">
        <h2 className="font-medium">Potluck categories</h2>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          Add category
        </Button>
      </div>
      <div className="divide-y divide-border">
        {categories.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium">
                {c.name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {c.claimed} of {c.capacity} claimed
                </span>
                {c.claimed > c.capacity && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    over capacity
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{c.description}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm(`Remove the "${c.name}" category?`)) delM.mutate(c.id);
                }}
                disabled={delM.isPending}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
        {categories.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No categories yet.</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "Add category"}</DialogTitle>
            <DialogDescription>
              Capacity is how many households can sign up for this category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-desc">Description</Label>
              <Textarea
                id="c-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Please bring a meal that will feed 8-10 people"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-cap">Capacity</Label>
              <Input
                id="c-cap"
                type="number"
                min={0}
                className="w-28"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button onClick={() => upsertM.mutate()} disabled={!valid || upsertM.isPending}>
              {upsertM.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function RsvpsCard({ categories, rsvps }: { categories: Category[]; rsvps: Rsvp[] }) {
  const qc = useQueryClient();
  const del = useServerFn(adminDeleteRsvp);
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  const delM = useMutation({
    mutationFn: (rsvpId: string) => del({ data: { rsvpId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banquet"] });
      toast.success("RSVP removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attending = rsvps.filter((r) => r.attending);
  const totalGuests = attending.reduce((sum, r) => sum + r.guest_count, 0);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 pb-2">
        <h2 className="font-medium">RSVPs</h2>
        <p className="text-sm text-muted-foreground">
          {attending.length} household{attending.length === 1 ? "" : "s"} attending · {totalGuests}{" "}
          total guest
          {totalGuests === 1 ? "" : "s"}
          {rsvps.length > attending.length && ` · ${rsvps.length - attending.length} not attending`}
        </p>
      </div>
      <div className="divide-y divide-border">
        {rsvps.map((r) => {
          const student = one(r.students);
          const parent = one(r.parents);
          return (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium">
                  {student?.name ?? "Unknown household"}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.attending
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.attending
                      ? `Attending · ${r.guest_count} guest${r.guest_count === 1 ? "" : "s"}`
                      : "Not attending"}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  RSVPed by {parent?.name ?? "?"}
                  {r.attending && r.banquet_item_signups.length > 0 && (
                    <>
                      {" · bringing "}
                      {r.banquet_item_signups
                        .map((s) => {
                          const cat = categoryNames.get(s.category_id) ?? "Item";
                          return s.item_description ? `${cat} (${s.item_description})` : cat;
                        })
                        .join(", ")}
                    </>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (confirm("Remove this RSVP? Any item sign-ups will be released."))
                    delM.mutate(r.id);
                }}
                disabled={delM.isPending}
              >
                Remove
              </Button>
            </div>
          );
        })}
        {rsvps.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No RSVPs yet.</div>
        )}
      </div>
    </Card>
  );
}
