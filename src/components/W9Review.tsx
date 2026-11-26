import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { emptyW9Details, mergeEmptyFields, type W9Details, type W9Entity, type W9Parsed } from "@/lib/w9";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export function useW9Review(entity: W9Entity, id: string | undefined, open: boolean) {
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const [details, setDetails] = useState<W9Details>({ ...emptyW9Details });
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [savedId, setSavedId] = useState<string | undefined>(id);
  useEffect(() => {
    if (!open || !canManage) return;
    let active = true;
    setLoadError(false);
    if (!id) { setDetails({ ...emptyW9Details }); setSavedId(undefined); return; }
    setLoading(true);
    supabase.from("w9_details").select("*").eq("entity_type", entity).eq("entity_id", id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      setLoading(false);
      setLoadError(!!error);
      if (error) toast.error("Could not load private W9 details. Close and reopen this form before saving.");
      setDetails(data ? { business_name: data.business_name, address: data.address, city: data.city, state: data.state, zip: data.zip, tax_id_type: data.tax_id_type, tax_id: data.tax_id } : { ...emptyW9Details });
    });
    return () => { active = false; };
  }, [open, id, entity, canManage]);

  function applyParsed(parsed: W9Parsed) {
    const extracted = Object.fromEntries(Object.keys(emptyW9Details).map(key => [key, parsed[key as keyof W9Parsed] || ""])) as W9Details;
    setDetails(prev => mergeEmptyFields(prev, extracted));
  }
  async function saveDetails(recordId: string) {
    setSavedId(recordId);
    if (!canManage) return;
    if (loadError) throw new Error("Private details could not be loaded; reopen the form.");
    if (details.tax_id && (!/^\d{9}$/.test(details.tax_id) || !details.tax_id_type)) throw new Error("Choose SSN or EIN and enter exactly 9 digits.");
    const { error } = await supabase.from("w9_details").upsert({ ...details, entity_type: entity, entity_id: recordId });
    if (error) throw new Error("The contact was saved, but W9 details were not. Keep this form open and try Save again.");
  }
  return { details, setDetails, preview, setPreview, busy, setBusy, loading, loadError, canManage, applyParsed, saveDetails, savedId };
}

export function W9ReviewLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return <div className={preview ? "grid min-w-0 gap-6 md:grid-cols-2" : "min-w-0"}>
    {preview && <details open className="min-w-0 md:sticky md:top-0 md:self-start">
      <summary className="mb-2 cursor-pointer text-sm font-medium">W9 form</summary>
      {/\.pdf(?:\?|$)/i.test(preview)
        ? <iframe title="W9 document preview" src={preview} className="h-[420px] w-full rounded-md border md:h-[65vh]" />
        : <div className="max-h-[65vh] overflow-auto rounded-md border"><img src={preview} alt="Uploaded W9 form" className="h-auto w-full" /></div>}
    </details>}
    <div className="min-w-0">{children}</div>
  </div>;
}

export function W9DetailsFields({ details, onChange, disabled }: { details: W9Details; onChange: (value: W9Details) => void; disabled: boolean }) {
  const [reveal, setReveal] = useState(false);
  return <fieldset disabled={disabled} className="space-y-3">
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-muted-foreground">Tax ID type
        <Select value={details.tax_id_type || "none"} onValueChange={value => onChange({ ...details, tax_id_type: value === "none" ? "" : value })} disabled={disabled}>
          <SelectTrigger aria-label="Tax ID type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">Not selected</SelectItem><SelectItem value="SSN">SSN</SelectItem><SelectItem value="EIN">EIN</SelectItem></SelectContent>
        </Select>
      </label>
      <label className="text-xs font-medium text-muted-foreground">SSN / EIN
        <div className="flex gap-1"><Input aria-label="SSN / EIN" type={reveal ? "text" : "password"} autoComplete="off" inputMode="numeric" maxLength={9} pattern="[0-9]{9}" value={details.tax_id} onChange={e => onChange({ ...details, tax_id: e.target.value.replace(/\D/g, "").slice(0, 9) })} />
          <Button type="button" size="icon" variant="ghost" title={reveal ? "Hide tax ID" : "Show tax ID"} aria-label={reveal ? "Hide tax ID" : "Show tax ID"} onClick={() => setReveal(!reveal)}>{reveal ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button>
        </div>
      </label>
    </div>
    {([['business_name', 'Business name (W9)'], ['address', 'Mailing address'], ['city', 'Mailing city'], ['state', 'State'], ['zip', 'ZIP code']] as const).map(([key, label]) => <label key={key} className="block text-xs font-medium text-muted-foreground">{label}<Input aria-label={label} value={details[key]} maxLength={255} onChange={e => onChange({ ...details, [key]: e.target.value })} /></label>)}
  </fieldset>;
}