// Dinner ideas: crowd-sourced notes about what to bring to a meeting, grouped by
// source (a restaurant you order from, or a dish you make at home).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getParentByGuid, requireAdminUserId } from "./dinners.server";

const GuidSchema = z.string().uuid();
const KindSchema = z.enum(["restaurant", "homemade"]);

// Parents type "$94" or "94.00" — accept either and store a number.
const CostSchema = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : null;
  });

const NoteFieldsSchema = {
  body: z.string().trim().min(1).max(4000),
  servedCount: z.coerce.number().int().min(1).max(500).nullish(),
  totalCost: CostSchema,
};

const ContactSchema = {
  phone: z.string().trim().max(40).nullish(),
  website: z.string().trim().max(300).nullish(),
  orderLeadTime: z.string().trim().max(80).nullish(),
  delivers: z.boolean().nullish(),
};

type SourceRow = {
  id: string;
  kind: "restaurant" | "homemade";
  name: string;
  phone: string | null;
  website: string | null;
  order_lead_time: string | null;
  delivers: boolean | null;
};

type NoteRow = {
  id: string;
  source_id: string;
  parent_id: string | null;
  body: string;
  served_count: number | null;
  total_cost: string | number | null;
  created_at: string;
  parents: { name: string } | { name: string }[] | null;
};

function authorName(note: NoteRow): string {
  const parent = Array.isArray(note.parents) ? note.parents[0] : note.parents;
  if (!parent?.name) return "FullMetal Falcons";
  // "Sarah Tine" -> "Sarah T." Keeps notes personal without publishing full names.
  const [first, ...rest] = parent.name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

// Shared shape builder: sources with their visible notes, vote counts, and which
// notes this viewer has already voted on.
async function buildIdeas(viewerParentId: string | null) {
  const [{ data: sources, error: srcErr }, { data: notes, error: noteErr }, { data: votes }] =
    await Promise.all([
      supabaseAdmin
        .from("dinner_sources")
        .select("id, kind, name, phone, website, order_lead_time, delivers"),
      supabaseAdmin
        .from("dinner_notes")
        // The FK is named explicitly because dinner_note_votes also joins notes to
        // parents, which makes a bare parents(...) embed ambiguous to PostgREST.
        .select(
          "id, source_id, parent_id, body, served_count, total_cost, created_at, parents!dinner_notes_parent_id_fkey(name)",
        )
        .is("hidden_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("dinner_note_votes").select("note_id, parent_id"),
    ]);
  if (srcErr) throw new Error(srcErr.message);
  if (noteErr) throw new Error(noteErr.message);

  const voteCounts = new Map<string, number>();
  const myVotes = new Set<string>();
  for (const v of votes ?? []) {
    voteCounts.set(v.note_id, (voteCounts.get(v.note_id) ?? 0) + 1);
    if (viewerParentId && v.parent_id === viewerParentId) myVotes.add(v.note_id);
  }

  const notesBySource = new Map<string, ReturnType<typeof shapeNote>[]>();
  function shapeNote(n: NoteRow) {
    return {
      id: n.id,
      body: n.body,
      servedCount: n.served_count,
      totalCost: n.total_cost === null ? null : Number(n.total_cost),
      createdAt: n.created_at,
      author: authorName(n),
      votes: voteCounts.get(n.id) ?? 0,
      votedByMe: myVotes.has(n.id),
      mine: !!viewerParentId && n.parent_id === viewerParentId,
    };
  }
  for (const n of (notes ?? []) as NoteRow[]) {
    const list = notesBySource.get(n.source_id) ?? [];
    list.push(shapeNote(n));
    notesBySource.set(n.source_id, list);
  }

  // Best note first within a source; then most-documented source first.
  return ((sources ?? []) as SourceRow[])
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      name: s.name,
      phone: s.phone,
      website: s.website,
      orderLeadTime: s.order_lead_time,
      delivers: s.delivers,
      notes: (notesBySource.get(s.id) ?? []).sort(
        (a, b) => b.votes - a.votes || b.createdAt.localeCompare(a.createdAt),
      ),
    }))
    .filter((s) => s.notes.length > 0)
    .sort((a, b) => b.notes.length - a.notes.length || a.name.localeCompare(b.name));
}

/* ------------------------------- Parent ------------------------------- */

export const getDinnerIdeas = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ guid: GuidSchema }).parse(input))
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    return { sources: await buildIdeas(parent.id) };
  });

