import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveSeasonYear, getParentByGuid, requireAdminUserId } from "./dinners.server";
import {
  DEFAULT_BANQUET_CATEGORIES,
  formatBanquetDate,
  getActiveBanquet,
  getBanquetCategories,
  getClaimedItems,
} from "./banquet.server";
import { renderEmailHtml, renderTemplateString, sendEmailBatchViaResend } from "./email.server";

const GuidSchema = z.string().uuid();

const BanquetDetailsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().trim().max(60).optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

async function categoriesWithClaimed(banquetId: string) {
  const [categories, claimedItems] = await Promise.all([
    getBanquetCategories(banquetId),
    getClaimedItems(banquetId),
  ]);
  return categories.map((c) => ({
    ...c,
    claimed: claimedItems.get(c.id)?.length ?? 0,
    items: claimedItems.get(c.id) ?? [],
  }));
}

// Claim items via the capacity-enforcing RPC; returns category ids that were full.
async function claimItems(
  rsvpId: string,
  items: { categoryId: string; itemDescription?: string }[],
): Promise<string[]> {
  const failedCategories: string[] = [];
  for (const item of items) {
    const { error } = await supabaseAdmin.rpc("claim_banquet_item", {
      _category_id: item.categoryId,
      _rsvp_id: rsvpId,
      _item_description: item.itemDescription?.trim() || null,
    });
    if (error) {
      if (error.message.includes("CATEGORY_FULL")) {
        failedCategories.push(item.categoryId);
      } else {
        throw new Error(error.message);
      }
    }
  }
  return failedCategories;
}

/* ------------------------------- Admin ------------------------------- */

export const adminGetBanquet = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const banquet = await getActiveBanquet();
  if (!banquet) return { banquet: null, categories: [], rsvps: [] };

  const categories = await categoriesWithClaimed(banquet.id);

  const { data: rsvps, error } = await supabaseAdmin
    .from("banquet_rsvps")
    .select(
      "id, attending, guest_count, created_at, updated_at, students(name), parents(name), banquet_item_signups(id, item_description, category_id)",
    )
    .eq("banquet_id", banquet.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return { banquet, categories, rsvps: rsvps ?? [] };
});

export const adminCreateBanquet = createServerFn({ method: "POST" })
  .inputValidator((input) => BanquetDetailsSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const season = getActiveSeasonYear();
    const { data: banquet, error } = await supabaseAdmin
      .from("banquets")
      .insert({
        season_year: season,
        date: data.date,
        time: data.time || null,
        location: data.location || null,
        notes: data.notes || null,
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("A banquet already exists for this season.");
      }
      throw new Error(error.message);
    }

    const { error: catErr } = await supabaseAdmin.from("banquet_item_categories").insert(
      DEFAULT_BANQUET_CATEGORIES.map((c, i) => ({
        banquet_id: banquet.id,
        name: c.name,
        description: c.description,
        capacity: c.capacity,
        sort_order: i,
      })),
    );
    if (catErr) throw new Error(catErr.message);
    return { ok: true };
  });

