import { Button } from "./ui/button.js";
import { Bell, Maximize2, Minus, Plus, Search, X } from "lucide-react";
import type { ReactNode } from "react";

export function Topbar({
  title,
  subtitle,
  onAddJob,
}: {
  title: string;
  subtitle?: string;
  onAddJob: () => void;
}) {
  const electronApi = typeof window === "undefined" ? undefined : window.electronAPI;
  const showWindowControls = Boolean(
    electronApi?.platform !== "darwin" &&
    electronApi?.minimizeWindow &&
    electronApi.maximizeWindow &&
    electronApi.closeWindow,
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur [-webkit-app-region:drag]">
      {showWindowControls ? (
        <div className="flex items-center gap-1 [-webkit-app-region:no-drag]">
          <WindowControlButton
            ariaLabel="Close window"
            className="hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600"
            onClick={() => void electronApi?.closeWindow?.()}
          >
            <X className="size-3.5" />
          </WindowControlButton>
          <WindowControlButton
            ariaLabel="Minimize window"
            onClick={() => void electronApi?.minimizeWindow?.()}
          >
            <Minus className="size-3.5" />
          </WindowControlButton>
          <WindowControlButton
            ariaLabel="Maximize or restore window"
            onClick={() => void electronApi?.maximizeWindow?.()}
          >
            <Maximize2 className="size-3.5" />
          </WindowControlButton>
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold text-foreground">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>

      <div className="relative hidden [-webkit-app-region:no-drag] md:block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Search applications..."
          className="h-9 w-56 rounded-lg border border-input bg-card pr-3 pl-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20 [-webkit-app-region:no-drag]"
        />
      </div>

      <Button
        className="[-webkit-app-region:no-drag]"
        variant="outline"
        size="icon"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
      </Button>

      <Button className="[-webkit-app-region:no-drag]" onClick={onAddJob}>
        <Plus className="size-4" />
        Add LinkedIn job
      </Button>
    </header>
  );
}

function WindowControlButton({
  ariaLabel,
  children,
  className,
  onClick,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={ariaLabel}
      className={`flex size-8 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [-webkit-app-region:no-drag] ${className ?? ""}`}
      type="button"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
