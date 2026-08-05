import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/compressImage";

const BUCKET = "check-photos";
const MAX_KB = 180;

interface JobPhotosFieldProps {
  /** storage paths */
  value: string[];
  onChange: (paths: string[]) => void;
}

export function JobPhotosField({ value, onChange }: JobPhotosFieldProps) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const missing = value.filter((p) => p && !urls[p]);
    if (!missing.length) return;
    Promise.all(
      missing.map((p) =>
        supabase.storage.from(BUCKET).createSignedUrl(p, 3600).then(({ data }) => [p, data?.signedUrl ?? ""] as const)
      )
    ).then((pairs) => {
      if (!active) return;
      setUrls((prev) => {
        const next = { ...prev };
        pairs.forEach(([p, u]) => { if (u) next[p] = u; });
        return next;
      });
    });
    return () => { active = false; };
  }, [value, urls]);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const compressed = await compressImage(file, MAX_KB);
      const ext = (compressed.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
        upsert: false,
        contentType: compressed.type,
      });
      if (error) { toast.error("Upload failed: " + error.message); continue; }
      added.push(path);
    }
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (added.length) onChange([...value, ...added]);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {value.map((p) => (
          <div key={p} className="relative overflow-hidden rounded-md border">
            <Dialog>
              <DialogTrigger asChild>
                <img
                  src={urls[p] || ""}
                  alt="Job photo"
                  className="h-24 w-full object-cover cursor-zoom-in bg-muted"
                />
              </DialogTrigger>
              <DialogContent className="max-w-3xl p-2">
                <img src={urls[p] || ""} alt="Job photo" className="w-full rounded-md" />
              </DialogContent>
            </Dialog>
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== p))}
              className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground shadow hover:bg-background"
              aria-label="Remove photo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="h-24 w-full flex-col gap-1 border-dashed"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[11px] text-muted-foreground">{busy ? "Uploading…" : "Add photos"}</span>
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">Photos are compressed to under {MAX_KB} KB each.</p>
    </div>
  );
}