// Find-or-create by (lower(name), kind). The unique index is the source of truth:
// on a concurrent insert we lose the race, catch 23505, and re-read the winner.
async function resolveSourceId(
  kind: "restaurant" | "homemade",
  name: string,
  parentId: string | null,
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("dinner_sources")
    .select("id")
    .eq("kind", kind)
    .ilike("name", name)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("dinner_sources")
    .insert({ kind, name, created_by_parent_id: parentId })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: winner } = await supabaseAdmin
        .from("dinner_sources")
        .select("id")
        .eq("kind", kind)
        .ilike("name", name)
        .single();
      if (winner) return winner.id;
    }
    throw new Error(error.message);
  }
  return created.id;
}

export const postDinnerNote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        guid: GuidSchema,
        kind: KindSchema,
        sourceId: z.string().uuid().optional(),
        sourceName: z.string().trim().min(1).max(120).optional(),
        ...NoteFieldsSchema,
      })
      .refine((v) => v.sourceId || v.sourceName, {
        message: "Pick a restaurant or dish, or add a new one.",
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const sourceId =
      data.sourceId ?? (await resolveSourceId(data.kind, data.sourceName!, parent.id));

    const { error } = await supabaseAdmin.from("dinner_notes").insert({
      source_id: sourceId,
      parent_id: parent.id,
      body: data.body,
      served_count: data.servedCount ?? null,
      total_cost: data.totalCost,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Ownership is enforced in the update predicate rather than a prior read, so a
// guessed note id can never touch another household's note.
export const updateDinnerNote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ guid: GuidSchema, noteId: z.string().uuid(), ...NoteFieldsSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const { data: updated, error } = await supabaseAdmin
      .from("dinner_notes")
      .update({
        body: data.body,
        served_count: data.servedCount ?? null,
        total_cost: data.totalCost,
      })
      .eq("id", data.noteId)
      .eq("parent_id", parent.id)
      .select("id");
    if (error) throw new Error(error.message);
    if (!updated?.length) throw new Error("That note isn't yours to edit.");
    return { ok: true };
  });

export const toggleDinnerNoteVote = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ guid: GuidSchema, noteId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);

    const { data: existing } = await supabaseAdmin
      .from("dinner_note_votes")
      .select("note_id")
      .eq("note_id", data.noteId)
      .eq("parent_id", parent.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("dinner_note_votes")
        .delete()
        .eq("note_id", data.noteId)
        .eq("parent_id", parent.id);
      if (error) throw new Error(error.message);
      return { voted: false };
    }

    const { error } = await supabaseAdmin
      .from("dinner_note_votes")
      .insert({ note_id: data.noteId, parent_id: parent.id });
    // Double-click race: the vote already landed, which is the state we wanted.
    if (error && error.code !== "23505") throw new Error(error.message);
    return { voted: true };
  });

// Contact details are community-maintained: whoever notices a wrong number fixes it.
export const updateDinnerSourceContact = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ guid: GuidSchema, sourceId: z.string().uuid(), ...ContactSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await getParentByGuid(data.guid);

    const { data: source } = await supabaseAdmin
      .from("dinner_sources")
      .select("kind")
      .eq("id", data.sourceId)
      .single();
    if (source?.kind !== "restaurant") {
      throw new Error("Only restaurants have contact details.");
    }

    const { error } = await supabaseAdmin
      .from("dinner_sources")
      .update({
        phone: data.phone || null,
        website: data.website || null,
        order_lead_time: data.orderLeadTime || null,
        delivers: data.delivers ?? null,
      })
      .eq("id", data.sourceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------------------- Admin -------------------------------- */

export const adminListDinnerNotes = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();

  const [{ data: notes, error }, { data: votes }] = await Promise.all([
    supabaseAdmin
      .from("dinner_notes")
      .select(
        "id, body, served_count, total_cost, created_at, hidden_at, parents!dinner_notes_parent_id_fkey(name, email), dinner_sources(id, kind, name, phone, website, order_lead_time, delivers)",
      )
      .order("created_at", { ascending: false }),
    supabaseAdmin.from("dinner_note_votes").select("note_id"),
  ]);
  if (error) throw new Error(error.message);

  const voteCounts = new Map<string, number>();
  for (const v of votes ?? []) voteCounts.set(v.note_id, (voteCounts.get(v.note_id) ?? 0) + 1);

  return {
    notes: (notes ?? []).map((n) => {
      const parent = Array.isArray(n.parents) ? n.parents[0] : n.parents;
      const source = Array.isArray(n.dinner_sources) ? n.dinner_sources[0] : n.dinner_sources;
      return {
        id: n.id,
        body: n.body,
        servedCount: n.served_count,
        totalCost: n.total_cost === null ? null : Number(n.total_cost),
        createdAt: n.created_at,
        hidden: !!n.hidden_at,
        authorName: parent?.name ?? "FullMetal Falcons",
        authorEmail: parent?.email ?? null,
        source: source ?? null,
        votes: voteCounts.get(n.id) ?? 0,
      };
    }),
  };
});

