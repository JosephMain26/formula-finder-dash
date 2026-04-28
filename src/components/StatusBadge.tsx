import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { loadStatuses, statusBadgeClass, type StatusDef, STATUS_COLORS } from "@/lib/jobSchema";

let cached: StatusDef[] | null = null;
const subs = new Set<(s: StatusDef[]) => void>();

export async function refreshStatusesCache() {
  cached = await loadStatuses();
  subs.forEach((cb) => cb(cached!));
  return cached;
}

export function useStatuses(): StatusDef[] {
  const [statuses, setStatuses] = useState<StatusDef[]>(cached || []);
  useEffect(() => {
    if (!cached) refreshStatusesCache().then(setStatuses);
    else setStatuses(cached);
    const cb = (s: StatusDef[]) => setStatuses(s);
    subs.add(cb);
    return () => { subs.delete(cb); };
  }, []);
  return statuses;
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const statuses = useStatuses();
  if (!status) return null;
  const cls = statuses.length ? statusBadgeClass(status, statuses) : STATUS_COLORS.gray;
  return <Badge className={cls}>{status}</Badge>;
}
