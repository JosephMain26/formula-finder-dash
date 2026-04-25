import { type ReactNode } from "react";
import { GripVertical, X, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  children: ReactNode;
  editing: boolean;
  onRemove?: () => void;
  onConfigure?: () => void;
  rightSlot?: ReactNode;
}

export function WidgetCard({ title, children, editing, onRemove, onConfigure, rightSlot }: Props) {
  return (
    <div className="h-full w-full rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col overflow-hidden">
      <div
        className={`flex items-center justify-between px-3 py-2 border-b text-sm font-medium ${
          editing ? "drag-handle cursor-move bg-muted/40" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {editing && <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />}
          <span className="truncate">{title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {rightSlot}
          {editing && onConfigure && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onConfigure} title="Configure">
              <Settings2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {editing && onRemove && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onRemove} title="Remove">
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-3">{children}</div>
    </div>
  );
}
