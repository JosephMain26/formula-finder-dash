import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface JobFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
  techFilter: string;
  onTechChange: (value: string) => void;
  companyFilter: string;
  onCompanyChange: (value: string) => void;
  jobTypeFilter: string;
  onJobTypeChange: (value: string) => void;
  paidFilter: string;
  onPaidChange: (value: string) => void;
  onClear: () => void;
  techs: string[];
  companies: string[];
  jobTypes: string[];
  statuses: string[];
  /** Hide the Tech filter when the user can only see their own jobs. Defaults to true. */
  showTechFilter?: boolean;
}

export function JobFilters({
  search, onSearchChange,
  statusFilter, onStatusChange,
  techFilter, onTechChange,
  companyFilter, onCompanyChange,
  jobTypeFilter, onJobTypeChange,
  paidFilter, onPaidChange,
  onClear,
  techs, companies, jobTypes, statuses,
  showTechFilter = true,
}: JobFiltersProps) {
  const hasFilters = search || statusFilter || (showTechFilter && techFilter) || companyFilter || jobTypeFilter || paidFilter;

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="w-full sm:flex-1 sm:min-w-[200px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
        <Input
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="w-[calc(50%-0.375rem)] sm:w-auto sm:min-w-[150px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {showTechFilter && (
        <div className="w-[calc(50%-0.375rem)] sm:w-auto sm:min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Tech</label>
          <Select value={techFilter} onValueChange={onTechChange}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {techs.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="w-[calc(50%-0.375rem)] sm:w-auto sm:min-w-[150px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Marketer</label>
        <Select value={companyFilter} onValueChange={onCompanyChange}>
          <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[calc(50%-0.375rem)] sm:w-auto sm:min-w-[130px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Job Type</label>
        <Select value={jobTypeFilter} onValueChange={onJobTypeChange}>
          <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {jobTypes.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="w-[calc(50%-0.375rem)] sm:w-auto sm:min-w-[120px]">
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Paid</label>
        <Select value={paidFilter} onValueChange={onPaidChange}>
          <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
