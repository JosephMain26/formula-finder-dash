import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  renderTemplate,
  TEMPLATE_VARIABLES,
  type MessageTemplate,
  type RecipientType,
  type MessageChannel,
} from "@/lib/messageTemplates";

const SAMPLE_VARS: Record<string, string> = {
  client_name: "John Doe",
  address: "123 Main St, Springfield",
  phone: "+15551234567",
  job_date: "12/4/2025",
  job_time: "10:30",
  job_type: "Door installation",
  comp_type: "Insurance",
  price: "$450.00",
  deposit_amount: "$100.00",
  deposit_date: "12/1/2025",
  scheduled_completion_date: "12/4/2025",
  completed_at_date: "",
  tech_name: "Mike",
  installer_name: "Sam",
  marketer: "ACME Co",
  po_number: "PO-991",
  notes: "Side entrance",
  status: "Scheduled",
};

const emptyTpl = (): Partial<MessageTemplate> => ({
  name: "",
  recipient_type: "installer" as RecipientType,
  channel_default: "whatsapp" as MessageChannel,
  body: "",
  is_active: true,
});

export function MessageTemplatesManager() {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<MessageTemplate> | null>(null);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  async function refresh() {
    setLoading(true);
    setTemplates(await listTemplates());
    setLoading(false);
  }

  useEffect(() => { refresh(); }, []);

  function insertVar(key: string) {
    const ta = bodyRef.current;
    const token = `{{${key}}}`;
    if (!ta) {
      setEditing((p) => ({ ...p!, body: (p?.body || "") + token }));
      return;
    }
    const start = ta.selectionStart ?? (editing?.body?.length || 0);
    const end = ta.selectionEnd ?? start;
    const cur = editing?.body || "";
    const next = cur.slice(0, start) + token + cur.slice(end);
    setEditing((p) => ({ ...p!, body: next }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + token.length;
    });
  }

  async function onSave() {
    if (!editing?.name?.trim() || !editing.body?.trim()) {
      toast.error("Name and body are required");
      return;
    }
    setSaving(true);
    try {
      await saveTemplate(editing);
      toast.success("Template saved");
      setEditing(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this template?")) return;
    try {
      await deleteTemplate(id);
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  }

  const preview = editing?.body ? renderTemplate(editing.body, SAMPLE_VARS) : "";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Message Templates</CardTitle>
        {!editing && (
          <Button size="sm" onClick={() => setEditing(emptyTpl())}>
            <Plus className="h-4 w-4 mr-1" /> New template
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Build reusable messages for your installers, technicians, marketers, and clients. Use{" "}
          <code className="text-xs">{`{{variable}}`}</code> to insert dynamic job values.
        </p>

        {!editing && (
          <>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet — add your first one above.</p>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div key={t.id} className="border rounded-md p-3 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm flex items-center gap-2 flex-wrap">
                        <span>{t.name}</span>
                        <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                          {t.recipient_type}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                          {t.channel_default}
                        </span>
                        {!t.is_active && (
                          <span className="text-[10px] uppercase bg-destructive/10 text-destructive rounded px-1.5 py-0.5">inactive</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{t.body}</div>
                    </div>
                    <div className="flex gap-1 sm:flex-col sm:items-end">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(t.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {editing && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name *</label>
                <Input
                  value={editing.name || ""}
                  onChange={(e) => setEditing((p) => ({ ...p!, name: e.target.value }))}
                  placeholder="e.g. Installer scheduling"
                  maxLength={120}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Recipient</label>
                <Select
                  value={editing.recipient_type || "installer"}
                  onValueChange={(v) => setEditing((p) => ({ ...p!, recipient_type: v as RecipientType }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technician">Technician</SelectItem>
                    <SelectItem value="installer">Installer</SelectItem>
                    <SelectItem value="marketer">Marketer</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="custom">Custom / Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Default channel</label>
                <Select
                  value={editing.channel_default || "whatsapp"}
                  onValueChange={(v) => setEditing((p) => ({ ...p!, channel_default: v as MessageChannel }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp link</SelectItem>
                    <SelectItem value="sms">SMS (Twilio)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 sm:justify-end pt-5">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing((p) => ({ ...p!, is_active: v }))}
                  id="tpl-active"
                />
                <label htmlFor="tpl-active" className="text-sm cursor-pointer">Active</label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Message body *</label>
                <Textarea
                  ref={bodyRef}
                  rows={8}
                  value={editing.body || ""}
                  onChange={(e) => setEditing((p) => ({ ...p!, body: e.target.value }))}
                  placeholder={"Hi {{installer_name}}, please install {{job_type}} at {{address}} on {{scheduled_completion_date}}."}
                  maxLength={1600}
                />
                <div className="text-xs">
                  <div className="font-medium text-muted-foreground mb-1">Preview (with sample data):</div>
                  <div className="rounded-md border bg-background p-2 whitespace-pre-wrap min-h-[3rem]">{preview}</div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Insert variable</label>
                <div className="mt-1 border rounded-md p-2 max-h-72 overflow-auto space-y-1 bg-background">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVar(v.key)}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted"
                    >
                      <code>{`{{${v.key}}}`}</code>
                      <span className="text-muted-foreground ml-2">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save template"}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