export const adminUpdateBanquet = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    BanquetDetailsSchema.extend({ banquetId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("banquets")
      .update({
        date: data.date,
        time: data.time || null,
        location: data.location || null,
        notes: data.notes || null,
      })
      .eq("id", data.banquetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteBanquet = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ banquetId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    // Categories, RSVPs, and item sign-ups all cascade-delete with the banquet.
    const { error } = await supabaseAdmin.from("banquets").delete().eq("id", data.banquetId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpsertCategory = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        banquetId: z.string().uuid(),
        categoryId: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(100),
        description: z.string().trim().max(300),
        capacity: z.number().int().min(0).max(999),
        sortOrder: z.number().int().min(0).max(999),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const row = {
      name: data.name,
      description: data.description,
      capacity: data.capacity,
      sort_order: data.sortOrder,
    };
    const result = data.categoryId
      ? await supabaseAdmin.from("banquet_item_categories").update(row).eq("id", data.categoryId)
      : await supabaseAdmin
          .from("banquet_item_categories")
          .insert({ ...row, banquet_id: data.banquetId });
    if (result.error) {
      if (result.error.code === "23505") {
        throw new Error("A category with that name already exists.");
      }
      throw new Error(result.error.message);
    }
    return { ok: true };
  });

export const adminDeleteCategory = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ categoryId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { count, error: cntErr } = await supabaseAdmin
      .from("banquet_item_signups")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.categoryId);
    if (cntErr) throw new Error(cntErr.message);
    if (count && count > 0) {
      throw new Error(
        "This category has item sign-ups. Remove those sign-ups first, then delete the category.",
      );
    }
    const { error } = await supabaseAdmin
      .from("banquet_item_categories")
      .delete()
      .eq("id", data.categoryId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteRsvp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ rsvpId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    // Item signups cascade-delete, releasing the slots.
    const { error } = await supabaseAdmin.from("banquet_rsvps").delete().eq("id", data.rsvpId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSendBanquetInvites = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ banquetId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { data: banquet, error: bErr } = await supabaseAdmin
      .from("banquets")
      .select("id, date, time, location, notes")
      .eq("id", data.banquetId)
      .single();
    if (bErr) throw new Error(bErr.message);

    const { data: rsvps, error: rErr } = await supabaseAdmin
      .from("banquet_rsvps")
      .select("student_id")
      .eq("banquet_id", banquet.id);
    if (rErr) throw new Error(rErr.message);
    const respondedStudents = new Set((rsvps ?? []).map((r) => r.student_id));

    const { data: parents, error: pErr } = await supabaseAdmin
      .from("parents")
      .select("id, name, email, unique_guid, student_id")
      .order("name");
    if (pErr) throw new Error(pErr.message);

    const { data: settings } = await supabaseAdmin
      .from("settings")
      .select("app_url")
      .eq("id", 1)
      .single();
    const appUrl = settings?.app_url ?? "";
    const banquetDate = formatBanquetDate(banquet.date);

    const { data: tpl, error: tErr } = await supabaseAdmin
      .from("email_templates")
      .select("subject, markdown_body")
      .eq("key", "banquet_invitation")
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!tpl) throw new Error("Email template not found: banquet_invitation");

    const recipients = (parents ?? []).filter((p) => !respondedStudents.has(p.student_id));
    if (!recipients.length) return { sent: 0, failed: 0 };

    const emails = recipients.map((parent) => {
      const variables: Record<string, string> = {
        parent_name: parent.name,
        banquet_date: banquetDate,
        banquet_time: banquet.time ?? "",
        banquet_location: banquet.location ?? "",
        banquet_notes: banquet.notes ?? "",
        link_url: `${appUrl}/parent/${parent.unique_guid}`,
      };
      return {
        to: parent.email,
        subject: renderTemplateString(tpl.subject, variables),
        html: renderEmailHtml(tpl.markdown_body, variables),
      };
    });

    const results = await sendEmailBatchViaResend(emails);

    await supabaseAdmin.from("email_send_log").insert(
      recipients.map((parent, i) => ({
        template_key: "banquet_invitation",
        parent_id: parent.id,
        triggered_by: "admin",
        status: results[i].status,
        error_message: results[i].errorMessage,
        resend_email_id: results[i].emailId,
      })),
    );

    const sent = results.filter((r) => r.status === "sent").length;
    return { sent, failed: results.length - sent };
  });

/* ------------------------------- Parent ------------------------------- */

export const getParentBanquet = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ guid: GuidSchema }).parse(input))
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const banquet = await getActiveBanquet();
    if (!banquet) return { banquet: null, categories: [], myRsvp: null, myItems: [] };

    const categories = await categoriesWithClaimed(banquet.id);

    const { data: myRsvp, error: rErr } = await supabaseAdmin
      .from("banquet_rsvps")
      .select("id, attending, guest_count")
      .eq("banquet_id", banquet.id)
      .eq("student_id", parent.student_id)
      .maybeSingle();
    if (rErr) throw new Error(rErr.message);

    let myItems: { id: string; category_id: string; item_description: string | null }[] = [];
    if (myRsvp) {
      const { data: items, error: iErr } = await supabaseAdmin
        .from("banquet_item_signups")
        .select("id, category_id, item_description")
        .eq("rsvp_id", myRsvp.id);
      if (iErr) throw new Error(iErr.message);
      myItems = items ?? [];
    }

    return { banquet, categories, myRsvp, myItems };
  });

