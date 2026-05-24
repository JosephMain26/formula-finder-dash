import { supabase } from "@/integrations/supabase/client";

const KEY = "job_type_groups";

// Map of compTypeName -> array of job type names
export type TypeGroups = Record<string, string[]>;

export async function loadTypeGroups(): Promise<TypeGroups> {
  const { data } = await (supabase as any)
    .from("app_settings")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  const g = data?.value?.groups;
  return g && typeof g === "object" ? (g as TypeGroups) : {};
}

export async function saveTypeGroups(groups: TypeGroups) {
  await (supabase as any).from("app_settings").upsert({
    key: KEY,
    value: { groups },
    updated_at: new Date().toISOString(),
  });
}

/**
 * Filter job types by selected comp type. If the comp type has no mapping
 * (or comp type is empty), all job types are returned (backward compatible).
 */
export function filterJobTypesByComp<T extends { name: string }>(
  jobTypes: T[],
  compType: string | null | undefined,
  groups: TypeGroups
): T[] {
  if (!compType) return jobTypes;
  const allowed = groups[compType];
  if (!allowed || allowed.length === 0) return jobTypes;
  const set = new Set(allowed);
  return jobTypes.filter((jt) => set.has(jt.name));
}
