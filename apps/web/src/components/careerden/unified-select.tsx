import { Combobox } from "@base-ui/react/combobox";
import { Check, ChevronsUpDown } from "lucide-react";

export interface UnifiedSelectOption {
  label: string;
  leading?: React.ReactNode;
  searchText?: string;
  value: string;
}

export function UnifiedSelect({
  label,
  options,
  placeholder,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: UnifiedSelectOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const selected = options.find((option) => option.value === value) ?? null;

  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <Combobox.Root
        items={options}
        value={selected}
        disabled={disabled}
        onValueChange={(option) => onChange(option?.value ?? "")}
        itemToStringLabel={(option) => option.label}
        isItemEqualToValue={(option, selectedOption) => option.value === selectedOption.value}
        filter={(option, query) =>
          `${option.label} ${option.value} ${option.searchText ?? ""}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())
        }
      >
        <div className="relative mt-1.5">
          <Combobox.Input
            placeholder={placeholder}
            className="h-9 w-full rounded-md border border-border bg-background py-0 pr-9 pl-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <Combobox.Trigger
            aria-label={`Open ${label.toLowerCase()} options`}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground"
          >
            <ChevronsUpDown className="size-4" />
          </Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner sideOffset={4} align="start" className="z-50">
            <Combobox.Popup className="max-h-64 w-[var(--anchor-width)] min-w-56 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
              <Combobox.Empty className="px-3 py-2 text-sm text-muted-foreground">
                No options found
              </Combobox.Empty>
              <Combobox.List className="m-0 max-h-60 list-none overflow-y-auto px-1 py-0">
                {(option: UnifiedSelectOption) => (
                  <Combobox.Item
                    key={option.value}
                    value={option}
                    className="flex cursor-default items-center gap-2 rounded-sm px-2 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  >
                    {option.leading && (
                      <span className="flex size-5 shrink-0 items-center justify-center text-base">
                        {option.leading}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <Combobox.ItemIndicator className="text-primary">
                      <Check className="size-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </label>
  );
}
