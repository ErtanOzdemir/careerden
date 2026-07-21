import { useId } from "react";
import { cn } from "../../lib/utils.js";

const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20";

export function Field({
  label,
  defaultValue,
  value,
  onChange,
  placeholder,
  readOnly,
  type = "text",
  className,
}: {
  label: string;
  defaultValue?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        type={type}
        defaultValue={value !== undefined || onChange ? undefined : defaultValue}
        value={value !== undefined || onChange ? value : undefined}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
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
  const id = useId();

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        id={id}
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
