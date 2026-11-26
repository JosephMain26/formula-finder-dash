import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { compressImage } from "@/lib/compressImage";
import { Button } from "@/components/ui/button";
import { ExternalLink, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { parseW9 } from "@/lib/w9Ai.functions";
import type { W9Parsed } from "@/lib/w9";

const BUCKET = "w9-forms";
const MAX_PDF_BYTES = 10 * 1024 * 1024;

interface W9FieldProps {
  entity: "company" | "installer" | "technician";
  value: string | null;
  onChange: (path: string | null) => void;
  onParsed: (data: W9Parsed) => void;
  onPreview: (url: string) => void;
  onBusy: (busy: boolean) => void;
}

function displayName(path: string): string {
  const file = path.split("/").pop() || path;
  return file.replace(/^\d+-/, "");
}

export function W9Field({ entity, value, onChange, onParsed, onPreview, onBusy }: W9FieldProps) {
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [reading, setReading] = useState(false);
  const parse = useServerFn(parseW9);
  const callbacks = useRef({ onParsed, onPreview, onBusy });
  callbacks.current = { onParsed, onPreview, onBusy };
  useEffect(() => {
    callbacks.current.onBusy(uploading || reading);
  }, [uploading, reading]);
  useEffect(() => {
    let active = true;
    if (!value || !canManage) { callbacks.current.onPreview(""); return; }
    supabase.storage.from(BUCKET).createSignedUrl(value, 3600).then(({ data, error }) => {
      if (active) {
        callbacks.current.onPreview(data?.signedUrl || "");
        if (error) toast.error("Could not preview the W9. Use View or try again.");
      }
    });
    return () => { active = false; };
  }, [value, canManage]);
  async function readW9(path: string) {
    setReading(true);
    try {
      const parsed = await parse({ data: { path } });
      callbacks.current.onParsed(parsed);
      const found = Object.entries(parsed).filter(([, v]) => !!v).map(([key]) => ({ name: "Name", business_name: "Business name", address: "Address", city: "City", state: "State", zip: "ZIP", email: "Email", phone: "Phone", tax_id_type: "Tax ID type", tax_id: "SSN / EIN" })[key as keyof W9Parsed]);
      toast.success(found.length ? `W9 read: ${found.join(", ")}. Empty fields filled; review before saving.` : "No completed fields found. Enter the details manually.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read W9. Enter details manually."); }
    finally { setReading(false); }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    e.target.value = "";
    if (!raw) return;

    const isPdf = raw.type === "application/pdf";
    const isImg = raw.type.startsWith("image/");
    if (!isPdf && !isImg) {
      toast.error("Please upload a PDF or image file.");
      return;
    }
    if (isPdf && raw.size > MAX_PDF_BYTES) {
      toast.error("PDF must be 10 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const file = isImg ? await compressImage(raw, 180) : raw;
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "w9";
      const path = `${entity}/${Date.now()}-${safe}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        contentType: file.type || undefined,
        upsert: false,
      });
      if (error) {
        toast.error(error.message || "Failed to upload W9.");
        return;
      }
      onChange(path);
      await readW9(path);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload W9.");
    } finally {
      setUploading(false);
    }
  }

  async function handleView() {
    if (!value) return;
    setOpening(true);
    try {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(value, 300);
      if (error || !data?.signedUrl) {
        toast.error(error?.message || "Could not open W9.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(false);
    }
  }

  if (!canManage) {
    return (
      <div>
        <label className="text-xs font-medium text-muted-foreground">W9 Form</label>
        <p className="text-xs text-muted-foreground mt-1">
          {value ? "W9 on file (admins and managers only)" : "No W9 uploaded (admins and managers only)"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">W9 Form (optional)</label>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={handleFile}
      />
      {value ? (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm truncate" title={displayName(value)}>
              {displayName(value)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" onClick={() => readW9(value)} disabled={uploading || reading}>
              {reading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}{reading ? "Reading W9..." : "Re-read W9"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleView} disabled={opening}>
              {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ExternalLink className="h-3.5 w-3.5 mr-1" />}
              View
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || reading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
              Replace
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" disabled={uploading || reading} onClick={() => onChange(null)} title="Remove W9">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || reading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
            {uploading ? "Uploading..." : "Upload W9 (PDF or photo)"}
          </Button>
        </div>
      )}
    </div>
  );
}