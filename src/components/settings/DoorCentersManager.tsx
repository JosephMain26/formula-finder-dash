import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DoorCenter = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
};

export function DoorCentersManager() {
  const [items, setItems] = useState<DoorCenter[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const { data } = await (supabase as any)
      .from("door_centers")
      .select("*")
      .order("sort_order")
      .order("name");
    setItems((data as DoorCenter[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add() {
    const { error } = await (supabase as any)
      .from("door_centers")
      .insert({ name: "New location" });
    if (error) return toast.error(error.message);
    refresh();
  }

  async function update(id: string, patch: Partial<DoorCenter>) {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function persist(id: string, patch: Partial<DoorCenter>) {
    const { error } = await (supabase as any).from("door_centers").update(patch).eq("id", id);
    if (error) toast.error(error.message);
  }

  async function remove(id: string) {
    if (!confirm("Delete this location?")) return;
    await (supabase as any).from("door_centers").delete().eq("id", id);
    refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Door Center Locations</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Manage pickup locations. When messaging an installer, you can pick one — they'll see the
          name as a tappable link that opens directions in their maps app.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground">No locations yet — add your first one below.</p>
            )}
            {items.map((d) => (
              <div key={d.id} className="border rounded-md p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Input
                    placeholder="Name (e.g. Main Warehouse)"
                    value={d.name}
                    onChange={(e) => update(d.id, { name: e.target.value })}
                    onBlur={(e) => persist(d.id, { name: e.target.value })}
                    className="h-9"
                  />
                  <Input
                    placeholder="Phone"
                    value={d.phone || ""}
                    onChange={(e) => update(d.id, { phone: e.target.value })}
                    onBlur={(e) => persist(d.id, { phone: e.target.value })}
                    className="h-9"
                  />
                  <Input
                    placeholder="Address"
                    value={d.address || ""}
                    onChange={(e) => update(d.id, { address: e.target.value })}
                    onBlur={(e) => persist(d.id, { address: e.target.value })}
                    className="h-9 md:col-span-2"
                  />
                  <Input
                    placeholder="Contact name"
                    value={d.contact_name || ""}
                    onChange={(e) => update(d.id, { contact_name: e.target.value })}
                    onBlur={(e) => persist(d.id, { contact_name: e.target.value })}
                    className="h-9"
                  />
                </div>
                <Textarea
                  placeholder="Notes"
                  value={d.notes || ""}
                  onChange={(e) => update(d.id, { notes: e.target.value })}
                  onBlur={(e) => persist(d.id, { notes: e.target.value })}
                  rows={2}
                />
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>
                    <Trash2 className="h-4 w-4 mr-1 text-destructive" /> Delete
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={add}>
              <Plus className="h-4 w-4 mr-2" /> Add location
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
