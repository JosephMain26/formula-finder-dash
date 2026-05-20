import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField } from "@/components/DatePickerField";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CHANNEL_LABELS, LEAD_PRESETS, type Job, type NotifyChannel } from "@/lib/notifications";

const ALL_CHANNELS: NotifyChannel[] = ["in_app", "email_tech", "email_client"];

interface Props {
  job: Job | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}

export function RescheduleDialog({ job, open, onOpenChange, onSaved }: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isRange, setIsRange] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [channels, setChannels] = useState<NotifyChannel[]>(["in_app"]);
  const [leads, setLeads] = useState<number[]>([60]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!job) return;
    setDate(job.job_date ?? "");
    setTime((job.job_time ?? "").slice(0, 5));
    setEndTime((job.job_time_end ?? "").slice(0, 5));
    setIsRange(!!job.job_time_end);
    setEnabled(job.notify_enabled ?? true);
    setChannels(((job.notify_channels ?? ["in_app"]) as NotifyChannel[]));
    const list = job.notify_lead_minutes_list && job.notify_lead_minutes_list.length > 0
      ? job.notify_lead_minutes_list
      : [job.notify_lead_minutes ?? 60];
    setLeads(list);
  }, [job]);

  if (!job) return null;

  function toggleChannel(c: NotifyChannel, on: boolean) {
    setChannels((prev) => (on ? [...new Set([...prev, c])] : prev.filter((x) => x !== c)));
  }

  function toggleLead(m: number, on: boolean) {
    setLeads((prev) => {
      const next = on ? [...new Set([...prev, m])] : prev.filter((x) => x !== m);
      return next.sort((a, b) => a - b);
    });
  }

  async function save() {
    if (!job) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("jobs")
      .update({
        job_date: date || null,
        job_time: time ? `${time}:00` : null,
        notify_enabled: enabled,
        notify_channels: channels,
        notify_lead_minutes_list: leads.length > 0 ? leads : [60],
        notify_lead_minutes: leads[0] ?? 60,
        notified_lead_minutes: [],
        notified_at: null,
      })
      .eq("id", job.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Job updated");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule & reminders</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground">
            {job.company || job.company_1 || "—"} · {job.tech_name || "Unassigned"} · {job.address || ""}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <DatePickerField value={date} onChange={setDate} allowClear={false} />
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Reminder notifications</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {enabled && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">When to remind (pick one or more)</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {LEAD_PRESETS.map((p) => (
                      <label key={p.minutes} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={leads.includes(p.minutes)}
                          onCheckedChange={(v) => toggleLead(p.minutes, !!v)}
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Channels</Label>
                  {ALL_CHANNELS.map((c) => (
                    <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={channels.includes(c)}
                        onCheckedChange={(v) => toggleChannel(c, !!v)}
                      />
                      {CHANNEL_LABELS[c]}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
