import { supabase } from "@/integrations/supabase/client";

export type InstallGroup = { id: string; name: string; sort_order: number };
export type InstallSubItem = { id: string; group_id: string; name: string; sort_order: number };
export type InstallModel = { id: string; group_id: string; name: string; colors: string[]; sort_order: number };
export type InstallColor = { id: string; name: string; sort_order: number };
export type InstallSize = { id: string; width: string; height: string; label: string | null; sort_order: number };

export type SystemType = "extension" | "torsion" | null;

export type JobInstallationSubItem = {
  sub_item_id?: string | null;
  name: string;
  checked: boolean;
};

export type JobInstallation = {
  id?: string;
  job_id?: string;
  group_id: string | null;
  group_name: string | null;
  model_id: string | null;
  model_name: string | null;
  color: string | null;
  system_type: SystemType;
  size_id: string | null;
  size_label: string | null;
  notes: string | null;
  sub_items: JobInstallationSubItem[];
  sort_order: number;
};

export async function loadCatalog() {
  const [g, s, m, c, sz] = await Promise.all([
    (supabase as any).from("install_groups").select("*").order("sort_order").order("name"),
    (supabase as any).from("install_sub_items").select("*").order("sort_order").order("name"),
    (supabase as any).from("install_models").select("*").order("sort_order").order("name"),
    (supabase as any).from("install_colors").select("*").order("sort_order").order("name"),
    (supabase as any).from("install_sizes").select("*").order("sort_order"),
  ]);
  return {
    groups: (g.data as InstallGroup[]) || [],
    subItems: (s.data as InstallSubItem[]) || [],
    models: (m.data as InstallModel[]) || [],
    colors: (c.data as InstallColor[]) || [],
    sizes: (sz.data as InstallSize[]) || [],
  };
}

export function formatSize(sz: { width: string; height: string; label?: string | null }): string {
  if (sz.label) return sz.label;
  return `${sz.width} × ${sz.height}`;
}

export async function loadJobInstallations(jobId: string): Promise<JobInstallation[]> {
  const { data } = await (supabase as any)
    .from("job_installations")
    .select("*")
    .eq("job_id", jobId)
    .order("sort_order");
  return (data as JobInstallation[]) || [];
}

export async function saveJobInstallations(jobId: string, items: JobInstallation[]) {
  await (supabase as any).from("job_installations").delete().eq("job_id", jobId);
  if (items.length === 0) return;
  const rows = items.map((it, idx) => ({
    job_id: jobId,
    group_id: it.group_id,
    group_name: it.group_name,
    model_id: it.model_id,
    model_name: it.model_name,
    color: it.color,
    system_type: it.system_type,
    size_id: it.size_id,
    size_label: it.size_label,
    notes: it.notes,
    sub_items: it.sub_items,
    sort_order: idx,
  }));
  await (supabase as any).from("job_installations").insert(rows);
}

const SYSTEM_LABEL: Record<string, string> = { extension: "Extension", torsion: "Torsion" };

/** Render installations into template variables. */
export function renderInstallVariables(installations: JobInstallation[]) {
  const types = installations.map((i) => i.group_name).filter(Boolean) as string[];
  const models = installations
    .filter((i) => i.model_name)
    .map((i) => `${i.group_name || ""}: ${i.model_name}`);
  const colors = installations.map((i) => i.color).filter(Boolean) as string[];
  const systems = installations
    .map((i) => (i.system_type ? SYSTEM_LABEL[i.system_type] || i.system_type : null))
    .filter(Boolean) as string[];
  const sizes = installations.map((i) => i.size_label).filter(Boolean) as string[];

  const itemsBlocks = installations.map((i) => {
    const parens = [i.model_name, i.color].filter(Boolean).join(", ");
    const header = [
      i.group_name || "Installation",
      parens ? `(${parens})` : "",
    ].filter(Boolean).join(" ");
    const meta: string[] = [];
    if (i.size_label) meta.push(i.size_label);
    if (i.system_type) meta.push(`${SYSTEM_LABEL[i.system_type] || i.system_type} system`);
    const headerFull = meta.length ? `${header} — ${meta.join(" — ")}` : header;
    const checked = i.sub_items.filter((s) => s.checked);
    const lines = checked.map((s) => `- ${s.name}`);
    return [headerFull + ":", ...lines].join("\n");
  });

  return {
    install_types: types.join(", "),
    install_models: models.join(", "),
    install_colors: colors.join(", "),
    install_systems: systems.join(", "),
    install_sizes: sizes.join(", "),
    install_items: itemsBlocks.join("\n\n"),
    install_count: String(installations.length),
  };
}

export type DoorCenter = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  contact_name: string | null;
};

export async function loadDoorCenters(): Promise<DoorCenter[]> {
  const { data } = await (supabase as any)
    .from("door_centers")
    .select("id,name,address,phone,contact_name")
    .order("sort_order")
    .order("name");
  return (data as DoorCenter[]) || [];
}

export async function loadDoorCenter(id: string | null | undefined): Promise<DoorCenter | null> {
  if (!id) return null;
  const { data } = await (supabase as any)
    .from("door_centers")
    .select("id,name,address,phone,contact_name")
    .eq("id", id)
    .maybeSingle();
  return (data as DoorCenter) || null;
}

export function renderPickupVariables(dc: DoorCenter | null): Record<string, string> {
  if (!dc) {
    return { pickup_name: "", pickup_address: "", pickup_phone: "", pickup_link: "" };
  }
  const link = dc.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dc.address)}`
    : "";
  return {
    pickup_name: dc.name || "",
    pickup_address: dc.address || "",
    pickup_phone: dc.phone || "",
    pickup_link: link,
  };
}

