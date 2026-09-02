import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  formatMeetingDate,
  formatWeekLabel,
  groupByWeek,
  isPast,
  type MeetingRow,
} from "@/lib/calendar";
import { cn } from "@/lib/utils";

export type MySignUp = {
  id: string;
  meeting_id: string;
  parent_id: string;
  dinner?: string | null;
};

type Props = {
  meetings: MeetingRow[];
  /** When defined, parent overlay UI is shown. */
  parent?: {
    id: string;
    studentId: string;
    householdName: string;
  };
  mySignUps?: MySignUp[];
  onSignUp?: (meetingId: string) => void;
  onCancel?: (signUpId: string) => void;
  busyMeetingId?: string | null;
};

export function MeetingCalendar({
  meetings,
  parent,
  mySignUps = [],
  onSignUp,
  onCancel,
  busyMeetingId,
}: Props) {
  const [showPast, setShowPast] = useState(false);

  const filtered = useMemo(
    () => (showPast ? meetings : meetings.filter((m) => !isPast(m.date))),
    [meetings, showPast],
  );
  const grouped = useMemo(() => groupByWeek(filtered), [filtered]);

  const mySignUpByMeeting = useMemo(() => {
    const m = new Map<string, MySignUp>();
    for (const s of mySignUps) m.set(s.meeting_id, s);
    return m;
  }, [mySignUps]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Meeting schedule</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={showPast} onCheckedChange={setShowPast} />
          Show past meetings
        </label>
      </div>

      {grouped.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No meetings scheduled yet.</Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ week, items }) => (
            <section key={week}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {formatWeekLabel(week)}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((m) => {
                  const mine = parent && m.student_id === parent.studentId;
                  const taken = !!m.student_id && !mine;
                  const available = !m.student_id;
                  const past = isPast(m.date);
                  const mySignUp = mySignUpByMeeting.get(m.meeting_id);
                  const canCancel =
                    !!parent && !!mySignUp && mySignUp.parent_id === parent.id && !past;
                  const canSignUp = !!parent && available && !past;

                  return (
                    <Card
                      key={m.meeting_id}
                      className={cn(
                        "flex flex-col gap-3 p-4 transition-colors",
                        mine && "border-mine-foreground/30 bg-mine",
                        taken && !mine && "bg-taken",
                        available && "bg-available",
                        past && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-[2px]">
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {formatMeetingDate(m.date)}
                          </div>
                          {m.notes && (
                            <div className="mt-1 text-xs text-muted-foreground">{m.notes}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge
                            mine={!!mine}
                            available={available}
                            householdName={m.household_name}
                          />
                          {m.dinner && (
                            <div className="text-xs font-medium text-foreground">🍽 {m.dinner}</div>
                          )}
                        </div>
                      </div>

                      {parent && !past && (canSignUp || canCancel) && (
                        <div className="flex justify-end">
                          {canSignUp && (
                            <Button
                              size="sm"
                              disabled={busyMeetingId === m.meeting_id}
                              onClick={() => onSignUp?.(m.meeting_id)}
                            >
                              Sign up
                            </Button>
                          )}
                          {canCancel && mySignUp && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyMeetingId === m.meeting_id}
                              onClick={() => onCancel?.(mySignUp.id)}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  mine,
  available,
  householdName,
}: {
  mine: boolean;
  available: boolean;
  householdName: string | null;
}) {
  if (mine) {
    return (
      <Badge className="bg-mine-foreground text-background hover:bg-mine-foreground">
        You're on it
      </Badge>
    );
  }
  if (available) {
    return (
      <Badge className="bg-available-foreground text-background hover:bg-available-foreground">
        Available
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="font-normal">
      {householdName}
    </Badge>
  );
}
