import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, X } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { DataBoardFilters } from "@/lib/databoard/templates";
import { EMPTY_FILTERS } from "@/lib/databoard/templates";

type Job = Tables<"jobs">;

const EMPTY_TOKEN = "__empty__";
const EMPTY_LABEL = "(empty)";

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
            <span className="truncate">{o === EMPTY_TOKEN ? EMPTY_LABEL : o}</span>
          </label>
        ))}
        {selected.length > 0 && (
          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => onChange([])}>Clear</Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Build option list from a job-field. Adds "(empty)" sentinel when null/empty rows exist. */
function optionsFromJobs(jobs: Job[], key: keyof Job): string[] {
  let hasEmpty = false;
  const set = new Set<string>();
  for (const j of jobs) {
    const v = j[key];
    if (v == null || v === "") { hasEmpty = true; continue; }
    set.add(String(v));
  }
  const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
  if (hasEmpty) arr.push(EMPTY_TOKEN);
  return arr;
}

/** For marketer column, fall back to legacy company_1 when company is empty. */
function marketerOf(j: Job): string | null {
  const v = (j as any).company || (j as any).company_1;
  return v == null || v === "" ? null : String(v);
}

function marketerOptionsFromJobs(jobs: Job[]): string[] {
  let hasEmpty = false;
  const set = new Set<string>();
  for (const j of jobs) {
    const v = marketerOf(j);
    if (v == null) { hasEmpty = true; continue; }
    set.add(v);
  }
  const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
  if (hasEmpty) arr.push(EMPTY_TOKEN);
  return arr;
}

export function FiltersBar({ jobs, filters, onChange, canSeeMarketers }: Props) {
  // All option lists derived from the jobs actually loaded — guarantees options match the data.
  const techs = useMemo(() => optionsFromJobs(jobs, "tech_name"), [jobs]);
  const marketers = useMemo(() => marketerOptionsFromJobs(jobs), [jobs]);
  const installers = useMemo(() => optionsFromJobs(jobs, "installer_name"), [jobs]);
  const jobTypes = useMemo(() => optionsFromJobs(jobs, "job_type"), [jobs]);
  const statuses = useMemo(() => optionsFromJobs(jobs, "status"), [jobs]);
  const payments = useMemo(() => optionsFromJobs(jobs, "payment"), [jobs]);

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

/** Match a job's value against a multi-select that may include the EMPTY_TOKEN sentinel. */
function matchesMulti(value: unknown, selected: string[]): boolean {
  if (!selected.length) return true;
  const isEmpty = value == null || value === "";
  if (isEmpty) return selected.includes(EMPTY_TOKEN);
  return selected.includes(String(value));
}

export function applyFilters(jobs: Job[], f: DataBoardFilters): Job[] {
  const min = f.minPrice ? Number(f.minPrice) : null;
  const max = f.maxPrice ? Number(f.maxPrice) : null;
  const city = f.city.trim().toLowerCase();
  return jobs.filter((j) => {
    if (!matchesMulti(j.tech_name, f.techs)) return false;
    if (!matchesMulti(marketerOf(j), f.marketers)) return false;
    if (!matchesMulti(j.installer_name, f.installers)) return false;
    if (!matchesMulti(j.job_type, f.jobTypes)) return false;
    if (!matchesMulti(j.status, f.statuses)) return false;
    if (!matchesMulti(j.payment, f.payments)) return false;
    if (f.paid === "paid" && !j.paid) return false;
    if (f.paid === "unpaid" && j.paid) return false;
    if (min != null && Number(j.price || 0) < min) return false;
    if (max != null && Number(j.price || 0) > max) return false;
    if (city && !(j.address || "").toLowerCase().includes(city)) return false;
    return true;
  });
}
