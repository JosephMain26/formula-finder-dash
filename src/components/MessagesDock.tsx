import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Row = { phone: string; contact_name: string | null; body: string; direction: string; created_at: string };

export function MessagesDock() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    supabase.from("dispatch_messages").select("phone, contact_name, body, direction, created_at")
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => {
        const seen = new Map<string, Row>();
        (data as Row[] | null)?.forEach((r) => { if (!seen.has(r.phone)) seen.set(r.phone, r); });
        setRows([...seen.values()]);
      });
  }, [open]);

  if (path === "/auth" || path.startsWith("/sign/") || path === "/dispatch") return null;

  return (
    <>
      <Button size="icon" aria-label="Recent messages" onClick={() => setOpen(true)}
        className="hidden lg:inline-flex fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg">
        <MessageSquare className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 sm:max-w-sm p-0">
          <SheetHeader className="p-4 border-b"><SheetTitle>Recent conversations</SheetTitle></SheetHeader>
          <TooltipProvider delayDuration={200}>
            <div className="overflow-y-auto h-[calc(100vh-8rem)]">
              {rows.length === 0 && <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>}
              {rows.map((r) => (
                <Tooltip key={r.phone}>
                  <TooltipTrigger asChild>
                    <Link to="/dispatch" search={{ phone: r.phone }} onClick={() => setOpen(false)}
                      className="block px-4 py-3 border-b hover:bg-accent">
                      <div className="font-medium text-sm">{r.contact_name || r.phone}</div>
                      <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs">
                    <span className="text-xs">{r.direction === "outbound" ? "You: " : ""}{r.body}</span>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
          <div className="p-3 border-t">
            <Link to="/dispatch" search={{}} onClick={() => setOpen(false)} className="text-sm text-primary hover:underline">Open all messages</Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
