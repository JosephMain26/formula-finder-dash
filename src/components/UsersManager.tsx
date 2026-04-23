import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { AppRole } from "@/lib/auth-context";

type Profile = { id: string; email: string | null; display_name: string | null; created_at: string };
type RoleRow = { user_id: string; role: AppRole };

export function UsersManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole>>({});
  const [seedEmail, setSeedEmail] = useState("");
  const [seeds, setSeeds] = useState<{ email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: r }, { data: s }] = await Promise.all([
      (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("user_roles").select("user_id, role"),
      (supabase as any).from("admin_seed").select("email"),
    ]);
    setProfiles(p || []);
    const map: Record<string, AppRole> = {};
    (r || []).forEach((row: RoleRow) => {
      const cur = map[row.user_id];
      // priority admin > manager > user
      if (!cur || row.role === "admin" || (row.role === "manager" && cur === "user")) map[row.user_id] = row.role;
    });
    setRoles(map);
    setSeeds(s || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function changeRole(userId: string, newRole: AppRole) {
    // delete existing roles for user, then insert new one
    await (supabase as any).from("user_roles").delete().eq("user_id", userId);
    const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) { toast.error(error.message); return; }
    toast.success(`Role updated to ${newRole}`);
    setRoles((prev) => ({ ...prev, [userId]: newRole }));
  }

  async function addSeed() {
    const email = seedEmail.trim().toLowerCase();
    if (!email) return;
    const { error } = await (supabase as any).from("admin_seed").insert({ email });
    if (error) { toast.error(error.message); return; }
    setSeedEmail("");
    toast.success("Pre-seeded admin email added");
    load();
  }

  async function removeSeed(email: string) {
    const { error } = await (supabase as any).from("admin_seed").delete().eq("email", email);
    if (error) { toast.error(error.message); return; }
    toast.success("Removed");
    load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Users</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="border rounded-md divide-y">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.display_name || p.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                  </div>
                  <Select value={roles[p.id] || "user"} onValueChange={(v) => changeRole(p.id, v as AppRole)}>
                    <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground pt-3">
            Roles: <strong>Admin</strong> = full control · <strong>Manager</strong> = edit/delete jobs · <strong>User</strong> = view + add jobs.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pre-seeded Admin Emails</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            When someone signs up with one of these emails, they'll automatically be granted admin role.
          </p>
          <div className="space-y-2">
            {seeds.map((s) => (
              <div key={s.email} className="flex items-center gap-2 border rounded-md p-2">
                <span className="flex-1 text-sm">{s.email}</span>
                <Button variant="ghost" size="icon" onClick={() => removeSeed(s.email)} className="h-9 w-9">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="email@example.com"
              value={seedEmail}
              onChange={(e) => setSeedEmail(e.target.value)}
              className="flex-1 h-9"
            />
            <Button size="sm" onClick={addSeed}><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
