import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface Props {
  jobs: Job[];
  onOpenJob?: (job: Job) => void;
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

  const max = useMemo(() => {
    let n = 0;
    for (const arr of byDay.values()) if (arr.length > n) n = arr.length;
    return n || 1;
  }, [byDay]);

  function fmt(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const dayList = selected ? byDay.get(fmt(selected)) || [] : [];

  return (
    <div className="h-full flex flex-col">
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(d) => { setSelected(d); if (d) setOpenSheet(true); }}
        className={cn("p-2 pointer-events-auto mx-auto")}
        components={{
          DayContent: (props: any) => {
            const d: Date = props.date;
            const key = fmt(d);
            const arr = byDay.get(key);
            const count = arr?.length || 0;
            const intensity = count ? Math.min(1, count / max) : 0;
            return (
              <div className="relative w-full h-full flex items-center justify-center">
                <span>{d.getDate()}</span>
                {count > 0 && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold rounded-full px-1.5 leading-tight"
                    style={{
                      backgroundColor: `hsl(var(--primary) / ${0.15 + intensity * 0.7})`,
                      color: intensity > 0.5 ? "hsl(var(--primary-foreground))" : "hsl(var(--primary))",
                    }}
                  >
                    {count}
                  </span>
                )}
              </div>
            );
          },
        }}
      />

      <Sheet open={openSheet} onOpenChange={setOpenSheet}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selected?.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {dayList.length === 0 && <div className="text-sm text-muted-foreground">No jobs.</div>}
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
