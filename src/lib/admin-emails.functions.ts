import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdminUserId } from "./dinners.server";
import { renderAndSendTemplate } from "./email.server";

// Sample values used for the "send test" button and the live preview.
const SAMPLE_VARIABLES: Record<string, string> = {
  parent_name: "Sample Parent",
  link_url: "https://example.com/parent/sample-guid",
  meeting_date: "Tuesday, Dec 3",
  student_name: "Sample Student",
  dinner: "Lasagna",
};

export const adminListEmailTemplates = createServerFn({ method: "POST" }).handler(
  async () => {
    await requireAdminUserId();
    const { data, error } = await supabaseAdmin
      .from("email_templates")
      .select("key, name, description, subject, markdown_body, available_variables, updated_at")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const adminUpdateEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(64),
        subject: z.string().min(1).max(500),
        markdown_body: z.string().min(1).max(50000),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const adminId = await requireAdminUserId();
    const { error } = await supabaseAdmin
      .from("email_templates")
      .update({
        subject: data.subject,
        markdown_body: data.markdown_body,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      })
      .eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        key: z.string().min(1).max(64),
        to: z.string().email().max(255),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdminUserId();
    await renderAndSendTemplate({
      key: data.key,
      to: data.to,
      variables: SAMPLE_VARIABLES,
    });
    return { ok: true };
  });

export function getSampleVariables() {
  return SAMPLE_VARIABLES;
}
