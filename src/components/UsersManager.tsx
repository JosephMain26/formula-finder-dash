import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Send, RotateCw, X, Lock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { inviteUser, resendInvite, cancelInvite, deleteUser } from "@/lib/invites.functions";
import { useAuth, type AppRole } from "@/lib/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { loadDataVisibility, saveDataVisibility } from "@/lib/settings";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  mobile_phone: string | null;
  job_title: string | null;
  timezone: string | null;
  notes: string | null;
  created_at: string;
};
type RoleRow = { user_id: string; role: AppRole };
type PendingInvite = { id: string; email: string; role: string; created_at: string; expires_at: string };
type Permission = { key: string; label: string };

const BUILT_IN_ROLES = ["admin", "manager", "tech", "user"];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "statusText" in error && typeof (error as { statusText?: unknown }).statusText === "string") {
    return (error as { statusText: string }).statusText || fallback;
  }
  return fallback;
}

export function UsersManager() {
  const { session, user: currentUser, can } = useAuth();
  const canDeleteUsers = can("users.delete");
  const [deletingProfile, setDeletingProfile] = useState<Profile | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole>>({});
  const [seedEmail, setSeedEmail] = useState("");
  const [seeds, setSeeds] = useState<{ email: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Invites
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviteSending, setInviteSending] = useState(false);
  const [pending, setPending] = useState<PendingInvite[]>([]);

  // Roles & permissions
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [customRoles, setCustomRoles] = useState<{ name: string }[]>([]);
  const [rolePerms, setRolePerms] = useState<Record<string, Set<string>>>({});
  const [newRoleName, setNewRoleName] = useState("");

  // Data visibility
  const [shareAcrossUsers, setShareAcrossUsers] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  useEffect(() => {
    loadDataVisibility().then((v) => setShareAcrossUsers(v.shareAcrossUsers)).catch(() => {});
  }, []);
  async function toggleShareAcrossUsers(next: boolean) {
    setShareAcrossUsers(next);
    setSavingVisibility(true);
    try {
      await saveDataVisibility({ shareAcrossUsers: next });
      toast.success(next ? "All users can now see each other's data" : "Users now see only their own data");
    } catch (e) {
      setShareAcrossUsers(!next);
      toast.error(getErrorMessage(e, "Failed to update setting"));
    } finally {
      setSavingVisibility(false);
    }
  }

  // Edit profile dialog (admin)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: "", last_name: "", phone: "", mobile_phone: "",
    job_title: "", timezone: "", notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (editingProfile) {
      setEditForm({
        first_name: editingProfile.first_name || "",
        last_name: editingProfile.last_name || "",
        phone: editingProfile.phone || "",
        mobile_phone: editingProfile.mobile_phone || "",
        job_title: editingProfile.job_title || "",
        timezone: editingProfile.timezone || "",
        notes: editingProfile.notes || "",
      });
    }
  }, [editingProfile]);

  async function saveProfileEdit() {
    if (!editingProfile) return;
    setSavingEdit(true);
    const display = `${editForm.first_name} ${editForm.last_name}`.trim() || null;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        first_name: editForm.first_name || null,
        last_name: editForm.last_name || null,
        phone: editForm.phone || null,
        mobile_phone: editForm.mobile_phone || null,
        job_title: editForm.job_title || null,
        timezone: editForm.timezone || null,
        notes: editForm.notes || null,
        display_name: display,
      })
      .eq("id", editingProfile.id);
    setSavingEdit(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    setEditingProfile(null);
    load();
  }

  const inviteFn = useServerFn(inviteUser);
  const resendFn = useServerFn(resendInvite);
  const cancelFn = useServerFn(cancelInvite);
  const deleteFn = useServerFn(deleteUser);

  const allRoles = [...BUILT_IN_ROLES, ...customRoles.map((c) => c.name)];

  async function load() {
    setLoading(true);
    const [
      { data: p },
      { data: r },
      { data: s },
      { data: inv },
      { data: perms },
      { data: cust },
      { data: rp },
    ] = await Promise.all([
      (supabase as any).from("profiles").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("user_roles").select("user_id, role"),
      (supabase as any).from("admin_seed").select("email"),
      (supabase as any)
        .from("pending_invites")
        .select("id, email, role, created_at, expires_at")
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
      (supabase as any).from("permissions").select("key, label").order("key"),
      (supabase as any).from("custom_roles").select("name").order("name"),
      (supabase as any).from("role_permissions").select("role_name, permission_key"),
    ]);

    setProfiles(p || []);
    const map: Record<string, AppRole> = {};
    (r || []).forEach((row: RoleRow) => {
      const cur = map[row.user_id];
      if (!cur || row.role === "admin" || (row.role === "manager" && cur === "user")) map[row.user_id] = row.role;
    });
    setRoles(map);
    setSeeds(s || []);
    setPending(inv || []);
    setPermissions(perms || []);
    setCustomRoles(cust || []);

    const rpMap: Record<string, Set<string>> = {};
    (rp || []).forEach((row: any) => {
      if (!rpMap[row.role_name]) rpMap[row.role_name] = new Set();
      rpMap[row.role_name].add(row.permission_key);
    });
    setRolePerms(rpMap);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function changeRole(userId: string, newRole: string) {
    await (supabase as any).from("user_roles").delete().eq("user_id", userId);
    if (!BUILT_IN_ROLES.includes(newRole)) {
      toast.error("Custom roles cannot yet be assigned directly to existing users (enum limitation). Use built-in roles.");
      return;
    }
    const { error } = await (supabase as any).from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Role updated to ${newRole}`);
    setRoles((prev) => ({ ...prev, [userId]: newRole }));
  }

  async function addSeed() {
    const email = seedEmail.trim().toLowerCase();
    if (!email) return;
    const { error } = await (supabase as any).from("admin_seed").insert({ email });
    if (error) {
      toast.error(error.message);
      return;
    }
    setSeedEmail("");
    toast.success("Pre-seeded admin email added");
    load();
  }

  async function removeSeed(email: string) {
    const { error } = await (supabase as any).from("admin_seed").delete().eq("email", email);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Removed");
    load();
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    const accessToken = session?.access_token;
    if (!email) return;
    if (!accessToken) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }
    setInviteSending(true);
    try {
      await inviteFn({ data: { accessToken, email, role: inviteRole } });
      toast.success(`Invite sent to ${email}`);
      setInviteEmail("");
      load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to send invite"));
    } finally {
      setInviteSending(false);
    }
  }

  async function resend(email: string) {
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }
    try {
      await resendFn({ data: { accessToken, email } });
      toast.success("Invite resent");
      load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to resend"));
    }
  }

  async function cancel(email: string) {
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }
    try {
      await cancelFn({ data: { accessToken, email } });
      toast.success("Invite cancelled");
      load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to cancel"));
    }
  }

  async function confirmDeleteUser() {
    if (!deletingProfile) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error("Your session has expired. Please sign in again.");
      return;
    }
    setDeleteSubmitting(true);
    try {
      await deleteFn({ data: { accessToken, userId: deletingProfile.id } });
      toast.success("User deleted");
      setDeletingProfile(null);
      load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, "Failed to delete user"));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function addCustomRole() {
    const name = newRoleName.trim().toLowerCase().replace(/\s+/g, "_");
    if (!name) return;
    if (allRoles.includes(name)) {
      toast.error("Role already exists");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(name)) {
      toast.error("Role name: lowercase letters, numbers, _ or - only");
      return;
    }
    const { error } = await (supabase as any).from("custom_roles").insert({ name });
    if (error) { toast.error(error.message); return; }
    setNewRoleName("");
    toast.success(`Role "${name}" added`);
    load();
  }

  async function removeCustomRole(name: string) {
    const { error } = await (supabase as any).from("custom_roles").delete().eq("name", name);
    if (error) { toast.error(error.message); return; }
    // Also clear its permissions
    await (supabase as any).from("role_permissions").delete().eq("role_name", name);
    toast.success("Role removed");
    load();
  }

  // ------------- Permissions matrix -------------
  async function togglePerm(roleName: string, permKey: string, checked: boolean) {
    if (roleName === "admin") return; // locked
    if (checked) {
      const { error } = await (supabase as any)
        .from("role_permissions")
        .insert({ role_name: roleName, permission_key: permKey });
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await (supabase as any)
        .from("role_permissions")
        .delete()
        .eq("role_name", roleName)
        .eq("permission_key", permKey);
      if (error) { toast.error(error.message); return; }
    }
    setRolePerms((prev) => {
      const next = { ...prev };
      const set = new Set(next[roleName] || []);
      if (checked) set.add(permKey);
      else set.delete(permKey);
      next[roleName] = set;
      return next;
    });
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="space-y-6">
      {/* DATA VISIBILITY */}
      <Card>
        <CardHeader><CardTitle>Data Visibility</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 rounded-md border p-3">
            <div className="min-w-0">
              <Label className="text-sm">Allow all users to see each other's data</Label>
              <p className="text-xs text-muted-foreground mt-1">
                When OFF (default), each technician only sees jobs assigned to them (matched by their linked technician name).
                Admins always see everything. You can also grant the <span className="font-medium">View all users' jobs</span> permission to specific roles in the matrix below.
              </p>
            </div>
            <Switch checked={shareAcrossUsers} disabled={savingVisibility} onCheckedChange={toggleShareAcrossUsers} className="shrink-0" />
          </div>
        </CardContent>
      </Card>

      {/* INVITES */}
      <Card>
        <CardHeader><CardTitle>Invite Users</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
            <Input
              type="email"
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full sm:flex-1 sm:min-w-[180px] h-9"
            />
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="flex-1 sm:w-40 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUILT_IN_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={sendInvite} disabled={inviteSending || !inviteEmail.trim()} size="sm" className="shrink-0">
                <Send className="h-4 w-4 mr-1" /> {inviteSending ? "Sending…" : "Send invite"}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            They'll get a magic-link email. Clicking it signs them in and assigns the chosen role automatically.
          </p>

          {pending.length > 0 && (
            <div className="border rounded-md divide-y">
              {pending.map((inv) => (
                <div key={inv.id} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{inv.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {inv.role} · sent {timeAgo(inv.created_at)} · expires {new Date(inv.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2 sm:gap-1">
                    <Button variant="ghost" size="sm" onClick={() => resend(inv.email)} className="h-8">
                      <RotateCw className="h-3 w-3 mr-1" /> Resend
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => cancel(inv.email)} className="h-8 text-destructive">
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* USERS */}
      <Card>
        <CardHeader><CardTitle>Users</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <div className="border rounded-md divide-y">
              {profiles.map((p) => {
                const fullName =
                  [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
                  p.display_name ||
                  p.email ||
                  "—";
                return (
                  <div key={p.id} className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 p-3">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="text-sm font-medium break-words">{fullName}</div>
                      <div className="text-xs text-muted-foreground break-all">
                        {p.email}
                        {p.job_title ? ` · ${p.job_title}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Select value={roles[p.id] || "user"} onValueChange={(v) => changeRole(p.id, v)}>
                        <SelectTrigger className="flex-1 sm:w-32 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BUILT_IN_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => setEditingProfile(p)} className="h-9 shrink-0">
                        <Pencil className="h-4 w-4 mr-1" /> Edit
                      </Button>
                      {canDeleteUsers && currentUser?.id !== p.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingProfile(p)}
                          title="Delete user"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROLES & PERMISSIONS */}
      <Card>
        <CardHeader><CardTitle>Roles & Permissions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="New role name (e.g. accountant)"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              className="flex-1 h-9"
            />
            <Button size="sm" onClick={addCustomRole} className="shrink-0 whitespace-nowrap"><Plus className="h-4 w-4 mr-1" /> Add role</Button>
          </div>

          <p className="text-xs text-muted-foreground sm:hidden">Scroll horizontally to see all roles →</p>

          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-1.5 sm:p-2 font-medium sticky left-0 bg-muted/50 z-10">Permission</th>
                  {allRoles.map((r) => (
                    <th key={r} className="text-center p-1.5 sm:p-2 font-medium capitalize min-w-[88px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="flex items-center gap-1">
                          {r}
                          {r === "admin" && <Lock className="h-3 w-3 text-muted-foreground" />}
                        </span>
                        {!BUILT_IN_ROLES.includes(r) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => removeCustomRole(r)}
                            title="Delete role"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr key={perm.key} className="border-t">
                    <td className="p-1.5 sm:p-2 sticky left-0 bg-background z-10">{perm.label}</td>
                    {allRoles.map((r) => {
                      const checked = r === "admin" || (rolePerms[r]?.has(perm.key) ?? false);
                      const locked = r === "admin";
                      return (
                        <td key={r} className="p-1.5 sm:p-2 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={checked}
                              disabled={locked}
                              onCheckedChange={(v) => togglePerm(r, perm.key, !!v)}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Admin always has every permission (locked). Toggle checkboxes to grant/revoke for other roles.
          </p>
        </CardContent>
      </Card>

      {/* PRE-SEEDED ADMINS */}
      <Card>
        <CardHeader><CardTitle>Pre-seeded Admin Emails</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            When someone signs up with one of these emails, they'll automatically be granted admin role.
          </p>
          <div className="space-y-2">
            {seeds.map((s) => (
              <div key={s.email} className="flex items-center gap-2 border rounded-md p-2">
                <span className="flex-1 min-w-0 text-sm truncate">{s.email}</span>
                <Button variant="ghost" size="icon" onClick={() => removeSeed(s.email)} className="h-9 w-9 shrink-0">
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
            <Button size="sm" onClick={addSeed} className="shrink-0"><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* EDIT PROFILE DIALOG (admin) */}
      <Dialog open={!!editingProfile} onOpenChange={(o) => !o && setEditingProfile(null)}>
        <DialogContent className="max-w-lg w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit user — {editingProfile?.email}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={editForm.first_name} onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={editForm.last_name} onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div>
              <Label>Job title</Label>
              <Input value={editForm.job_title} onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))} />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={editForm.timezone} onChange={(e) => setEditForm((f) => ({ ...f, timezone: e.target.value }))} />
            </div>
            <div>
              <Label>Work phone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Mobile / SMS</Label>
              <Input value={editForm.mobile_phone} onChange={(e) => setEditForm((f) => ({ ...f, mobile_phone: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Admin notes (only visible to admins)</Label>
              <Textarea rows={3} value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProfile(null)}>Cancel</Button>
            <Button onClick={saveProfileEdit} disabled={savingEdit}>{savingEdit ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE USER CONFIRM */}
      <AlertDialog open={!!deletingProfile} onOpenChange={(o) => !o && !deleteSubmitting && setDeletingProfile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes{" "}
              <span className="font-medium">
                {deletingProfile?.display_name || deletingProfile?.email || "this user"}
              </span>{" "}
              and their role assignments. Their existing jobs and other records will remain. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmDeleteUser(); }}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting ? "Deleting…" : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
