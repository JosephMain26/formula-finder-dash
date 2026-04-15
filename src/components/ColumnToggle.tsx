import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Columns3 } from "lucide-react";

export const ALL_COLUMNS = [
  { key: "actions", label: "Actions" },
  { key: "job_date", label: "Date" },
  { key: "company", label: "Company" },
  { key: "tech_name", label: "Tech" },
  { key: "po_number", label: "PO #" },
  { key: "job_type", label: "Job Type" },
  { key: "status", label: "Status" },
  { key: "price", label: "Price" },
  { key: "co_parts", label: "Co Parts" },
  { key: "manual_percentage", label: "Tech %" },
  { key: "total_tech", label: "Total Tech" },
  { key: "total_office", label: "Total Office" },
  { key: "tip", label: "Tip" },
  { key: "cc_fee", label: "CC Fee" },
  { key: "payment", label: "Payment" },
  { key: "paid", label: "Paid" },
] as const;

export type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

const DEFAULT_VISIBLE = new Set<ColumnKey>(ALL_COLUMNS.map(c => c.key));

export function useColumnVisibility() {
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(DEFAULT_VISIBLE);

  function toggle(key: ColumnKey) {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function showAll() {
    setVisibleColumns(new Set(ALL_COLUMNS.map(c => c.key)));
  }

  return { visibleColumns, toggle, showAll };
}

interface ColumnToggleProps {
  visibleColumns: Set<ColumnKey>;
  onToggle: (key: ColumnKey) => void;
  onShowAll: () => void;
}

export function ColumnToggle({ visibleColumns, onToggle, onShowAll }: ColumnToggleProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Columns3 className="h-4 w-4 mr-2" />
          Columns ({visibleColumns.size}/{ALL_COLUMNS.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="end">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Toggle Columns</span>
          <button
            onClick={onShowAll}
            className="text-xs text-primary hover:underline"
          >
            Show all
          </button>
        </div>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {ALL_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={visibleColumns.has(col.key)}
                onCheckedChange={() => onToggle(col.key)}
              />
              <span className="text-sm">{col.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
