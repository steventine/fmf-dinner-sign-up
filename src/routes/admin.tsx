import { createFileRoute, Outlet, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminIsAdmin } from "@/lib/admin-read.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const check = useServerFn(adminIsAdmin);
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    check({}).then((r) => {
      if (!r.ok) {
        navigate({ to: "/login" });
      } else {
        setOk(true);
      }
    });
  }, [check, navigate]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  const nav = [
    { to: "/admin/meetings", label: "Meetings" },
    { to: "/admin/students", label: "Students" },
    { to: "/admin/buyouts", label: "Buy-outs" },
    { to: "/admin/banquet", label: "Banquet" },
    { to: "/admin/dinner-notes", label: "Dinner ideas" },
    { to: "/admin/overview", label: "Overview" },
    { to: "/admin/settings", label: "Settings" },
    { to: "/admin/emails", label: "Emails" },
    { to: "/admin/invites", label: "Invites" },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-6">
            <Link to="/admin/meetings" className="text-sm font-semibold tracking-tight">
              FullMetal Falcons Admin
            </Link>
            <nav className="flex flex-wrap gap-1">
              {nav.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground"
                  activeProps={{ className: "active" }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xs text-muted-foreground hover:underline">
              View public page
            </Link>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
