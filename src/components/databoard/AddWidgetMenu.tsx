import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import type { WidgetConfig } from "./WidgetGrid";
import { loadCustomFields, type CustomField } from "@/lib/jobSchema";

interface Props {
  onAdd: (w: WidgetConfig) => void;
  canSeeMarketerPay: boolean;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export function AddWidgetMenu({ onAdd, canSeeMarketerPay }: Props) {
  const [extras, setExtras] = useState<CustomField[]>([]);
  useEffect(() => {
    loadCustomFields().then((f) => setExtras(f.filter((x) => x.type === "number" && x.visibleInDataboard)));
  }, []);

  const kpi = (metric: any, label: string) =>
    onAdd({ i: uid(), type: "kpi", title: label, settings: { metric, label } });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add widget</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>KPI</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => kpi("revenue", "Revenue")}>Revenue</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("profit", "Profit")}>Profit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("count", "Job count")}>Job count</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "kpi", title: "Completed jobs", settings: { metric: "completed_count", label: "Completed jobs" } })}>Completed jobs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("avg_ticket", "Avg ticket")}>Avg ticket</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("paid_count", "Paid jobs")}>Paid jobs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("tech_count", "Active techs")}>Active techs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("tech_pay", "Tech pay")}>Tech pay</DropdownMenuItem>
        {canSeeMarketerPay && (
          <DropdownMenuItem onClick={() => kpi("marketer_pay", "Marketer pay")}>Marketer pay</DropdownMenuItem>
        )}

        {extras.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Custom fields</DropdownMenuLabel>
            {extras.map((f) => (
              <DropdownMenuItem key={f.id} onClick={() => kpi(`extra:${f.key}`, f.label)}>{f.label}</DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Insight (custom)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd({
          i: uid(), type: "insight", title: "New insight",
          settings: { dimension: "tech_name", metric: "revenue", viz: "bar", limit: 10, sort: "desc" },
        })}>Add insight (configure after)</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Charts (configurable)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Revenue over time", settings: { dimension: "day", metric: "revenue", viz: "area", limit: 0, sort: "desc" } })}>Revenue over time</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Best closing techs", settings: { dimension: "tech_name", metric: "count", viz: "bar", limit: 8, sort: "desc", completedOnly: true } })}>Best closing techs (completed)</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Top marketers", settings: { dimension: "company", metric: "revenue", viz: "bar", limit: 8, sort: "desc" } })}>Top marketers</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Status breakdown", settings: { dimension: "status", metric: "count", viz: "pie", limit: 10, sort: "desc" } })}>Status breakdown</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Payment split", settings: { dimension: "payment", metric: "revenue", viz: "donut", limit: 10, sort: "desc" } })}>Payment split</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Job types", settings: { dimension: "job_type", metric: "count", viz: "bar", limit: 10, sort: "desc" } })}>Job types</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Tables (configurable)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Top techs (table)", settings: { dimension: "tech_name", metric: "revenue", viz: "table", limit: 15, sort: "desc" } })}>Top techs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "insight", title: "Top job types", settings: { dimension: "job_type", metric: "count", viz: "table", limit: 15, sort: "desc" } })}>Top job types</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "goal", title: "Revenue goal", settings: { target: 10000, metric: "revenue" } })}>Goal widget</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "activity", title: "Recent jobs", settings: { limit: 20 } })}>Activity feed</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "calendar", title: "Calendar", settings: {} })}>Calendar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "map", title: "Map", settings: {} })}>Map</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
