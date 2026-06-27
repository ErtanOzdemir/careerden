import { Button } from "./ui/button.js";
import { Search, Plus, Bell } from "lucide-react";

export function Topbar({
  title,
  subtitle,
  onAddJob,
}: {
  title: string;
  subtitle?: string;
  onAddJob: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>

      <div className="relative hidden md:block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search applications..."
          className="h-9 w-56 rounded-lg border border-input bg-card pr-3 pl-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20"
        />
      </div>

      <Button variant="outline" size="icon" aria-label="Notifications">
        <Bell className="size-4" />
      </Button>

      <Button onClick={onAddJob}>
        <Plus className="size-4" />
        Add LinkedIn job
      </Button>
    </header>
  );
}
