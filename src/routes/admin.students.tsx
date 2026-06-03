import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminListStudents,
  adminCreateStudent,
  adminUpdateStudent,
  adminDeleteStudent,
  adminCreateParent,
  adminUpdateParent,
  adminDeleteParent,
} from "@/lib/admin.functions";
import { adminGetSettings, adminResendParentLink } from "@/lib/admin-read.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/students")({
  component: AdminStudents,
});

function AdminStudents() {
  const qc = useQueryClient();
  const list = useServerFn(adminListStudents);
  const create = useServerFn(adminCreateStudent);
  const update = useServerFn(adminUpdateStudent);
  const del = useServerFn(adminDeleteStudent);
  const addParent = useServerFn(adminCreateParent);
  const editParent = useServerFn(adminUpdateParent);
  const removeParent = useServerFn(adminDeleteParent);
  const resend = useServerFn(adminResendParentLink);

  const getSettings = useServerFn(adminGetSettings);

  const { data: students, isLoading } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => list({}),
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => getSettings({}),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-students"] });

  const [newName, setNewName] = useState("");
  const [newRequired, setNewRequired] = useState<string>("");

  useEffect(() => {
    if (settings?.default_dinners_required != null && newRequired === "") {
      setNewRequired(settings.default_dinners_required.toString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const createStudent = useMutation({
    mutationFn: (input: { name: string; dinners_required: number | null }) => create({ data: input }),
    onSuccess: () => {
      invalidate();
      setNewName("");
      setNewRequired(settings?.default_dinners_required?.toString() ?? "");
      toast.success("Student added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Students & Parents</h1>
        <p className="text-sm text-muted-foreground">
          Students with their assigned parents and magic-link URLs. Enter the student as Last Name, First Name (Smith,
          John). For families with more than one student, create only one entry which includes all the student names
          (Jones, John and Bill).
        </p>
      </div>

      <Card className="p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            createStudent.mutate({
              name: newName.trim(),
              dinners_required: newRequired ? parseInt(newRequired, 10) : null,
            });
          }}
        >
          <div className="flex-1 space-y-1 min-w-[220px]">
            <Label htmlFor="sn">Student name</Label>
            <Input
              id="sn"
              placeholder="Smith, John"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1 w-32">
            <Label htmlFor="sr">Dinners required</Label>
            <Input
              id="sr"
              type="number"
              min={0}
              value={newRequired}
              onChange={(e) => setNewRequired(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={createStudent.isPending}>
            Add student
          </Button>
        </form>
      </Card>

      {isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading…</Card>
      ) : (
        <div className="space-y-3">
          {(students ?? []).map((s) => (
            <StudentRow
              key={s.id}
              student={s}
              onUpdate={async (patch) => {
                try {
                  await update({ data: { id: s.id, ...patch } });
                  invalidate();
                  toast.success("Saved");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              onDelete={async () => {
                if (!confirm(`Delete ${s.name} and all linked parents?`)) return;
                try {
                  await del({ data: { id: s.id } });
                  invalidate();
                  toast.success("Deleted");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              onAddParent={async (input) => {
                try {
                  await addParent({ data: { student_id: s.id, ...input } });
                  invalidate();
                  toast.success("Parent added");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              onEditParent={async (id, patch) => {
                try {
                  await editParent({ data: { id, ...patch } });
                  invalidate();
                  toast.success("Saved");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              onRemoveParent={async (id) => {
                if (!confirm("Remove this parent?")) return;
                try {
                  await removeParent({ data: { id } });
                  invalidate();
                  toast.success("Removed");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
              onResend={async (id) => {
                try {
                  await resend({ data: { parentId: id } });
                  toast.success("Link emailed");
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Student = Awaited<ReturnType<typeof import("@/lib/admin.functions").adminListStudents>>[number];

function StudentRow({
  student,
  onUpdate,
  onDelete,
  onAddParent,
  onEditParent,
  onRemoveParent,
  onResend,
}: {
  student: Student;
  onUpdate: (p: { name?: string; dinners_required?: number | null }) => void;
  onDelete: () => void;
  onAddParent: (p: { name: string; email: string }) => void;
  onEditParent: (id: string, p: { name?: string; email?: string }) => void;
  onRemoveParent: (id: string) => void;
  onResend: (id: string) => void;
}) {
  const [name, setName] = useState(student.name);
  const [req, setReq] = useState<string>(student.dinners_required?.toString() ?? "");
  const [pName, setPName] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 space-y-1 min-w-[200px]">
          <Label className="text-xs">Student name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1 w-32">
          <Label className="text-xs">Dinners required</Label>
          <Input type="number" min={0} placeholder="default" value={req} onChange={(e) => setReq(e.target.value)} />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onUpdate({ name, dinners_required: req ? parseInt(req, 10) : null })}
        >
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          {open ? "Hide" : "Manage"} parents ({student.parents?.length ?? 0})
        </Button>
        <Button size="sm" variant="outline" onClick={onDelete}>
          Delete
        </Button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 border-t pt-4">
          {(student.parents ?? []).map((p) => (
            <ParentRow
              key={p.id}
              parent={p}
              onSave={(patch) => onEditParent(p.id, patch)}
              onRemove={() => onRemoveParent(p.id)}
              onResend={() => onResend(p.id)}
            />
          ))}
          <form
            className="flex flex-wrap items-end gap-2 rounded-md bg-muted/50 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!pName.trim() || !pEmail.trim()) return;
              onAddParent({ name: pName.trim(), email: pEmail.trim() });
              setPName("");
              setPEmail("");
            }}
          >
            <Input
              placeholder="Parent name"
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              className="w-40"
            />
            <Input
              type="email"
              placeholder="email@example.com"
              value={pEmail}
              onChange={(e) => setPEmail(e.target.value)}
              className="w-60"
            />
            <Button size="sm" type="submit">
              Add parent
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}

function ParentRow({
  parent,
  onSave,
  onRemove,
  onResend,
}: {
  parent: NonNullable<Student["parents"]>[number];
  onSave: (p: { name?: string; email?: string }) => void;
  onRemove: () => void;
  onResend: () => void;
}) {
  const [name, setName] = useState(parent.name);
  const [email, setEmail] = useState(parent.email);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/parent/${parent.unique_guid}`
      : `/parent/${parent.unique_guid}`;

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} className="w-40" />
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-60" />
        <Button size="sm" variant="outline" onClick={() => onSave({ name, email })}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onResend}>
          Email link
        </Button>
        <Button size="sm" variant="outline" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <code className="flex-1 truncate rounded bg-muted px-2 py-1">{url}</code>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(url);
            toast.success("Copied");
          }}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}
