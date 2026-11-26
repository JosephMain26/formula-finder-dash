import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { canManageW9 } from "./w9";

export const parseW9 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(input))
  .handler(async ({ data, context }) => {
    const [admin, manager] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "manager" }),
    ]);
    if (!canManageW9(admin.data === true, manager.data === true)) throw new Error("Only admins and managers can read W9 forms.");
    if (!/^(company|installer|technician)\//.test(data.path) || data.path.includes("..")) throw new Error("Invalid W9 file.");
    const { data: file, error } = await context.supabase.storage.from("w9-forms").download(data.path);
    if (error || !file) throw new Error("Could not read the W9 file.");
    if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("W9 must be between 1 byte and 10 MB.");
    const { extractW9 } = await import("./w9-ai/extract.server");
    return extractW9(file);
  });