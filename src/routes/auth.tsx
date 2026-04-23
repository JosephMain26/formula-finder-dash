import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const REMEMBER_KEY = "lovable.rememberMe";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in - Jobs Dashboard" },
      { name: "description", content: "Sign in or create your account" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem(REMEMBER_KEY);
    return saved === null ? true : saved === "1";
  });

  function applyRememberFlag(remember: boolean) {
    if (typeof window === "undefined") return;
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
    if (remember) {
      sessionStorage.removeItem("lovable.ephemeral");
    } else {
      sessionStorage.setItem("lovable.ephemeral", "1");
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    applyRememberFlag(rememberMe);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/" });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: displayName.trim() || email.split("@")[0] },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account created — signing you in…");
    // Auto-confirm is on, so session should be set
    navigate({ to: "/" });
  }

  async function handleGoogle() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Jobs Dashboard</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4 space-y-4">
              <form onSubmit={handleSignIn} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="si-email">Email</Label>
                  <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="si-pw">Password</Label>
                  <Input id="si-pw" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="si-remember"
                    checked={rememberMe}
                    onCheckedChange={(v) => setRememberMe(v === true)}
                  />
                  <Label htmlFor="si-remember" className="text-sm font-normal cursor-pointer">
                    Remember me
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign In"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-4 space-y-4">
              <form onSubmit={handleSignUp} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="su-name">Name</Label>
                  <Input id="su-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-email">Email</Label>
                  <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="su-pw">Password</Label>
                  <Input id="su-pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating account…" : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
