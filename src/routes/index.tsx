import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPublicSchedule, requestParentLink } from "@/lib/public.functions";
import { MeetingCalendar } from "@/components/MeetingCalendar";
import { HouseholdStatus, type Household } from "@/components/HouseholdStatus";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { MeetingRow } from "@/lib/calendar";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Full-Metal Falcons Dinner Sign-up" },
      {
        name: "description",
        content: "Sign up to provide dinner at Full-Metal Falcons robotics team meetings.",
      },
    ],
  }),
  component: PublicCalendarPage,
});

function PublicCalendarPage() {
  const fetchSchedule = useServerFn(getPublicSchedule);
  const sendLink = useServerFn(requestParentLink);

  const { data, isLoading } = useQuery({
    queryKey: ["public-schedule"],
    queryFn: () => fetchSchedule(),
  });

  const [email, setEmail] = useState("");
  const [signInOpen, setSignInOpen] = useState(false);
  const linkMutation = useMutation({
    mutationFn: (e: string) => sendLink({ data: { email: e } }),
    onSuccess: () => {
      setEmail("");
      setSignInOpen(false);
      toast.success("If that email is on the roster, a sign-up link is on its way.");
    },
    onError: () => {
      setEmail("");
      setSignInOpen(false);
      toast.success("If that email is on the roster, a sign-up link is on its way.");
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4 px-4 py-8 sm:py-12">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Full-Metal Falcons Robotics</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Team Dinner Sign-up</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base my-[9px]">
              Please bring your dinner to Xavier at 6pm. Dinner should include a main entree; a side or dessert is nice
              but optional. Some possible main entrees include Illiano’s pizza, Big Y sandwiches or pizza, and homemade
              dishes (grilled chicken, pasta, hot dogs, tacos, BBQ). You should ask your student to check Slack to see
              how many people have signed up for the meeting, and it is suggested that you bring a little extra as there
              will be people who forget to sign up.
            </p>
          </div>
          <Dialog open={signInOpen} onOpenChange={setSignInOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0">Sign in</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Get your sign-up link</DialogTitle>
                <DialogDescription>
                  Enter the email you gave the team — we'll email you a private link to sign up or manage your family's
                  meals.
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!email.trim()) return;
                  linkMutation.mutate(email.trim());
                }}
              >
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <DialogFooter>
                  <Button type="submit" disabled={linkMutation.isPending}>
                    {linkMutation.isPending ? "Sending…" : "Email me my link"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:py-10">
        {isLoading ? (
          <Card className="p-8 text-center text-muted-foreground">Loading schedule…</Card>
        ) : (
          <Tabs defaultValue="calendar" className="space-y-6">
            <TabsList>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="students">Student summary</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar" className="space-y-6">
              <MeetingCalendar meetings={(data?.meetings ?? []) as MeetingRow[]} />
            </TabsContent>
            <TabsContent value="students" className="space-y-6">
              <HouseholdStatus households={(data?.households ?? []) as Household[]} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
