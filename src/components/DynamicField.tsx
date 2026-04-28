import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/DatePickerField";
import type { CustomField } from "@/lib/jobSchema";

interface DynamicFieldProps {
  field: CustomField;
  value: any;
  onChange: (v: any) => void;
}

export function DynamicField({ field, value, onChange }: DynamicFieldProps) {
  const label = (
    <label className="text-xs font-medium text-muted-foreground">
      {field.label}{field.required ? " *" : ""}
    </label>
  );

  if (field.type === "checkbox") {
    return (
      <div className="flex items-center gap-3">
        <Checkbox id={`f_${field.id}`} checked={!!value} onCheckedChange={(v) => onChange(!!v)} />
        <label htmlFor={`f_${field.id}`} className="text-sm cursor-pointer">{field.label}</label>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="col-span-2">
        {label}
        <Textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div>
        {label}
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
          <SelectContent>
            {(field.options || []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        {label}
        <DatePickerField value={value || ""} onChange={onChange} />
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {label}
        <Input type="number" step="0.01" value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />
      </div>
    );
  }

  // text
  return (
    <div>
      {label}
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} required={field.required} />
    </div>
  );
}
