import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "user" | string;

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roles: AppRole[];
  displayName: string | null;
  permissions: Set<string>;
  isAdmin: boolean;
  isManager: boolean;
  can: (key: string) => boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

function deriveDisplayName(u: User | null, profileName?: string | null): string | null {
  if (!u) return null;
  if (profileName && profileName.trim()) return profileName.trim();
  const meta: any = u.user_metadata || {};
  const fromMeta = meta.full_name || meta.name;
  if (fromMeta && String(fromMeta).trim()) return String(fromMeta).trim();
  const email = u.email || "";
  const local = email.split("@")[0] || "";
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  async function loadRoleAndPerms(userId: string) {
    const { data: roleRows } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    const userRoles: AppRole[] = (roleRows || []).map((r: any) => r.role as AppRole);
    if (userRoles.length === 0) userRoles.push("user");
    setRoles(userRoles);

    // Priority for primary role display
    if (userRoles.includes("admin")) setRole("admin");
    else if (userRoles.includes("manager")) setRole("manager");
    else setRole(userRoles[0] || "user");

    // Load permissions for these roles
    if (userRoles.includes("admin")) {
      // Admin: load all permission keys (so can() returns true for everything)
      const { data: allPerms } = await (supabase as any).from("permissions").select("key");
      const set = new Set<string>((allPerms || []).map((p: any) => p.key));
      setPermissions(set);
    } else {
      const { data: rp } = await (supabase as any)
        .from("role_permissions")
        .select("permission_key")
        .in("role_name", userRoles);
      setPermissions(new Set<string>((rp || []).map((r: any) => r.permission_key)));
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadRoleAndPerms(sess.user.id), 0);
      } else {
        setRole(null);
        setRoles([]);
        setPermissions(new Set());
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadRoleAndPerms(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    // "Remember me" off → sign out when tab closes
    const handleUnload = () => {
      if (typeof window !== "undefined" && sessionStorage.getItem("lovable.ephemeral") === "1") {
        try {
          supabase.auth.signOut();
        } catch {
          // ignore
        }
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleUnload);
    }

    return () => {
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleUnload);
      }
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
    setRoles([]);
    setPermissions(new Set());
  }

  async function refreshRole() {
    if (user) await loadRoleAndPerms(user.id);
  }

  const isAdmin = role === "admin" || roles.includes("admin");

  function can(key: string) {
    if (isAdmin) return true;
    return permissions.has(key);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        roles,
        permissions,
        isAdmin,
        isManager: isAdmin || roles.includes("manager"),
        can,
        loading,
        signOut,
        refreshRole,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
