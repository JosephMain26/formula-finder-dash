import { saveUserPrefs, getPref } from "@/lib/userPrefs";
import type { WidgetConfig } from "@/components/databoard/WidgetGrid";
import type { RangeKey } from "@/components/databoard/TimeRangeBar";
import type { DateRange } from "@/components/DateRangePresets";

export type DataBoardFilters = {
  techs: string[];
  marketers: string[];
  installers: string[];
  jobTypes: string[];
  statuses: string[];
  payments: string[];
  paid: "any" | "paid" | "unpaid";
  minPrice: string;
  maxPrice: string;
  city: string;
};

export const EMPTY_FILTERS: DataBoardFilters = {
  techs: [], marketers: [], installers: [], jobTypes: [], statuses: [], payments: [],
  paid: "any", minPrice: "", maxPrice: "", city: "",
};

export type ViewTemplate = {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  layouts: Record<string, any[]>;
  filters: DataBoardFilters;
  rangeKey: RangeKey;
  customRange: DateRange | null;
};

export type ExportSectionId =
  | "greeting" | "filters" | "kpis" | "charts" | "calendar" | "map" | "table" | "appendix";

export type ExportTemplate = {
  id: string;
  name: string;
  sections: { id: ExportSectionId; enabled: boolean }[];
  columns: string[];
  attachJobs: boolean;
  pageSize: "a4" | "letter";
  orientation: "portrait" | "landscape";
};

export const DEFAULT_EXPORT_SECTIONS: { id: ExportSectionId; enabled: boolean }[] = [
  { id: "greeting", enabled: true },
  { id: "filters", enabled: true },
  { id: "kpis", enabled: true },
  { id: "charts", enabled: true },
  { id: "calendar", enabled: false },
  { id: "map", enabled: false },
  { id: "table", enabled: true },
  { id: "appendix", enabled: false },
];

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function loadDataBoardPrefs() {
  const db = getPref<any>("databoard") || {};
  return {
    viewTemplates: (Array.isArray(db.viewTemplates) ? db.viewTemplates : []) as ViewTemplate[],
    exportTemplates: (Array.isArray(db.exportTemplates) ? db.exportTemplates : []) as ExportTemplate[],
    activeViewId: (typeof db.activeViewId === "string" ? db.activeViewId : "") as string,
    filters: (db.filters && typeof db.filters === "object" ? { ...EMPTY_FILTERS, ...db.filters } : EMPTY_FILTERS) as DataBoardFilters,
  };
}

export function saveViewTemplates(templates: ViewTemplate[]) {
  saveUserPrefs({ databoard: { viewTemplates: templates } });
}
export function saveExportTemplates(templates: ExportTemplate[]) {
  saveUserPrefs({ databoard: { exportTemplates: templates } });
}
export function saveActiveViewId(id: string | null) {
  saveUserPrefs({ databoard: { activeViewId: id } });
}
export function saveFilters(filters: DataBoardFilters) {
  saveUserPrefs({ databoard: { filters } });
}
