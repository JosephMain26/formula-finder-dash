import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

// Routes that don't require authentication
const PUBLIC_PATHS = ["/auth", "/upload"];

export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isPublic = PUBLIC_PATHS.some((p) => location.pathname === p || location.pathname.startsWith(p + "/"));

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      navigate({ to: "/auth", search: { redirect: location.pathname } as any });
    }
    if (user && location.pathname === "/auth") {
      navigate({ to: "/" });
    }
  }, [user, loading, isPublic, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user && !isPublic) {
    return null;
  }

  return <>{children}</>;
}