export const adminSetDinnerNoteHidden = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ noteId: z.string().uuid(), hidden: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    const userId = await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("dinner_notes")
      .update({
        hidden_at: data.hidden ? new Date().toISOString() : null,
        hidden_by: data.hidden ? userId : null,
      })
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdateDinnerNote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ noteId: z.string().uuid(), ...NoteFieldsSchema }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("dinner_notes")
      .update({
        body: data.body,
        served_count: data.servedCount ?? null,
        total_cost: data.totalCost,
      })
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteDinnerNote = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ noteId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin.from("dinner_notes").delete().eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListDinnerSources = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data, error } = await supabaseAdmin
    .from("dinner_sources")
    .select("id, kind, name, phone, website, order_lead_time, delivers, dinner_notes(id)")
    .order("name");
  if (error) throw new Error(error.message);

  return {
    sources: (data ?? []).map((s) => ({
      id: s.id,
      kind: s.kind as "restaurant" | "homemade",
      name: s.name,
      phone: s.phone,
      website: s.website,
      orderLeadTime: s.order_lead_time,
      delivers: s.delivers,
      noteCount: Array.isArray(s.dinner_notes) ? s.dinner_notes.length : 0,
    })),
  };
});

export const adminUpdateDinnerSource = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        sourceId: z.string().uuid(),
        name: z.string().trim().min(1).max(120),
        ...ContactSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("dinner_sources")
      .update({
        name: data.name,
        phone: data.phone || null,
        website: data.website || null,
        order_lead_time: data.orderLeadTime || null,
        delivers: data.delivers ?? null,
      })
      .eq("id", data.sourceId);
    if (error) {
      if (error.code === "23505") throw new Error("Another entry already uses that name.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

// Merging fixes the inevitable "Dominos" / "Domino's" split: notes and their votes
// move to the surviving row, then the duplicate goes away.
export const adminMergeDinnerSources = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({ fromSourceId: z.string().uuid(), intoSourceId: z.string().uuid() })
      .refine((v) => v.fromSourceId !== v.intoSourceId, { message: "Pick two different entries." })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();

    const { data: rows, error: readErr } = await supabaseAdmin
      .from("dinner_sources")
      .select("id, kind")
      .in("id", [data.fromSourceId, data.intoSourceId]);
    if (readErr) throw new Error(readErr.message);
    if ((rows ?? []).length !== 2) throw new Error("One of those entries no longer exists.");
    if (rows![0].kind !== rows![1].kind) {
      throw new Error("A restaurant and a homemade dish can't be merged.");
    }

    const { error: moveErr } = await supabaseAdmin
      .from("dinner_notes")
      .update({ source_id: data.intoSourceId })
      .eq("source_id", data.fromSourceId);
    if (moveErr) throw new Error(moveErr.message);

    const { error: delErr } = await supabaseAdmin
      .from("dinner_sources")
      .delete()
      .eq("id", data.fromSourceId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

// Deleting a source cascades to its notes — the admin page warns before calling this.
export const adminDeleteDinnerSource = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ sourceId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin.from("dinner_sources").delete().eq("id", data.sourceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Team-authored seed content: same table, no parent_id, renders as "FullMetal Falcons".
export const adminPostDinnerNote = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        kind: KindSchema,
        sourceName: z.string().trim().min(1).max(120),
        ...NoteFieldsSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const sourceId = await resolveSourceId(data.kind, data.sourceName, null);
    const { error } = await supabaseAdmin.from("dinner_notes").insert({
      source_id: sourceId,
      parent_id: null,
      body: data.body,
      served_count: data.servedCount ?? null,
      total_cost: data.totalCost,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
