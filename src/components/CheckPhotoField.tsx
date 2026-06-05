import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";

interface CheckPhotoFieldProps {
  label: string;
  /** storage path stored in the job (e.g. "abc.jpg") */
  value: string;
  onChange: (path: string) => void;
  required?: boolean;
}

const BUCKET = "check-photos";

export function CheckPhotoField({ label, value, onChange, required }: CheckPhotoFieldProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    if (!value) { setPreview(null); return; }
    supabase.storage.from(BUCKET).createSignedUrl(value, 3600).then(({ data }) => {
      if (active) setPreview(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [value]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const compressed = await compressImage(file, 150);
    const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
      upsert: false,
      contentType: compressed.type,
    });
    setBusy(false);
    if (error) { toast.error("Upload failed: " + error.message); return; }
    onChange(path);
  }

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}{required ? " *" : ""}</label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {preview ? (
        <div className="relative mt-1 w-full overflow-hidden rounded-md border">
          <img src={preview} alt={label} className="h-32 w-full object-cover" />
          <button
            type="button"
            onClick={() => { onChange(""); if (inputRef.current) inputRef.current.value = ""; }}
            className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground shadow hover:bg-background"
            aria-label="Remove photo"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="mt-1 h-32 w-full flex-col gap-1 border-dashed"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          <span className="text-xs text-muted-foreground">{busy ? "Uploading…" : "Upload photo"}</span>
        </Button>
      )}
    </div>
  );
}
