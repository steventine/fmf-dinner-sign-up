import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { cancelSignUp, requestBuyOut, signUpForMeeting } from "@/lib/parent.functions";
import { MeetingCalendar, type MySignUp } from "@/components/MeetingCalendar";
import { BanquetCard } from "@/components/BanquetCard";
import { DinnerIdeasPeek } from "@/components/DinnerIdeas";
import { useDinnerIdeas, type DinnerSource } from "@/hooks/use-dinner-ideas";
import { parentQueryKey, useParentContext } from "@/hooks/use-parent-context";
import type { MeetingRow } from "@/lib/calendar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStatus, statusStyles } from "@/lib/household-status";

export const Route = createFileRoute("/parent/$guid/")({
  component: ParentDinners,
});

function ParentDinners() {
  const { guid } = Route.useParams();
  const signUp = useServerFn(signUpForMeeting);
  const cancel = useServerFn(cancelSignUp);
  const buyOut = useServerFn(requestBuyOut);
  const qc = useQueryClient();

  // The layout already fetched this; the shared key makes it a cache read.
  const { data } = useParentContext(guid);
  const ideas = useDinnerIdeas(guid);
  const queryKey = parentQueryKey(guid);

  const [busyMeetingId, setBusyMeetingId] = useState<string | null>(null);
  const [buyOutOpen, setBuyOutOpen] = useState(false);
  const [dinnerMeetingId, setDinnerMeetingId] = useState<string | null>(null);

  const signUpMut = useMutation({
    mutationFn: ({ meetingId, dinner }: { meetingId: string; dinner: string }) => {
      setBusyMeetingId(meetingId);
      return signUp({ data: { guid, meetingId, dinner } });
    },
    onSuccess: () => {
      toast.success("You're signed up. Thank you!");
      setDinnerMeetingId(null);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusyMeetingId(null),
  });

  const cancelMut = useMutation({
    mutationFn: (signUpId: string) => cancel({ data: { guid, signUpId } }),
    onSuccess: () => {
      toast.success("Sign-up cancelled.");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const buyOutMut = useMutation({
    mutationFn: (dinners: number) => buyOut({ data: { guid, dinners } }),
    onSuccess: () => {
      toast.success("Buy-Out request submitted.");
      setBuyOutOpen(false);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // The layout blocks rendering until this resolves, so it can't be missing here.
  if (!data) return null;

  const { parent, household, progress, meetings, mySignUps } = data;
  const totalWithPending = progress.provided + progress.pending_buyouts;
  const fulfilled = totalWithPending >= progress.required;
  const statusStyle = statusStyles[getStatus(progress)];

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <BanquetCard guid={guid} />

        <Card className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Your family has provided {progress.provided} of {progress.required} required dinners
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Includes dinner sign-ups (including upcoming ones) plus approved buy-outs (money has
                been received by the team).
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyle.badge}`}
            >
              {statusStyle.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>
              {progress.signed_up} dinner sign-up
              {progress.signed_up === 1 ? "" : "s"}
            </span>
            <span aria-hidden>•</span>
            <span>
              {progress.approved_buyouts} approved buy-out
              {progress.approved_buyouts === 1 ? "" : "s"}
            </span>
            {progress.pending_buyouts > 0 && (
              <>
                <span aria-hidden>•</span>
                <span>
                  {progress.pending_buyouts} pending buy-out
                  {progress.pending_buyouts === 1 ? "" : "s"}
                </span>
              </>
            )}
          </div>
          {!fulfilled && (
            <div>
              <Button variant="outline" onClick={() => setBuyOutOpen(true)}>
                Request Dinner Buy-Out option
              </Button>
            </div>
          )}
        </Card>

        <MeetingCalendar
          meetings={meetings as MeetingRow[]}
          parent={{
            id: parent.id,
            studentId: household?.id ?? "",
            householdName: household?.name ?? "",
          }}
          mySignUps={mySignUps as MySignUp[]}
          onSignUp={(id) => setDinnerMeetingId(id)}
          onCancel={(id) => cancelMut.mutate(id)}
          busyMeetingId={busyMeetingId}
        />
      </main>

      <DinnerDialog
        guid={guid}
        meetingId={dinnerMeetingId}
        ideaSources={ideas.data?.sources ?? []}
        onOpenChange={(open) => !open && setDinnerMeetingId(null)}
        onConfirm={(dinner) =>
          dinnerMeetingId && signUpMut.mutate({ meetingId: dinnerMeetingId, dinner })
        }
        loading={signUpMut.isPending}
      />

      <BuyOutDialog
        open={buyOutOpen}
        onOpenChange={setBuyOutOpen}
        onConfirm={(dinners) => buyOutMut.mutate(dinners)}
        loading={buyOutMut.isPending}
        price={data.buyoutPrice}
        defaultDinners={Math.max(1, progress.required - totalWithPending)}
      />
    </>
  );
}

function BuyOutDialog({
  open,
  onOpenChange,
  onConfirm,
  loading,
  price,
  defaultDinners,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (dinners: number) => void;
  loading: boolean;
  price: number;
  defaultDinners: number;
}) {
  const [dinners, setDinners] = useState(defaultDinners);
  // Keep the input in sync with the latest default whenever the dialog
  // opens or the underlying requirement changes while it's closed.
  useEffect(() => {
    setDinners(defaultDinners);
  }, [defaultDinners, open]);
  const total = (Number(price) || 0) * dinners;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a Buy-Out</DialogTitle>
          <DialogDescription>
            Choose how many dinners you'd like to buy out. Please bring cash or a check payable to
            'Xavier High School' to Mr. Gammons at the next robotics meeting. Your buy-out will be
            in a pending state until we receive the actual payment.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="bo-dinners">Number of dinners</Label>
          <Input
            id="bo-dinners"
            type="number"
            min={1}
            max={20}
            value={dinners}
            onChange={(e) => setDinners(Math.max(1, parseInt(e.target.value || "1", 10)))}
          />
          <p className="text-sm text-muted-foreground">
            {dinners} × ${Number(price).toFixed(2)} = <strong>${total.toFixed(2)}</strong>
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Never mind
          </Button>
          <Button onClick={() => onConfirm(dinners)} disabled={loading || dinners < 1}>
            {loading ? "Submitting…" : "Confirm Buy-Out request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DinnerDialog({
  guid,
  meetingId,
  ideaSources,
  onOpenChange,
  onConfirm,
  loading,
}: {
  guid: string;
  meetingId: string | null;
  ideaSources: DinnerSource[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (dinner: string) => void;
  loading: boolean;
}) {
  const [dinner, setDinner] = useState("");
  const open = !!meetingId;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setDinner("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What dinner will you bring?</DialogTitle>
          <DialogDescription>
            Let everyone know what's on the menu (e.g. Pizza, Chick-fil-A, Lasagna).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="dinner">Dinner</Label>
          <Input
            id="dinner"
            value={dinner}
            onChange={(e) => setDinner(e.target.value)}
            placeholder="e.g. Pizza"
            autoFocus
            maxLength={120}
          />
          <DinnerIdeasPeek guid={guid} sources={ideaSources} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(dinner.trim())}
            disabled={loading || dinner.trim().length === 0}
          >
            {loading ? "Signing up…" : "Confirm sign-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
