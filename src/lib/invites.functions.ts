import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const InviteSchema = z.object({
  email: z.string().email().max(254),
  role: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const email = data.email.trim().toLowerCase();

    // Validate role exists (built-in or custom)
    const builtIn = new Set(["admin", "manager", "user"]);
    if (!builtIn.has(data.role)) {
      const { data: custom } = await (supabaseAdmin as any)
        .from("custom_roles")
        .select("name")
        .eq("name", data.role)
        .maybeSingle();
      if (!custom) throw new Error(`Unknown role: ${data.role}`);
    }

    const token = crypto.randomUUID().replace(/-/g, "");

    // Upsert invite (delete prior open invite for same email first)
    await (supabaseAdmin as any)
      .from("pending_invites")
      .delete()
      .ilike("email", email)
      .is("accepted_at", null);

    const { error: insertErr } = await (supabaseAdmin as any)
      .from("pending_invites")
      .insert({
        email,
        role: data.role,
        invited_by: userId,
        token,
      });
    if (insertErr) throw new Error(insertErr.message);

    // Send the auth invite email — Supabase will route through the auth-email-hook
    const { error: emailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (emailErr) throw new Error(emailErr.message);

    return { success: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const email = data.email.trim().toLowerCase();

    // Refresh expiry
    await (supabaseAdmin as any)
      .from("pending_invites")
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .ilike("email", email)
      .is("accepted_at", null);

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const email = data.email.trim().toLowerCase();
    const { error } = await (supabaseAdmin as any)
      .from("pending_invites")
      .delete()
      .ilike("email", email)
      .is("accepted_at", null);
    if (error) throw new Error(error.message);
    return { success: true };
  });
