import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Briefcase, Users, Wrench, Megaphone, CheckCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface StatsCardsProps {
  jobs: Job[];
}

export function StatsCards({ jobs }: StatsCardsProps) {
  const totalRevenue = jobs.reduce((sum, j) => sum + (j.price || 0), 0);
  const totalMarketer = jobs.reduce((sum, j) => sum + ((j as any).total_marketer || 0), 0);
  const totalOffice = jobs.reduce((sum, j) => sum + (j.total_office || 0), 0);
  const totalTech = jobs.reduce((sum, j) => sum + (j.total_tech || 0), 0);
  const paidCount = jobs.filter(j => j.paid).length;

  const fmt = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const stats = [
    { label: "Total Revenue", value: fmt(totalRevenue), icon: DollarSign, color: "text-primary" },
    { label: "Total Jobs", value: jobs.length.toString(), icon: Briefcase, color: "text-chart-2" },
    { label: "Marketer Total", value: fmt(totalMarketer), icon: Megaphone, color: "text-chart-4" },
    { label: "Office Total", value: fmt(totalOffice), icon: Users, color: "text-chart-3" },
    { label: "Tech Total", value: fmt(totalTech), icon: Wrench, color: "text-chart-5" },
    { label: "Paid Jobs", value: `${paidCount} / ${jobs.length}`, icon: CheckCircle, color: "text-success" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">{stat.label}</p>
                <p className="text-xl font-bold mt-1 truncate">{stat.value}</p>
              </div>
              <stat.icon className={`h-7 w-7 ${stat.color} opacity-80 shrink-0`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
