import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus } from "lucide-react";
import type { WidgetConfig } from "./WidgetGrid";

interface Props {
  onAdd: (w: WidgetConfig) => void;
  canSeeMarketerPay: boolean;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export function AddWidgetMenu({ onAdd, canSeeMarketerPay }: Props) {
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
        <DropdownMenuItem onClick={() => kpi("avg_ticket", "Avg ticket")}>Avg ticket</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("paid_count", "Paid jobs")}>Paid jobs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("tech_count", "Active techs")}>Active techs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => kpi("tech_pay", "Tech pay")}>Tech pay</DropdownMenuItem>
        {canSeeMarketerPay && (
          <DropdownMenuItem onClick={() => kpi("marketer_pay", "Marketer pay")}>Marketer pay</DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Charts</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "chart", title: "Revenue over time", settings: { variant: "revenue_over_time" } })}>Revenue over time</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "chart", title: "Top techs", settings: { variant: "top_techs" } })}>Top techs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "chart", title: "Top marketers", settings: { variant: "top_companies" } })}>Top marketers</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "chart", title: "Status breakdown", settings: { variant: "status_breakdown" } })}>Status breakdown</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "chart", title: "Payment split", settings: { variant: "payment_split" } })}>Payment split</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Tables</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "table", title: "Top techs (table)", settings: { groupBy: "tech_name", metric: "revenue" } })}>Top techs</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "table", title: "Top job types", settings: { groupBy: "job_type", metric: "count" } })}>Top job types</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "goal", title: "Revenue goal", settings: { target: 10000, metric: "revenue" } })}>Goal widget</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAdd({ i: uid(), type: "activity", title: "Recent jobs", settings: { limit: 20 } })}>Activity feed</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
