import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AccessTokenSchema = z.string().min(1).max(4096);
const DateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).nullable();

const InputSchema = z.object({
  accessToken: AccessTokenSchema,
  range: DateRangeSchema,
});

type JobRow = Record<string, any>;

async function resolveScope(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const userId = data.user.id;
  const { data: roleRows, error: rolesError } = await (supabaseAdmin as any)
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw new Error(rolesError.message);

  const roles: string[] = (roleRows || []).map((r: any) => String(r.role));
  let canViewAll = roles.includes("admin");

  // Global override
  if (!canViewAll) {
    const { data: visRow } = await (supabaseAdmin as any)
      .from("app_settings")
      .select("value")
      .eq("key", "data_visibility")
      .maybeSingle();
    if (visRow?.value?.shareAcrossUsers === true) canViewAll = true;
  }

  // Per-role permission (jobs.view_all is the new key; databoard.view_all kept for back-compat)
  if (!canViewAll && roles.length) {
    const { data: permRows, error: permsError } = await (supabaseAdmin as any)
      .from("role_permissions")
      .select("permission_key")
      .in("role_name", roles);
    if (permsError) throw new Error(permsError.message);
    canViewAll = (permRows || []).some(
      (r: any) => r.permission_key === "jobs.view_all" || r.permission_key === "databoard.view_all"
    );
  }

  if (canViewAll) {
    return { userId, techName: null as string | null };
  }

  const { data: techRow, error: techError } = await (supabaseAdmin as any)
    .from("technicians")
    .select("tech_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (techError) throw new Error(techError.message);

  return {
    userId,
    techName: techRow?.tech_name ?? null,
  };
}

async function fetchAllJobs(range: z.infer<typeof DateRangeSchema>, techName: string | null) {
  const pageSize = 1000;
  let from = 0;
  const rows: JobRow[] = [];

  while (true) {
    let q = (supabaseAdmin as any)
      .from("jobs")
      .select("*")
      .order("job_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (range) q = q.gte("job_date", range.from).lte("job_date", range.to);
    if (techName) q = q.eq("tech_name", techName);

    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);

    const batch = (data || []) as JobRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows.map((j) => ({
    ...j,
    company: j.company || j.company_1 || null,
  }));
}

export const getDataBoardJobs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const { techName } = await resolveScope(data.accessToken);

    const [jobs, undatedCountResult] = await Promise.all([
      fetchAllJobs(data.range, techName),
      data.range
        ? (async () => {
            let q = (supabaseAdmin as any)
              .from("jobs")
              .select("id", { count: "exact", head: true })
              .is("job_date", null);
            if (techName) q = q.eq("tech_name", techName);
            const { count, error } = await q;
            if (error) throw new Error(error.message);
            return count || 0;
          })()
        : Promise.resolve(0),
    ]);

    return {
      jobs,
      undatedCount: undatedCountResult,
      totalMatched: jobs.length,
      scopeTechName: techName,
      fetchedAt: new Date().toISOString(),
    };
  });