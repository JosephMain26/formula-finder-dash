import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "manager" | "user";

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isAdmin: boolean;
  isManager: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRole(userId: string) {
    const { data } = await (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (!data || data.length === 0) {
      setRole("user");
      return;
    }
    const roles = data.map((r: any) => r.role as AppRole);
    if (roles.includes("admin")) setRole("admin");
    else if (roles.includes("manager")) setRole("manager");
    else setRole("user");
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadRole(sess.user.id), 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadRole(sess.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
  }

  async function refreshRole() {
    if (user) await loadRole(user.id);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        role,
        isAdmin: role === "admin",
        isManager: role === "manager" || role === "admin",
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
