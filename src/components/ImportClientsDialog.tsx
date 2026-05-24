import { useState, useMemo } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Field = "name" | "phone" | "email" | "address" | "notes" | "ignore";

const FIELDS: { value: Field; label: string }[] = [
  { value: "ignore", label: "— Ignore —" },
  { value: "name", label: "Name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "address", label: "Address" },
  { value: "notes", label: "Notes" },
];

const PATTERNS: Record<Exclude<Field, "ignore">, string[]> = {
  name: ["name", "fullname", "clientname", "customername", "contact", "contactname"],
  phone: ["phone", "phonenumber", "mobile", "cell", "tel", "telephone", "phone1"],
  email: ["email", "emailaddress", "mail"],
  address: ["address", "street", "streetaddress", "addr", "location", "address1"],
  notes: ["notes", "note", "comments", "description", "remarks"],
};

function norm(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function autoMap(headers: string[]): Record<string, Field> {
  const map: Record<string, Field> = {};
  const used = new Set<Field>();
  // first/last name special case
  const firstIdx = headers.findIndex((h) => norm(h) === "firstname");
  const lastIdx = headers.findIndex((h) => norm(h) === "lastname");
  if (firstIdx >= 0 && lastIdx >= 0) {
    map[headers[firstIdx]] = "name";
    used.add("name");
  }
  for (const h of headers) {
    if (map[h]) continue;
    const n = norm(h);
    let matched: Field = "ignore";
    for (const [field, keys] of Object.entries(PATTERNS) as [Exclude<Field, "ignore">, string[]][]) {
      if (used.has(field)) continue;
      if (keys.includes(n)) { matched = field; break; }
    }
    if (matched !== "ignore") used.add(matched);
    map[h] = matched;
  }
  return map;
}

export function ImportClientsDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, Field>>({});
  const [importing, setImporting] = useState(false);
  const [lastNameCol, setLastNameCol] = useState<string | null>(null);

  function reset() {
    setStep(1); setHeaders([]); setRows([]); setMapping({}); setLastNameCol(null);
  }

  async function handleFile(file: File) {
    const ext = file.name.toLowerCase().split(".").pop();
    let parsedRows: Record<string, any>[] = [];
    let parsedHeaders: string[] = [];

    if (ext === "csv") {
      const text = await file.text();
      const res = Papa.parse<Record<string, any>>(text, { header: true, skipEmptyLines: true });
      parsedRows = res.data;
      parsedHeaders = res.meta.fields || [];
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
      parsedRows = json;
      parsedHeaders = json.length ? Object.keys(json[0]) : [];
    }

    if (!parsedHeaders.length) {
      toast.error("No columns detected in file");
      return;
    }
    setHeaders(parsedHeaders);
    setRows(parsedRows);
    const m = autoMap(parsedHeaders);
    setMapping(m);
    const last = parsedHeaders.find((h) => norm(h) === "lastname");
    setLastNameCol(last || null);
    setStep(2);
  }

  const preview = useMemo(() => rows.slice(0, 5), [rows]);

  function buildClient(row: Record<string, any>) {
    const obj: Record<string, string | null> = { name: null, phone: null, email: null, address: null, notes: null };
    for (const [col, field] of Object.entries(mapping)) {
      if (field === "ignore") continue;
      const v = String(row[col] ?? "").trim();
      if (!v) continue;
      obj[field] = obj[field] ? `${obj[field]} ${v}`.trim() : v;
    }
    if (lastNameCol && mapping[lastNameCol] === "ignore") {
      const ln = String(row[lastNameCol] ?? "").trim();
      if (ln && obj.name) obj.name = `${obj.name} ${ln}`;
    }
    return obj;
  }

  async function runImport() {
    setImporting(true);
    let inserted = 0, dupes = 0, errors = 0, skipped = 0;
    const payload = rows.map(buildClient).filter((c) => {
      if (!c.name) { skipped++; return false; }
      return true;
    });

    const BATCH = 200;
    for (let i = 0; i < payload.length; i += BATCH) {
      const chunk = payload.slice(i, i + BATCH);
      const { error } = await (supabase as any).from("clients").insert(chunk);
      if (!error) { inserted += chunk.length; continue; }
      // retry one-by-one
      for (const row of chunk) {
        const { error: e2 } = await (supabase as any).from("clients").insert(row);
        if (!e2) inserted++;
        else if (e2.message?.includes("clients_phone_unique")) dupes++;
        else errors++;
      }
    }

    setImporting(false);
    toast.success(`Imported ${inserted}${dupes ? `, ${dupes} duplicates skipped` : ""}${skipped ? `, ${skipped} without name` : ""}${errors ? `, ${errors} errors` : ""}`);
    setOpen(false);
    reset();
    onImported();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4 mr-2" /> Import
      </Button>
      <DialogContent aria-describedby={undefined} className="max-w-3xl w-[calc(100vw-1rem)] sm:w-[calc(100%-2rem)] max-h-[90vh] sm:max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Import Clients {step === 2 && `— ${rows.length} rows`}</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="py-8">
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-accent transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="font-medium">Click to upload CSV or Excel file</p>
                <p className="text-xs text-muted-foreground mt-1">Exports from any CRM are supported</p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Map columns</p>
              <div className="rounded-lg border divide-y">
                {headers.map((h) => (
                  <div key={h} className="flex items-center justify-between gap-3 p-2">
                    <span className="text-sm font-mono truncate flex-1">{h}</span>
                    <Select value={mapping[h]} onValueChange={(v: Field) => setMapping((p) => ({ ...p, [h]: v }))}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELDS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Preview</p>
              <div className="rounded-lg border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Address</TableHead><TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((r, i) => {
                      const c = buildClient(r);
                      return (
                        <TableRow key={i}>
                          <TableCell className={!c.name ? "text-destructive" : ""}>{c.name || "—"}</TableCell>
                          <TableCell>{c.phone || "—"}</TableCell>
                          <TableCell>{c.email || "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{c.address || "—"}</TableCell>
                          <TableCell className="max-w-[160px] truncate">{c.notes || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Rows without a Name will be skipped. Duplicate phone numbers will be skipped automatically.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={importing}>Back</Button>
              <Button onClick={runImport} disabled={importing}>{importing ? "Importing..." : `Import ${rows.length} rows`}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
