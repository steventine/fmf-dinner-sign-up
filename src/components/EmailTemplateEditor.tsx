import { useMemo } from "react";
import { marked } from "marked";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface Props {
  subject: string;
  onSubjectChange: (value: string) => void;
  markdownBody: string;
  onMarkdownBodyChange: (value: string) => void;
  availableVariables: string[];
  sampleVariables: Record<string, string>;
}

function substituteVariables(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? vars[name] : match,
  );
}

function markdownToPreviewHtml(markdown: string, vars: Record<string, string>): string {
  const body = marked.parse(substituteVariables(markdown, vars)) as string;
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;line-height:1.5}a{color:#1e3a8a}</style></head><body>${body}</body></html>`;
}

export function EmailTemplateEditor({
  subject,
  onSubjectChange,
  markdownBody,
  onMarkdownBodyChange,
  availableVariables,
  sampleVariables,
}: Props) {
  const previewSubject = useMemo(
    () => substituteVariables(subject, sampleVariables),
    [subject, sampleVariables],
  );
  const previewHtml = useMemo(
    () => markdownToPreviewHtml(markdownBody, sampleVariables),
    [markdownBody, sampleVariables],
  );

  return (
    <div className="space-y-4">
      {availableVariables.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {availableVariables.map((v) => (
            <Badge key={v} variant="secondary" className="font-mono text-xs">
              {`{{${v}}}`}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="et-subject">Subject</Label>
          <Input
            id="et-subject"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
          <Label htmlFor="et-body">Body (Markdown)</Label>
          <Textarea
            id="et-body"
            value={markdownBody}
            onChange={(e) => onMarkdownBodyChange(e.target.value)}
            className="min-h-[340px] font-mono text-sm"
            placeholder="Write your email in Markdown…"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Preview</Label>
            <span className="text-xs text-muted-foreground">Sample values substituted</span>
          </div>
          <div className="flex h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm">
            <span className="text-xs text-muted-foreground">Subject:&nbsp;</span>
            <span className="font-medium">{previewSubject}</span>
          </div>
          {/* Invisible spacer matching the "Body (Markdown)" label height so the iframe aligns with the textarea */}
          <Label className="pointer-events-none opacity-0" aria-hidden="true">
            Body
          </Label>
          <iframe
            title="Email preview"
            srcDoc={previewHtml}
            sandbox=""
            className="h-[340px] w-full rounded-md border border-border bg-white"
          />
        </div>
      </div>
    </div>
  );
}
