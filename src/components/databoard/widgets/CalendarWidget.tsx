import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface Props {
  jobs: Job[];
  onOpenJob?: (job: Job) => void;
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarWidget({ jobs, onOpenJob }: Props) {
  const [selected, setSelected] = useState<Date | undefined>();
  const [openSheet, setOpenSheet] = useState(false);

  const byDay = useMemo(() => {
    const m = new Map<string, Job[]>();
    for (const j of jobs) {
      if (!j.job_date) continue;
      const arr = m.get(j.job_date) || [];
      arr.push(j);
      m.set(j.job_date, arr);
    }
    return m;
  }, [jobs]);

  // Modifier groups for low/medium/high job-count days
  const { lowDays, medDays, highDays } = useMemo(() => {
    let max = 1;
    for (const arr of byDay.values()) if (arr.length > max) max = arr.length;
    const low: Date[] = [], med: Date[] = [], high: Date[] = [];
    for (const [k, arr] of byDay.entries()) {
      const [y, mo, d] = k.split("-").map(Number);
      if (!y || !mo || !d) continue;
      const dt = new Date(y, mo - 1, d);
      const r = arr.length / max;
      if (r >= 0.66) high.push(dt);
      else if (r >= 0.33) med.push(dt);
      else low.push(dt);
    }
    return { lowDays: low, medDays: med, highDays: high };
  }, [byDay]);

  const dayList = selected ? byDay.get(fmtDate(selected)) || [] : [];

  return (
    <div className="h-full flex flex-col items-center">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(d) => { setSelected(d); if (d) setOpenSheet(true); }}
        modifiers={{ low: lowDays, med: medDays, high: highDays }}
        modifiersClassNames={{
          low: "after:content-[''] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary/40",
          med: "after:content-[''] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary/70",
          high: "after:content-[''] after:absolute after:bottom-0.5 after:left-1/2 after:-translate-x-1/2 after:w-2 after:h-2 after:rounded-full after:bg-primary",
        }}
        className="p-2 pointer-events-auto"
      />

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selected?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {dayList.length === 0 && <div className="text-sm text-muted-foreground">No jobs on this day.</div>}
            {dayList.map((j) => (
              <button
                key={j.id}
                onClick={() => { setOpenSheet(false); onOpenJob?.(j); }}
                className="w-full text-left border rounded-md p-2 hover:bg-accent transition-colors"
              >
                <div className="flex justify-between gap-2">
                  <div className="font-medium truncate">{j.tech_name || "—"} · {j.job_type || "—"}</div>
                  <div className="font-semibold shrink-0">${Number(j.price || 0).toFixed(0)}</div>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {j.company || "—"} · {j.address || ""} · {j.status}
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
