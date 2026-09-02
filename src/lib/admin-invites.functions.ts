import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminUserId } from "./dinners.server";

export const adminListInvites = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdminUserId();
  const { data, error } = await supabaseAdmin
    .from("admin_email_allowlist")
    .select("email, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminAddInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email().max(255) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("admin_email_allowlist")
      .insert({ email: data.email.toLowerCase() });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveInvite = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email().max(255) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("admin_email_allowlist")
      .delete()
      .eq("email", data.email.toLowerCase());
    if (error) throw new Error(error.message);
    return { ok: true };
  });
