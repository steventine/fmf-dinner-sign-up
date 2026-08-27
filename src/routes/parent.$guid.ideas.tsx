import { createFileRoute } from "@tanstack/react-router";
import { DinnerIdeas } from "@/components/DinnerIdeas";

export const Route = createFileRoute("/parent/$guid/ideas")({
  component: ParentIdeas,
});

function ParentIdeas() {
  const { guid } = Route.useParams();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <DinnerIdeas guid={guid} />
    </main>
  );
}
