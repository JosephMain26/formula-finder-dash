import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Briefcase, Users, CheckCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Job = Tables<"jobs">;

interface StatsCardsProps {
  jobs: Job[];
}

export function StatsCards({ jobs }: StatsCardsProps) {
  const totalRevenue = jobs.reduce((sum, j) => sum + (j.price || 0), 0);
  const totalOffice = jobs.reduce((sum, j) => sum + (j.total_office || 0), 0);
  const totalTech = jobs.reduce((sum, j) => sum + (j.total_tech || 0), 0);
  const paidCount = jobs.filter(j => j.paid).length;

  const stats = [
    { label: "Total Revenue", value: `$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-primary" },
    { label: "Total Jobs", value: jobs.length.toString(), icon: Briefcase, color: "text-chart-2" },
    { label: "Office Total", value: `$${totalOffice.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, icon: Users, color: "text-chart-3" },
    { label: "Paid Jobs", value: `${paidCount} / ${jobs.length}`, icon: CheckCircle, color: "text-success" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className={`h-8 w-8 ${stat.color} opacity-80`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
