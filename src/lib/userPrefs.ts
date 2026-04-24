import { supabase } from "@/integrations/supabase/client";

const LS_KEY = "user_prefs_cache_v1";

export type UserPrefs = Record<string, any>;

let cache: UserPrefs | null = null;
let loadedForUser: string | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPatch: UserPrefs = {};

function deepMerge(a: any, b: any): any {
  if (b === null || typeof b !== "object" || Array.isArray(b)) return b;
  const out = { ...(a && typeof a === "object" && !Array.isArray(a) ? a : {}) };
  for (const k of Object.keys(b)) {
    out[k] = deepMerge(out?.[k], b[k]);
  }
  return out;
}

function readLS(userId: string): UserPrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${LS_KEY}:${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeLS(userId: string, p: UserPrefs) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`${LS_KEY}:${userId}`, JSON.stringify(p)); } catch {}
}

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function loadUserPrefs(): Promise<UserPrefs> {
  const userId = await getUserId();
  if (!userId) return {};
  // cache hit for same user
  if (cache && loadedForUser === userId) return cache;

  // hydrate immediately from LS so UI doesn't flash
  const ls = readLS(userId);
  if (ls) { cache = ls; loadedForUser = userId; }

  const { data } = await (supabase as any)
    .from("user_preferences").select("prefs").eq("user_id", userId).maybeSingle();
  const remote = (data?.prefs as UserPrefs) || {};
  cache = remote;
  loadedForUser = userId;
  writeLS(userId, remote);
  return remote;
}

/** Get a path like "dashboard.activeViewId" or full prefs if no path. */
export function getPref<T = any>(path?: string): T | undefined {
  if (!cache) return undefined;
  if (!path) return cache as any;
  return path.split(".").reduce<any>((acc, k) => (acc == null ? undefined : acc[k]), cache);
}

/** Debounced upsert that deep-merges `partial` into stored prefs. */
export function saveUserPrefs(partial: UserPrefs) {
  pendingPatch = deepMerge(pendingPatch, partial);
  // optimistic local cache update
  cache = deepMerge(cache || {}, partial);
  if (loadedForUser && cache) writeLS(loadedForUser, cache);

  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(flush, 600);
}

async function flush() {
  pendingTimer = null;
  const patch = pendingPatch;
  pendingPatch = {};
  const userId = await getUserId();
  if (!userId) return;

  // Merge against latest cache before write
  const merged = deepMerge(cache || {}, patch);
  cache = merged;
  loadedForUser = userId;
  writeLS(userId, merged);

  await (supabase as any)
    .from("user_preferences")
    .upsert({ user_id: userId, prefs: merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}

/** Clear in-memory cache (call on sign-out). */
export function resetUserPrefsCache() {
  cache = null;
  loadedForUser = null;
  pendingPatch = {};
  if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
}
