import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadPaymentMethods } from "@/lib/settings";
import type { Tables } from "@/integrations/supabase/types";
import type { DataBoardFilters } from "@/lib/databoard/templates";
import { EMPTY_FILTERS } from "@/lib/databoard/templates";

type Job = Tables<"jobs">;

interface Props {
  jobs: Job[];
  filters: DataBoardFilters;
  onChange: (f: DataBoardFilters) => void;
  canSeeMarketers: boolean;
}

function MultiSelect({
  label, options, selected, onChange,
}: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const has = (o: string) => selected.includes(o);
  function toggle(o: string) {
    onChange(has(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant={selected.length ? "default" : "outline"}>
          {label}{selected.length ? ` (${selected.length})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-72 overflow-y-auto">
        {options.length === 0 && <div className="text-xs text-muted-foreground p-1">No options</div>}
        {options.map((o) => (
          <label key={o} className="flex items-center gap-2 py-1 cursor-pointer text-sm">
            <Checkbox checked={has(o)} onCheckedChange={() => toggle(o)} />
            <span className="truncate">{o}</span>
          </label>
        ))}
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => onChange([])}>Clear</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function FiltersBar({ jobs, filters, onChange, canSeeMarketers }: Props) {
  const [marketers, setMarketers] = useState<string[]>([]);
  const [installers, setInstallers] = useState<string[]>([]);
  const [payments, setPayments] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: ins }, pm] = await Promise.all([
        (supabase as any).from("companies").select("company_name").order("company_name"),
        (supabase as any).from("installers").select("name").order("name"),
        loadPaymentMethods(),
      ]);
      setMarketers((c || []).map((x: any) => x.company_name).filter(Boolean));
      setInstallers((ins || []).map((x: any) => x.name).filter(Boolean));
      setPayments(pm.map((p) => p.name).filter(Boolean));
    })();
  }, []);

  const techs = useMemo(() => Array.from(new Set(jobs.map((j) => j.tech_name).filter(Boolean) as string[])).sort(), [jobs]);
  const jobTypes = useMemo(() => Array.from(new Set(jobs.map((j) => j.job_type).filter(Boolean) as string[])).sort(), [jobs]);
  const statuses = useMemo(() => Array.from(new Set(jobs.map((j) => j.status).filter(Boolean) as string[])).sort(), [jobs]);

  const activeCount =
    filters.techs.length + filters.marketers.length + filters.installers.length +
    filters.jobTypes.length + filters.statuses.length + filters.payments.length +
    (filters.paid !== "any" ? 1 : 0) + (filters.minPrice ? 1 : 0) +
    (filters.maxPrice ? 1 : 0) + (filters.city ? 1 : 0);

  function patch(p: Partial<DataBoardFilters>) { onChange({ ...filters, ...p }); }

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border rounded-lg bg-card">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Filter className="h-3.5 w-3.5" /> Filters{activeCount ? ` · ${activeCount}` : ""}
      </span>
      <MultiSelect label="Tech" options={techs} selected={filters.techs} onChange={(v) => patch({ techs: v })} />
      {canSeeMarketers && (
        <MultiSelect label="Marketer" options={marketers} selected={filters.marketers} onChange={(v) => patch({ marketers: v })} />
      )}
      <MultiSelect label="Installer" options={installers} selected={filters.installers} onChange={(v) => patch({ installers: v })} />
      <MultiSelect label="Job type" options={jobTypes} selected={filters.jobTypes} onChange={(v) => patch({ jobTypes: v })} />
      <MultiSelect label="Status" options={statuses} selected={filters.statuses} onChange={(v) => patch({ statuses: v })} />
      <MultiSelect label="Payment" options={payments} selected={filters.payments} onChange={(v) => patch({ payments: v })} />

      <Select value={filters.paid} onValueChange={(v) => patch({ paid: v as any })}>
        <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any status</SelectItem>
          <SelectItem value="paid">Paid only</SelectItem>
          <SelectItem value="unpaid">Unpaid only</SelectItem>
        </SelectContent>
      </Select>

      <Input className="h-9 w-24" placeholder="Min $" value={filters.minPrice}
        onChange={(e) => patch({ minPrice: e.target.value })} />
      <Input className="h-9 w-24" placeholder="Max $" value={filters.maxPrice}
        onChange={(e) => patch({ maxPrice: e.target.value })} />
      <Input className="h-9 w-32" placeholder="City contains…" value={filters.city}
        onChange={(e) => patch({ city: e.target.value })} />

      {activeCount > 0 && (
        <Button size="sm" variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
          <X className="h-3.5 w-3.5 mr-1" /> Clear all
        </Button>
      )}
    </div>
  );
}

export function applyFilters(jobs: Job[], f: DataBoardFilters): Job[] {
  const min = f.minPrice ? Number(f.minPrice) : null;
  const max = f.maxPrice ? Number(f.maxPrice) : null;
  const city = f.city.trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.techs.length && !f.techs.includes(j.tech_name || "")) return false;
    if (f.marketers.length && !f.marketers.includes(j.company || "")) return false;
    if (f.installers.length && !f.installers.includes(j.installer_name || "")) return false;
    if (f.jobTypes.length && !f.jobTypes.includes(j.job_type || "")) return false;
    if (f.statuses.length && !f.statuses.includes(j.status || "")) return false;
    if (f.payments.length && !f.payments.includes(j.payment || "")) return false;
    if (f.paid === "paid" && !j.paid) return false;
    if (f.paid === "unpaid" && j.paid) return false;
    if (min != null && Number(j.price || 0) < min) return false;
    if (max != null && Number(j.price || 0) > max) return false;
    if (city && !(j.address || "").toLowerCase().includes(city)) return false;
    return true;
  });
}
