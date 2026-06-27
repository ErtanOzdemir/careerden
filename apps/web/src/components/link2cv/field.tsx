import { cn } from "../../lib/utils.js";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20";

export function Field({
  label,
  defaultValue,
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type={type}
        defaultValue={onChange ? undefined : defaultValue}
        value={onChange ? value : undefined}
        onChange={onChange}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

export function TextAreaField({
  label,
  defaultValue,
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="text-sm font-medium text-foreground">{label}</label>
      <textarea
        defaultValue={onChange ? undefined : defaultValue}
        value={onChange ? value : undefined}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className={cn(inputClass, "resize-none leading-relaxed")}
      />
    </div>
  );
}
