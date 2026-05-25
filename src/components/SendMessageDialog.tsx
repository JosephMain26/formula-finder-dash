import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  listTemplates,
  buildJobVariables,
  renderTemplate,
  buildWhatsAppLink,
  logMessageSend,
  type MessageTemplate,
  type RecipientType,
  type MessageChannel,
} from "@/lib/messageTemplates";
import { sendSms } from "@/lib/messages.functions";
import { loadJobInstallations, renderInstallVariables } from "@/lib/installCatalog";

type Job = Tables<"jobs">;

export function SendMessageDialog({
  job,
  open,
  onOpenChange,
}: {
  job: Job | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [recipientType, setRecipientType] = useState<RecipientType>("installer");
  const [templateId, setTemplateId] = useState<string>("");
  const [channel, setChannel] = useState<MessageChannel>("whatsapp");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [clientName, setClientName] = useState<string>("");
  const [installVars, setInstallVars] = useState<Record<string, string>>({});

  const sendSmsFn = useServerFn(sendSms);

  useEffect(() => {
    if (!open || !job) return;
    listTemplates().then((all) => setTemplates(all.filter((t) => t.is_active)));
    if ((job as any).client_id) {
      (supabase as any).from("clients").select("name").eq("id", (job as any).client_id).maybeSingle()
        .then(({ data }: any) => setClientName(data?.name || ""));
    } else {
      setClientName("");
    }
    if (job?.id) {
      loadJobInstallations(job.id).then((list) => setInstallVars(renderInstallVariables(list)));
    } else {
      setInstallVars({});
    }
    setTemplateId("");
    setBody("");
  }, [open, job]);

  // When recipient type changes, prefill name/phone from job
  useEffect(() => {
    if (!job) return;
    const j: any = job;
    if (recipientType === "technician") {
      setRecipientName(j.tech_name || "");
      // Look up technician phone
      if (j.tech_name) {
        supabase.from("technicians").select("phone_number").eq("tech_name", j.tech_name).maybeSingle()
          .then(({ data }: any) => setRecipientPhone(data?.phone_number || ""));
      } else setRecipientPhone("");
    } else if (recipientType === "installer") {
      setRecipientName(j.installer_name || "");
      if (j.installer_id) {
        (supabase as any).from("installers").select("phone_number").eq("id", j.installer_id).maybeSingle()
          .then(({ data }: any) => setRecipientPhone(data?.phone_number || ""));
      } else setRecipientPhone("");
    } else if (recipientType === "marketer") {
      setRecipientName(j.company_1 || "");
      if (j.company_id) {
        supabase.from("companies").select("contact_name,email").eq("id", j.company_id).maybeSingle()
          .then(({ data }: any) => setRecipientName(data?.contact_name || j.company_1 || ""));
      }
      setRecipientPhone("");
    } else if (recipientType === "client") {
      setRecipientName(clientName || "");
      setRecipientPhone(j.phone_no || "");
    } else {
      setRecipientName("");
      setRecipientPhone("");
    }
  }, [recipientType, job, clientName]);

  const filtered = useMemo(
    () => templates.filter((t) => t.recipient_type === recipientType || t.recipient_type === "custom"),
    [templates, recipientType]
  );

  const variables = useMemo(
    () => (job ? buildJobVariables(job as any, { client_name: clientName }) : {}),
    [job, clientName]
  );

  function pickTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setBody(renderTemplate(t.body, variables));
    setChannel(t.channel_default);
  }

  async function handleSend() {
    if (!body.trim()) { toast.error("Message body is empty"); return; }
    if (!recipientPhone.trim()) { toast.error("Recipient phone is required"); return; }
    setSending(true);
    try {
      if (channel === "whatsapp") {
        const url = buildWhatsAppLink(recipientPhone, body);
        window.open(url, "_blank", "noopener,noreferrer");
        await logMessageSend({
          job_id: job?.id || null,
          template_id: templateId || null,
          recipient_type: recipientType,
          recipient_name: recipientName || null,
          recipient_phone: recipientPhone,
          channel: "whatsapp",
          body_rendered: body,
          status: "sent",
        });
        toast.success("WhatsApp opened");
        onOpenChange(false);
      } else {
        const res = await sendSmsFn({ data: { to: recipientPhone, body } });
        await logMessageSend({
          job_id: job?.id || null,
          template_id: templateId || null,
          recipient_type: recipientType,
          recipient_name: recipientName || null,
          recipient_phone: recipientPhone,
          channel: "sms",
          body_rendered: body,
          status: res?.status || "sent",
        });
        toast.success("SMS sent");
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to send");
      await logMessageSend({
        job_id: job?.id || null,
        template_id: templateId || null,
        recipient_type: recipientType,
        recipient_name: recipientName || null,
        recipient_phone: recipientPhone,
        channel,
        body_rendered: body,
        status: "failed",
        error: e?.message || "unknown",
      }).catch(() => {});
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-lg w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Send message</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Recipient type</label>
              <Select value={recipientType} onValueChange={(v) => setRecipientType(v as RecipientType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="installer">Installer</SelectItem>
                  <SelectItem value="marketer">Marketer</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <Select value={templateId} onValueChange={pickTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={filtered.length ? "Pick a template" : "No templates for this recipient"} />
                </SelectTrigger>
                <SelectContent>
                  {filtered.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Recipient name</label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} maxLength={120} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Phone (E.164)</label>
              <Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="+15551234567" maxLength={32} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Channel</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as MessageChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp link (opens in browser)</SelectItem>
                  <SelectItem value="sms">SMS via Twilio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1600} />
            <p className="text-[11px] text-muted-foreground mt-1">
              Variables already filled in. You can edit before sending. {body.length}/1600
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : channel === "whatsapp" ? "Open WhatsApp" : "Send SMS"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
