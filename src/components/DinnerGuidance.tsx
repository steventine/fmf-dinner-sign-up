import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

// The team's standing "what to bring" guidance, edited on /admin/settings and
// rendered from one component so the public page and the parent tab can't drift.
// whitespace-pre-line so an admin can use blank lines without needing Markdown.
// The short form is no longer shown on the site — it feeds the reminder email's
// {{dinner_guidance}} variable instead.

export function DinnerGuidance({ text, children }: { text: string; children?: ReactNode }) {
  if (!text.trim()) return null;
  return (
    <Card className="space-y-3 p-5 sm:p-6">
      <div className="space-y-2">
        <h2 className="text-base font-semibold text-foreground">What to bring</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{text}</p>
      </div>
      {children}
    </Card>
  );
}
