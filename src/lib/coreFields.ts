// Registry of built-in job fields. The Settings → Job Form Builder lets admins
// rename / reorder / hide / require these. Locked fields cannot be hidden because
// the totals math depends on them.

export type CoreFieldKey =
  | "job_date" | "company_id" | "tech_percentage_panel" | "marketer_percentage_panel"
  | "technician_id" | "po_number" | "phone_no" | "address" | "comp_type"
  | "job_type" | "status" | "price" | "co_parts" | "office_parts" | "parts"
  | "payment" | "check_no" | "tip" | "cost" | "cc_fee" | "created_by"
  | "installer" | "notes" | "paid";

export type CoreFieldDef = {
  key: CoreFieldKey;
  label: string;
  locked?: boolean;
  defaultRequired?: boolean;
  defaultVisibleInForm: boolean;
  defaultVisibleInRemote: boolean;
  defaultVisibleInParseReview: boolean;
  defaultOrder: number;
  remoteSupported: boolean;
  parseReviewSupported: boolean;
};

export const CORE_FIELDS_DEFAULT: CoreFieldDef[] = [
  { key: "job_date",                  label: "Job Date",                          defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 0,  remoteSupported: true,  parseReviewSupported: true },
  { key: "company_id",                label: "Marketer",                          locked: true, defaultRequired: true, defaultVisibleInForm: true, defaultVisibleInRemote: true, defaultVisibleInParseReview: true, defaultOrder: 1, remoteSupported: true, parseReviewSupported: true },
  { key: "tech_percentage_panel",     label: "Tech % override panel",             defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 2,  remoteSupported: false, parseReviewSupported: false },
  { key: "marketer_percentage_panel", label: "Marketer % override panel",         defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 3,  remoteSupported: false, parseReviewSupported: false },
  { key: "technician_id",             label: "Technician",                        defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 4,  remoteSupported: true,  parseReviewSupported: true },
  { key: "po_number",                 label: "PO Number",                         defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 5,  remoteSupported: true,  parseReviewSupported: true },
  { key: "phone_no",                  label: "Phone",                             defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 6,  remoteSupported: true,  parseReviewSupported: true },
  { key: "address",                   label: "Address",                           defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 7,  remoteSupported: true,  parseReviewSupported: true },
  { key: "comp_type",                 label: "Comp Type",                         defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 8,  remoteSupported: true,  parseReviewSupported: true },
  { key: "job_type",                  label: "Job Type",                          defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 9,  remoteSupported: true,  parseReviewSupported: true },
  { key: "status",                    label: "Status",                            locked: true, defaultVisibleInForm: true, defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 10, remoteSupported: false, parseReviewSupported: false },
  { key: "price",                     label: "Price ($)",                         locked: true, defaultRequired: true, defaultVisibleInForm: true, defaultVisibleInRemote: true, defaultVisibleInParseReview: true, defaultOrder: 11, remoteSupported: true, parseReviewSupported: true },
  { key: "co_parts",                  label: "Co Parts ($) — to Marketer",        defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 12, remoteSupported: true,  parseReviewSupported: true },
  { key: "office_parts",              label: "Office Parts ($) — to Office",      defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 13, remoteSupported: true,  parseReviewSupported: true },
  { key: "parts",                     label: "Parts ($) — to Tech",               defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 14, remoteSupported: true,  parseReviewSupported: true },
  { key: "payment",                   label: "Payment Method",                    defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 15, remoteSupported: true,  parseReviewSupported: true },
  { key: "check_no",                  label: "Check #",                           defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 16, remoteSupported: true,  parseReviewSupported: true },
  { key: "tip",                       label: "Tip ($)",                           defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 17, remoteSupported: true,  parseReviewSupported: true },
  { key: "cost",                      label: "Cost ($)",                          defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 18, remoteSupported: true,  parseReviewSupported: true },
  { key: "cc_fee",                    label: "CC Fee ($)",                        defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 19, remoteSupported: true,  parseReviewSupported: true },
  { key: "created_by",                label: "Created By",                        defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 20, remoteSupported: false, parseReviewSupported: false },
  { key: "installer",                 label: "Installer",                         defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 21, remoteSupported: true,  parseReviewSupported: true },
  { key: "notes",                     label: "Notes",                             defaultVisibleInForm: true,  defaultVisibleInRemote: true,  defaultVisibleInParseReview: true,  defaultOrder: 22, remoteSupported: true,  parseReviewSupported: true },
  { key: "paid",                      label: "Paid",                              defaultVisibleInForm: true,  defaultVisibleInRemote: false, defaultVisibleInParseReview: false, defaultOrder: 23, remoteSupported: true,  parseReviewSupported: true },
];

export type CoreFieldOverride = {
  key: CoreFieldKey;
  label?: string;
  visibleInForm: boolean;
  visibleInRemote: boolean;
  visibleInParseReview: boolean;
  required?: boolean;
  order: number;
};

export type ResolvedCoreField = CoreFieldDef & {
  effectiveLabel: string;
  visibleInForm: boolean;
  visibleInRemote: boolean;
  visibleInParseReview: boolean;
  required: boolean;
  order: number;
};

export function defaultOverrides(): CoreFieldOverride[] {
  return CORE_FIELDS_DEFAULT.map((d) => ({
    key: d.key,
    label: d.label,
    visibleInForm: d.defaultVisibleInForm,
    visibleInRemote: d.defaultVisibleInRemote,
    visibleInParseReview: d.defaultVisibleInParseReview,
    required: !!d.defaultRequired,
    order: d.defaultOrder,
  }));
}

export function getCoreFieldsResolved(overrides?: CoreFieldOverride[] | null): ResolvedCoreField[] {
  const map = new Map<CoreFieldKey, CoreFieldOverride>();
  (overrides || []).forEach((o) => map.set(o.key, o));
  const resolved = CORE_FIELDS_DEFAULT.map((d) => {
    const o = map.get(d.key);
    return {
      ...d,
      effectiveLabel: (o?.label ?? d.label) || d.label,
      visibleInForm: d.locked ? true : (o?.visibleInForm ?? d.defaultVisibleInForm),
      visibleInRemote: d.remoteSupported ? (o?.visibleInRemote ?? d.defaultVisibleInRemote) : false,
      visibleInParseReview: d.parseReviewSupported ? (o?.visibleInParseReview ?? d.defaultVisibleInParseReview) : false,
      required: d.locked ? (!!d.defaultRequired || !!o?.required) : !!o?.required,
      order: o?.order ?? d.defaultOrder,
    } as ResolvedCoreField;
  });
  resolved.sort((a, b) => a.order - b.order);
  return resolved;
}

export function isCoreVisibleInForm(key: CoreFieldKey, overrides?: CoreFieldOverride[] | null): boolean {
  return getCoreFieldsResolved(overrides).find((f) => f.key === key)?.visibleInForm ?? true;
}
export function isCoreVisibleInRemote(key: CoreFieldKey, overrides?: CoreFieldOverride[] | null): boolean {
  return getCoreFieldsResolved(overrides).find((f) => f.key === key)?.visibleInRemote ?? false;
}
export function coreLabel(key: CoreFieldKey, overrides?: CoreFieldOverride[] | null): string {
  return getCoreFieldsResolved(overrides).find((f) => f.key === key)?.effectiveLabel
    ?? CORE_FIELDS_DEFAULT.find((f) => f.key === key)?.label
    ?? key;
}
export function coreRequired(key: CoreFieldKey, overrides?: CoreFieldOverride[] | null): boolean {
  return getCoreFieldsResolved(overrides).find((f) => f.key === key)?.required ?? false;
}
