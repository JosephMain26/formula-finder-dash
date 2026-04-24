import { useState } from "react";
import { Link2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function RemoteLinkButton() {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/upload` : "/upload";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline"><Link2 className="h-4 w-4 mr-2" /> Upload Link</Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <p className="text-sm font-medium">Remote upload link</p>
          <p className="text-xs text-muted-foreground">
            Share this link so technicians can submit jobs (Parse Message or Manual). They'll need
            their personal 6-digit pincode (set in Technicians) to submit. Each submission is
            tagged with their name automatically.
          </p>
          <div className="flex gap-1">
            <Input readOnly value={url} className="h-8 text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={copy} title="Copy link">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-block">
            Open link →
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
