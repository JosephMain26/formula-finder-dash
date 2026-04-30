import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AccessTokenSchema = z.string().min(1).max(4096);

const InviteSchema = z.object({
  accessToken: AccessTokenSchema,
  email: z.string().email().max(254),
  role: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
});

const EmailActionSchema = z.object({
  accessToken: AccessTokenSchema,
  email: z.string().email().max(254),
});

const DeleteUserSchema = z.object({
  accessToken: AccessTokenSchema,
  userId: z.string().uuid(),
});

async function getAdminUserId(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const { data: roleRow, error: roleError } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) throw new Error(roleError.message);
  if (!roleRow) throw new Error("Forbidden: admin only");

  return data.user.id;
}

export const inviteUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InviteSchema.parse(input))
  .handler(async ({ data }) => {
    const userId = await getAdminUserId(data.accessToken);
    const email = data.email.trim().toLowerCase();

    const builtIn = new Set(["admin", "manager", "user"]);
    if (!builtIn.has(data.role)) {
      const { data: custom, error: customError } = await (supabaseAdmin as any)
        .from("custom_roles")
        .select("name")
        .eq("name", data.role)
        .maybeSingle();

      if (customError) throw new Error(customError.message);
      if (!custom) throw new Error(`Unknown role: ${data.role}`);
    }

    const token = crypto.randomUUID().replace(/-/g, "");

    const { error: deleteErr } = await (supabaseAdmin as any)
      .from("pending_invites")
      .delete()
      .ilike("email", email)
      .is("accepted_at", null);
    if (deleteErr) throw new Error(deleteErr.message);

    const { error: insertErr } = await (supabaseAdmin as any)
      .from("pending_invites")
      .insert({
        email,
        role: data.role,
        invited_by: userId,
        token,
      });
    if (insertErr) throw new Error(insertErr.message);

    const { error: emailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (emailErr) throw new Error(emailErr.message);

    return { success: true };
  });

export const resendInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailActionSchema.parse(input))
  .handler(async ({ data }) => {
    await getAdminUserId(data.accessToken);

    const email = data.email.trim().toLowerCase();
    const { error: updateError } = await (supabaseAdmin as any)
      .from("pending_invites")
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .ilike("email", email)
      .is("accepted_at", null);
    if (updateError) throw new Error(updateError.message);

    const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email);
    if (error) throw new Error(error.message);

    return { success: true };
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EmailActionSchema.parse(input))
  .handler(async ({ data }) => {
    await getAdminUserId(data.accessToken);

    const email = data.email.trim().toLowerCase();
    const { error } = await (supabaseAdmin as any)
      .from("pending_invites")
      .delete()
      .ilike("email", email)
      .is("accepted_at", null);
    if (error) throw new Error(error.message);

    return { success: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DeleteUserSchema.parse(input))
  .handler(async ({ data }) => {
    // Resolve caller
    const { data: caller, error: callerErr } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (callerErr || !caller.user) throw new Error("Your session has expired. Please sign in again.");
    const callerId = caller.user.id;

    if (callerId === data.userId) throw new Error("You cannot delete your own account.");

    // Permission check via has_permission (admin short-circuits inside the function)
    const { data: allowed, error: permErr } = await (supabaseAdmin as any)
      .rpc("has_permission", { _user_id: callerId, _key: "users.delete" });
    if (permErr) throw new Error(permErr.message);
    if (!allowed) throw new Error("Forbidden: missing 'users.delete' permission");

    // Prevent deleting the last admin
    const { data: targetRoles } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const targetIsAdmin = (targetRoles || []).some((r: any) => r.role === "admin");
    if (targetIsAdmin) {
      const { count } = await (supabaseAdmin as any)
        .from("user_roles")
        .select("user_id", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) throw new Error("Cannot delete the last remaining admin.");
    }

    await (supabaseAdmin as any).from("user_roles").delete().eq("user_id", data.userId);
    await (supabaseAdmin as any).from("user_preferences").delete().eq("user_id", data.userId);

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);

    return { success: true };
  });