export const submitBanquetRsvp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        guid: GuidSchema,
        attending: z.boolean(),
        guestCount: z.number().int().min(0).max(30),
        items: z
          .array(
            z.object({
              categoryId: z.string().uuid(),
              itemDescription: z.string().trim().max(200).optional(),
            }),
          )
          .max(20)
          .default([]),
        updateItems: z
          .array(
            z.object({
              itemSignupId: z.string().uuid(),
              itemDescription: z.string().trim().max(200).optional(),
            }),
          )
          .max(20)
          .default([]),
        removeItemSignupIds: z.array(z.string().uuid()).max(20).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const banquet = await getActiveBanquet();
    if (!banquet) throw new Error("There is no banquet to RSVP for right now.");

    const { data: existing, error: exErr } = await supabaseAdmin
      .from("banquet_rsvps")
      .select("id, banquet_item_signups(id)")
      .eq("banquet_id", banquet.id)
      .eq("student_id", parent.student_id)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);

    // Updates and removals may only reference the household's own item sign-ups.
    const existingItemIds = new Set((existing?.banquet_item_signups ?? []).map((s) => s.id));
    for (const id of [
      ...data.removeItemSignupIds,
      ...data.updateItems.map((u) => u.itemSignupId),
    ]) {
      if (!existingItemIds.has(id)) throw new Error("Item sign-up not found");
    }

    const remainingItemCount = existingItemIds.size - data.removeItemSignupIds.length;
    if (data.attending && remainingItemCount + data.items.length === 0) {
      throw new Error("Please pick at least one item to bring.");
    }

    // Any change invalidates a previously-sent reminder so an updated one goes out.
    const { data: rsvp, error: upErr } = await supabaseAdmin
      .from("banquet_rsvps")
      .upsert(
        {
          banquet_id: banquet.id,
          student_id: parent.student_id,
          parent_id: parent.id,
          attending: data.attending,
          guest_count: data.attending ? data.guestCount : 0,
          reminded_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "banquet_id,student_id" },
      )
      .select("id")
      .single();
    if (upErr) throw new Error(upErr.message);

    if (!data.attending) {
      // Not attending: release any claimed items.
      const { error } = await supabaseAdmin
        .from("banquet_item_signups")
        .delete()
        .eq("rsvp_id", rsvp.id);
      if (error) throw new Error(error.message);
      return { ok: true, failedCategories: [] };
    }

    if (data.removeItemSignupIds.length > 0) {
      const { error } = await supabaseAdmin
        .from("banquet_item_signups")
        .delete()
        .in("id", data.removeItemSignupIds);
      if (error) throw new Error(error.message);
    }

    for (const update of data.updateItems) {
      const { error } = await supabaseAdmin
        .from("banquet_item_signups")
        .update({ item_description: update.itemDescription?.trim() || null })
        .eq("id", update.itemSignupId);
      if (error) throw new Error(error.message);
    }

    const failedCategories = await claimItems(rsvp.id, data.items);
    return { ok: failedCategories.length === 0, failedCategories };
  });

export const releaseBanquetItem = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ guid: GuidSchema, itemSignupId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const parent = await getParentByGuid(data.guid);
    const { data: item, error: iErr } = await supabaseAdmin
      .from("banquet_item_signups")
      .select("id, rsvp_id, banquet_rsvps!inner(id, student_id, attending)")
      .eq("id", data.itemSignupId)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!item) throw new Error("Item sign-up not found");

    const rsvp = Array.isArray(item.banquet_rsvps) ? item.banquet_rsvps[0] : item.banquet_rsvps;
    if (rsvp.student_id !== parent.student_id) {
      throw new Error("You can only remove your own household's items.");
    }

    if (rsvp.attending) {
      const { count, error: cErr } = await supabaseAdmin
        .from("banquet_item_signups")
        .select("id", { count: "exact", head: true })
        .eq("rsvp_id", item.rsvp_id);
      if (cErr) throw new Error(cErr.message);
      if ((count ?? 0) <= 1) {
        throw new Error(
          "Attending households need to bring at least one item. Pick a replacement first, or change your RSVP to not attending.",
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("banquet_item_signups")
      .delete()
      .eq("id", data.itemSignupId);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("banquet_rsvps")
      .update({ reminded_at: null, updated_at: new Date().toISOString() })
      .eq("id", item.rsvp_id);

    return { ok: true };
  });
