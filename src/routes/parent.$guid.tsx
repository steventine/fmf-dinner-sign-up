import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { useParentContext } from "@/hooks/use-parent-context";

export const Route = createFileRoute("/parent/$guid")({
  head: () => ({
    meta: [
      { title: "Your Dinner Sign-up — FullMetal Falcons" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParentLayout,
});

const tabClass =
  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground";

function ParentLayout() {
  const { guid } = Route.useParams();
  const { data, isLoading, error } = useParentContext(guid);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading your dashboard…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">This link isn't valid</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The link you used isn't recognized. If you think this is a mistake, ask the team to
            resend you a fresh link.
          </p>
        </Card>
      </div>
    );
  }

  const { parent, household } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl px-4 pt-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Welcome, {parent.name}
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {household?.name ?? "Your household"}
          </h1>
          <nav className="mt-6 flex flex-wrap gap-1 pb-2">
            <Link
              to="/parent/$guid"
              params={{ guid }}
              activeOptions={{ exact: true }}
              activeProps={{ className: "active" }}
              className={tabClass}
            >
              Your dinners
            </Link>
            <Link
              to="/parent/$guid/ideas"
              params={{ guid }}
              activeProps={{ className: "active" }}
              className={tabClass}
            >
              Dinner ideas
            </Link>
          </nav>
        </div>
      </header>

      <Outlet />
    </div>
  );
}
