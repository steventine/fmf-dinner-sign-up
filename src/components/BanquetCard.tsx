import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getParentBanquet, releaseBanquetItem, submitBanquetRsvp } from "@/lib/banquet.functions";
import { parseLocalDate } from "@/lib/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BanquetData = Awaited<ReturnType<typeof getParentBanquet>>;
type Category = BanquetData["categories"][number];

export function BanquetCard({ guid }: { guid: string }) {
  const fetchBanquet = useServerFn(getParentBanquet);
  const submit = useServerFn(submitBanquetRsvp);
  const release = useServerFn(releaseBanquetItem);
  const qc = useQueryClient();

  const queryKey = ["parent-banquet", guid];
  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchBanquet({ data: { guid } }),
    retry: false,
  });

  const [dialogOpen, setDialogOpen] = useState(false);

  const submitMut = useMutation({
    mutationFn: (input: {
      attending: boolean;
      guestCount: number;
      items: { categoryId: string; itemDescription?: string }[];
      updateItems: { itemSignupId: string; itemDescription?: string }[];
      removeItemSignupIds: string[];
    }) => submit({ data: { guid, ...input } }),
    onSuccess: (res, input) => {
      qc.invalidateQueries({ queryKey });
      if (res.failedCategories.length > 0) {
        const names = res.failedCategories
          .map((id) => data?.categories.find((c) => c.id === id)?.name ?? "An item")
          .join(", ");
        toast.warning(`${names} just filled up — please pick something else.`);
      } else {
        toast.success(input.attending ? "RSVP saved. See you there!" : "RSVP saved.");
        setDialogOpen(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const releaseMut = useMutation({
    mutationFn: (itemSignupId: string) => release({ data: { guid, itemSignupId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success("Item removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data?.banquet) return null;

  const { banquet, categories, myRsvp, myItems } = data;
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const banquetDate = parseLocalDate(banquet.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            End-of-year banquet
          </p>
          <h2 className="mt-1 text-base font-semibold text-foreground">
            {banquetDate}
            {banquet.time && ` · ${banquet.time}`}
          </h2>
          {banquet.location && <p className="text-sm text-muted-foreground">{banquet.location}</p>}
          {banquet.notes && <p className="mt-1 text-sm text-muted-foreground">{banquet.notes}</p>}
        </div>
        {myRsvp ? (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              myRsvp.attending
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {myRsvp.attending
              ? `Attending · ${myRsvp.guest_count} guest${myRsvp.guest_count === 1 ? "" : "s"}`
              : "Not attending"}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            RSVP needed
          </span>
        )}
      </div>

      {myRsvp?.attending && myItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">You're bringing:</p>
          <ul className="space-y-1">
            {myItems.map((item) => {
              const cat = categoryById.get(item.category_id);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <span>
                    <span className="font-medium">{cat?.name ?? "Item"}</span>
                    {item.item_description && (
                      <span className="text-muted-foreground"> — {item.item_description}</span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => releaseMut.mutate(item.id)}
                    disabled={releaseMut.isPending}
                  >
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <WhatOthersAreBringing categories={categories} />

      <div>
        <Button variant={myRsvp ? "outline" : "default"} onClick={() => setDialogOpen(true)}>
          {myRsvp ? "Change RSVP / add items" : "RSVP for the banquet"}
        </Button>
      </div>

      <RsvpDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        myRsvp={myRsvp}
        myItems={myItems}
        loading={submitMut.isPending}
        onConfirm={(input) => submitMut.mutate(input)}
      />
    </Card>
  );
}

function WhatOthersAreBringing({ categories }: { categories: Category[] }) {
  const withItems = categories.filter((c) => c.items.length > 0);
  if (withItems.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-foreground">What families are bringing so far:</p>
      <ul className="space-y-0.5 text-sm text-muted-foreground">
        {withItems.map((c) => (
          <li key={c.id}>
            <span className="font-medium text-foreground">{c.name}:</span>{" "}
            {c.items
              .map((i) => (i.description ? `${i.household} (${i.description})` : i.household))
              .join(", ")}
          </li>
        ))}
      </ul>
    </div>
  );
}

type SelectedEntry = {
  checked: boolean;
  desc: string;
  // Present when the household already has an item sign-up in this category.
  itemSignupId?: string;
  originalDesc?: string;
};

function RsvpDialog({
  open,
  onOpenChange,
  categories,
  myRsvp,
  myItems,
  loading,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: Category[];
  myRsvp: BanquetData["myRsvp"];
  myItems: BanquetData["myItems"];
  loading: boolean;
  onConfirm: (input: {
    attending: boolean;
    guestCount: number;
    items: { categoryId: string; itemDescription?: string }[];
    updateItems: { itemSignupId: string; itemDescription?: string }[];
    removeItemSignupIds: string[];
  }) => void;
}) {
  const [attending, setAttending] = useState(true);
  const [guestCount, setGuestCount] = useState(2);
  const [selected, setSelected] = useState<Record<string, SelectedEntry>>({});

  useEffect(() => {
    if (open) {
      setAttending(myRsvp?.attending ?? true);
      setGuestCount(myRsvp?.guest_count ?? 2);
      // Pre-fill from the household's current items (first item per category;
      // any extra duplicates in a category stay untouched and count toward the minimum).
      const initial: Record<string, SelectedEntry> = {};
      for (const item of myItems) {
        if (initial[item.category_id]) continue;
        initial[item.category_id] = {
          checked: true,
          desc: item.item_description ?? "",
          itemSignupId: item.id,
          originalDesc: item.item_description ?? "",
        };
      }
      setSelected(initial);
    }
  }, [open, myRsvp, myItems]);

  // Items in the same category beyond the first are not shown in the picker; they
  // still exist and count toward the "at least one item" requirement.
  const managedIds = new Set(
    Object.values(selected)
      .map((v) => v.itemSignupId)
      .filter(Boolean),
  );
  const unmanagedCount = myItems.filter((i) => !managedIds.has(i.id)).length;

  const entries = Object.entries(selected);
  const newItems = entries
    .filter(([, v]) => v.checked && !v.itemSignupId)
    .map(([categoryId, v]) => ({ categoryId, itemDescription: v.desc.trim() || undefined }));
  const updateItems = entries
    .filter(([, v]) => v.checked && v.itemSignupId && v.desc !== v.originalDesc)
    .map(([, v]) => ({
      itemSignupId: v.itemSignupId!,
      itemDescription: v.desc.trim() || undefined,
    }));
  const removeItemSignupIds = entries
    .filter(([, v]) => !v.checked && v.itemSignupId)
    .map(([, v]) => v.itemSignupId!);

  const checkedCount = entries.filter(([, v]) => v.checked).length;
  const needsItem = attending && checkedCount + unmanagedCount === 0;
  const existingItemCount = myItems.length;
  const droppingItems = !attending && existingItemCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Banquet RSVP</DialogTitle>
          <DialogDescription>
            The banquet is potluck style — attending households sign up to bring at least one item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Will your household attend?</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={attending ? "default" : "outline"}
                onClick={() => setAttending(true)}
              >
                Yes, we'll be there
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!attending ? "default" : "outline"}
                onClick={() => setAttending(false)}
              >
                No, we can't make it
              </Button>
            </div>
          </div>

          {attending && (
            <>
              <div className="space-y-1">
                <Label htmlFor="guests">
                  How many people are attending (including your student)?
                </Label>
                <Input
                  id="guests"
                  type="number"
                  min={1}
                  max={30}
                  className="w-28"
                  value={guestCount}
                  onChange={(e) =>
                    setGuestCount(Math.min(30, Math.max(1, parseInt(e.target.value || "1", 10))))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>What would you like to bring?</Label>
                <div className="space-y-2">
                  {categories.map((c) => {
                    const sel: SelectedEntry = selected[c.id] ?? { checked: false, desc: "" };
                    // A full category stays selectable when it's the household's own claim.
                    const full = c.capacity - c.claimed <= 0 && !sel.itemSignupId;
                    return (
                      <div
                        key={c.id}
                        className={`rounded-md border p-3 ${full ? "opacity-60" : ""}`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            id={`cat-${c.id}`}
                            checked={sel.checked}
                            disabled={full}
                            onCheckedChange={(v) =>
                              setSelected((s) => ({
                                ...s,
                                [c.id]: { ...sel, checked: v === true },
                              }))
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <Label htmlFor={`cat-${c.id}`} className="cursor-pointer font-medium">
                              {c.name}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {full ? "Full" : `${c.claimed} of ${c.capacity} claimed`}
                              </span>
                            </Label>
                            <p className="text-xs text-muted-foreground">{c.description}</p>
                            {c.items.length > 0 && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Already claimed:{" "}
                                {c.items
                                  .map((i) =>
                                    i.description
                                      ? `${i.household} (${i.description})`
                                      : i.household,
                                  )
                                  .join(", ")}
                              </p>
                            )}
                            {sel.checked && (
                              <Input
                                className="mt-2"
                                value={sel.desc}
                                onChange={(e) =>
                                  setSelected((s) => ({
                                    ...s,
                                    [c.id]: { ...sel, desc: e.target.value },
                                  }))
                                }
                                placeholder="What will you bring? (optional, e.g. Lasagna)"
                                maxLength={200}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {needsItem && (
                  <p className="text-sm text-amber-700">Please pick at least one item to bring.</p>
                )}
              </div>
            </>
          )}

          {droppingItems && (
            <p className="text-sm text-amber-700">
              Changing to not attending will release your {existingItemCount} item sign-up
              {existingItemCount === 1 ? "" : "s"} so other families can claim them.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onConfirm({
                attending,
                guestCount: attending ? guestCount : 0,
                items: attending ? newItems : [],
                updateItems: attending ? updateItems : [],
                removeItemSignupIds: attending ? removeItemSignupIds : [],
              })
            }
            disabled={loading || needsItem}
          >
            {loading ? "Saving…" : "Save RSVP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
