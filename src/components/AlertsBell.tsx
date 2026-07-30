import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { loadAlerts, markAllAlertsRead, markAlertRead, type AppAlert } from "@/lib/automations";

export function AlertsBell() {
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [open, setOpen] = useState(false);

  async function refresh() {
    try {
      setAlerts(await loadAlerts(30));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 120_000);
    return () => clearInterval(t);
  }, []);

  const unread = alerts.filter((a) => !a.read_at).length;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) refresh(); }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative" title="Alerts">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] justify-center">
              {unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Alerts</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={async () => { await markAllAlertsRead(); refresh(); }}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-auto divide-y">
          {alerts.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No alerts.</p>
          )}
          {alerts.map((a) => (
            <button
              key={a.id}
              className={`w-full text-left p-3 hover:bg-muted/50 ${a.read_at ? "opacity-60" : ""}`}
              onClick={async () => { if (!a.read_at) { await markAlertRead(a.id); refresh(); } }}
            >
              <p className="text-sm font-medium">{a.title}</p>
              {a.body && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{a.body}</p>}
              <p className="text-[10px] text-muted-foreground mt-1">
                {new Date(a.created_at).toLocaleString()}
              </p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
