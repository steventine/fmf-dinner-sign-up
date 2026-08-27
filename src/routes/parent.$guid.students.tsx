import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSchedule } from "@/lib/public.functions";
import { HouseholdStatus, type Household } from "@/components/HouseholdStatus";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/parent/$guid/students")({
  component: ParentStudents,
});

function ParentStudents() {
  // Same source the public page reads — this is already public information, so
  // there's no parent-specific variant to build.
  const fetchSchedule = useServerFn(getPublicSchedule);
  const { data, isLoading } = useQuery({
    queryKey: ["public-schedule"],
    queryFn: () => fetchSchedule({}),
  });

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">Loading summary…</Card>
      ) : (
        <HouseholdStatus households={(data?.households ?? []) as Household[]} />
      )}
    </main>
  );
}
