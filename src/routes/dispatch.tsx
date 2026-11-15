import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Send, Sparkles, Plus, Loader2 } from "lucide-react";
import { MobileNav } from "@/components/MobileNav";
import { toast } from "sonner";
import { sendDispatch, agentDraft } from "@/lib/dispatch.functions";

export const Route = createFileRoute("/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch & Messages | Leadz" },
      { name: "description", content: "Two-way SMS and WhatsApp inbox to dispatch leads to technicians and subcontractors with an AI assistant." },
      { property: "og:title", content: "Dispatch & Messages" },
      { property: "og:description", content: "Text and WhatsApp technicians, subcontractors and partner companies from one inbox." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DispatchPage,
});

type Msg = { id: string; phone: string; contact_name: string | null; contact_type: string; direction: string; channel: string; body: string; status: string; error: string | null; created_at: string };
type Contact = { name: string; phone: string; type: string };

function DispatchPage() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState("");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<"sms" | "whatsapp">("sms");
  const [ask, setAsk] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const send = useServerFn(sendDispatch);
  const draft = useServerFn(agentDraft);

  const load = async () => {
    const { data } = await supabase.from("dispatch_messages").select("*").order("created_at", { ascending: true }).limit(1000);
    setMsgs((data as Msg[]) ?? []);
  };
  useEffect(() => {
    load();
    (async () => {
      const [t, i, c] = await Promise.all([
        supabase.from("technicians").select("tech_name, phone_number"),
        supabase.from("installers").select("name, phone_number"),
        supabase.from("companies").select("company_name"),
      ]);
      const list: Contact[] = [];
      t.data?.forEach((r) => r.phone_number && list.push({ name: r.tech_name, phone: r.phone_number, type: "technician" }));
      i.data?.forEach((r) => r.phone_number && list.push({ name: r.name, phone: r.phone_number, type: "subcontractor" }));
      void c;
      setContacts(list);
    })();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const norm = (p: string) => p.replace(/[^\d+]/g, "");
  const threads = useMemo(() => {
    const map = new Map<string, { phone: string; name: string; type: string; last: Msg | null; unread: number }>();
    contacts.forEach((c) => map.set(norm(c.phone), { phone: norm(c.phone), name: c.name, type: c.type, last: null, unread: 0 }));
    msgs.forEach((m) => {
      const k = norm(m.phone);
      const t = map.get(k) ?? { phone: k, name: m.contact_name ?? k, type: m.contact_type, last: null, unread: 0 };
      t.last = m;
      map.set(k, t);
    });
    return [...map.values()]
      .filter((t) => filter === "all" || t.type === filter)
      .sort((a, b) => (b.last?.created_at ?? "").localeCompare(a.last?.created_at ?? ""));
  }, [msgs, contacts, filter]);

  const cur = threads.find((t) => t.phone === active) ?? (active ? { phone: active, name: active, type: "other", last: null, unread: 0 } : null);
  const thread = msgs.filter((m) => norm(m.phone) === active);

  const doSend = async () => {
    if (!cur || !text.trim()) return;
    setBusy(true);
    try {
      const r = await send({ data: { phone: cur.phone, body: text.trim(), channel, contact_name: cur.name, contact_type: cur.type } });
      if (r.status === "pending_number") toast.info("Saved. It will send once your phone number is connected.");
      else if (r.status === "failed") toast.error(r.error ?? "Send failed");
      else toast.success("Sent");
      setText("");
      load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const doDraft = async () => {
    if (!cur || !ask.trim()) return;
    setBusy(true);
    try {
      const { data: jobs } = await supabase.from("jobs").select("job_date, job_time, address, job_type, status").eq("tech_name", cur.name).order("job_date", { ascending: false }).limit(5);
      const jobsTxt = (jobs ?? []).map((j) => `${j.job_date ?? ""} ${j.job_time ?? ""} ${j.job_type ?? ""} ${j.address ?? ""} (${j.status ?? ""})`).join("\n");
      const r = await draft({ data: { instruction: ask, history: thread.slice(-15).map((m) => ({ direction: m.direction, body: m.body })), contact_name: cur.name, jobs: jobsTxt } });
      setText(r.text);
      setAsk("");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <MobileNav />
        <Link to="/"><Button variant="ghost" size="icon" aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <h1 className="text-lg font-semibold">Dispatch & Messages</h1>
      </header>
      <div className="grid md:grid-cols-[300px_1fr] h-[calc(100vh-57px)]">
        <aside className={`border-r flex flex-col ${active ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 space-y-2 border-b">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All contacts</SelectItem>
                <SelectItem value="technician">Technicians</SelectItem>
                <SelectItem value="subcontractor">Subcontractors</SelectItem>
                <SelectItem value="other">Leads & companies</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input placeholder="New number +1…" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              <Button size="icon" variant="outline" aria-label="Start conversation" onClick={() => { if (norm(newPhone).length > 6) { setActive(norm(newPhone)); setNewPhone(""); } }}><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {threads.map((t) => (
              <button key={t.phone} onClick={() => setActive(t.phone)} className={`w-full text-left px-3 py-2 border-b hover:bg-accent ${active === t.phone ? "bg-accent" : ""}`}>
                <div className="flex justify-between gap-2"><span className="font-medium truncate">{t.name}</span><Badge variant="secondary" className="text-[10px]">{t.type}</Badge></div>
                <div className="text-xs text-muted-foreground truncate">{t.last ? `${t.last.direction === "in" ? "↙ " : "↗ "}${t.last.body}` : t.phone}</div>
              </button>
            ))}
            {threads.length === 0 && <p className="p-4 text-sm text-muted-foreground">No contacts yet.</p>}
          </div>
        </aside>
        <section className={`flex flex-col ${active ? "flex" : "hidden md:flex"}`}>
          {!cur ? (
            <div className="m-auto text-sm text-muted-foreground">Pick a conversation</div>
          ) : (
            <>
              <div className="border-b px-4 py-2 flex items-center gap-2">
                <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setActive(null)}>Back</Button>
                <div className="font-medium">{cur.name}</div>
                <span className="text-xs text-muted-foreground">{cur.phone}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {thread.map((m) => (
                  <div key={m.id} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direction === "out" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div className="text-[10px] opacity-70 mt-1">{m.channel === "whatsapp" ? "WhatsApp" : "SMS"} · {new Date(m.created_at).toLocaleString()} · {m.status === "pending_number" ? "waiting for number" : m.status}</div>
                  </div>
                ))}
                {thread.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
              </div>
              <Card className="m-3 p-3 space-y-2">
                <div className="flex gap-2">
                  <Input placeholder="Ask the assistant, e.g. 'send him tomorrow's job and ask to confirm'" value={ask} onChange={(e) => setAsk(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doDraft()} />
                  <Button variant="outline" onClick={doDraft} disabled={busy}><Sparkles className="h-4 w-4 mr-1" />Draft</Button>
                </div>
                <Textarea rows={3} placeholder="Type a message…" value={text} onChange={(e) => setText(e.target.value)} />
                <div className="flex justify-between gap-2">
                  <Select value={channel} onValueChange={(v) => setChannel(v as "sms" | "whatsapp")}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="sms">SMS / RCS</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem></SelectContent>
                  </Select>
                  <Button onClick={doSend} disabled={busy || !text.trim()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}Send</Button>
                </div>
              </Card>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
