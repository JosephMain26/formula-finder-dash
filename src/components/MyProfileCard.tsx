import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  mobile_phone: string | null;
  job_title: string | null;
  timezone: string | null;
  avatar_url: string | null;
};

export function MyProfileCard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    mobile_phone: "",
    job_title: "",
    timezone: "",
    avatar_url: "",
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      const p = (data as ProfileRow) || null;
      setForm({
        first_name: p?.first_name ?? "",
        last_name: p?.last_name ?? "",
        phone: p?.phone ?? "",
        mobile_phone: p?.mobile_phone ?? "",
        job_title: p?.job_title ?? "",
        timezone:
          p?.timezone ??
          (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : ""),
        avatar_url: p?.avatar_url ?? "",
      });
      setLoading(false);
    })();
  }, [user]);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    const display = `${form.first_name} ${form.last_name}`.trim() || null;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        phone: form.phone || null,
        mobile_phone: form.mobile_phone || null,
        job_title: form.job_title || null,
        timezone: form.timezone || null,
        avatar_url: form.avatar_url || null,
        display_name: display,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Sign in to manage your profile.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Contact Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="first_name">First name</Label>
                <Input id="first_name" value={form.first_name} onChange={(e) => update("first_name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="last_name">Last name</Label>
                <Input id="last_name" value={form.last_name} onChange={(e) => update("last_name", e.target.value)} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={user.email ?? ""} disabled />
              </div>
              <div>
                <Label htmlFor="job_title">Job title / Role</Label>
                <Input id="job_title" value={form.job_title} onChange={(e) => update("job_title", e.target.value)} placeholder="e.g. Dispatcher" />
              </div>
              <div>
                <Label htmlFor="phone">Work phone</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1 555 …" />
              </div>
              <div>
                <Label htmlFor="mobile_phone">Mobile / SMS</Label>
                <Input id="mobile_phone" type="tel" value={form.mobile_phone} onChange={(e) => update("mobile_phone", e.target.value)} placeholder="+1 555 …" />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <TimezoneCombobox value={form.timezone} onChange={(v) => update("timezone", v)} />
              </div>
              <div>
                <Label htmlFor="avatar_url">Avatar URL</Label>
                <Input id="avatar_url" value={form.avatar_url} onChange={(e) => update("avatar_url", e.target.value)} placeholder="https://…" />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
