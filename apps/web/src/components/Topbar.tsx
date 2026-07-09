import { Button } from "./ui/button.js";
import { Bell, Maximize2, Minus, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { notificationsApi } from "../api/notifications.js";
import type { ApiNotification } from "../api/types.js";

export function Topbar({
  title,
  subtitle,
  onAddJob,
}: {
  title: string;
  subtitle?: string;
  onAddJob: () => void;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  const electronApi = typeof window === "undefined" ? undefined : window.electronAPI;
  const showWindowControls = Boolean(
    electronApi?.platform !== "darwin" &&
    electronApi?.minimizeWindow &&
    electronApi.maximizeWindow &&
    electronApi.closeWindow,
  );

  useEffect(() => {
    let isMounted = true;

    async function loadUnreadCount() {
      try {
        const result = await notificationsApi.unreadCount();
        if (isMounted) {
          setUnreadCount(result.count);
        }
      } catch {
        /* ignore */
      }
    }

    void loadUnreadCount();
    const interval = window.setInterval(() => void loadUnreadCount(), 30_000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }

    function closeNotificationsOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        notificationsMenuRef.current &&
        !notificationsMenuRef.current.contains(target)
      ) {
        setNotificationsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeNotificationsOnOutsideClick);

    return () => {
      document.removeEventListener("pointerdown", closeNotificationsOnOutsideClick);
    };
  }, [notificationsOpen]);

  async function toggleNotifications() {
    const next = !notificationsOpen;
    setNotificationsOpen(next);

    if (!next) {
      return;
    }

    try {
      const items = await notificationsApi.list();
      setNotifications(items);
      setUnreadCount(items.filter((item) => !item.readAt).length);
    } catch {
      setNotifications([]);
    }
  }

  async function markRead(id: string) {
    const wasUnread = notifications.some((item) => item.id === id && !item.readAt);
    const updated = await notificationsApi.markRead(id);
    setNotifications((items) => items.map((item) => (item.id === id ? updated : item)));
    if (wasUnread) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
  }

  async function markAllRead() {
    await notificationsApi.markAllRead();
    setNotifications((items) =>
      items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })),
    );
    setUnreadCount(0);
  }

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

      <div ref={notificationsMenuRef} className="relative [-webkit-app-region:no-drag]">
        <Button
          className="relative [-webkit-app-region:no-drag]"
          variant="outline"
          size="icon"
          aria-label="Notifications"
          onClick={() => void toggleNotifications()}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[0.6rem] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>

        {notificationsOpen && (
          <div className="absolute top-11 right-0 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              <button
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
                type="button"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    className="block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60"
                    type="button"
                    onClick={() => void markRead(notification.id)}
                  >
                    <div className="flex items-start gap-2">
                      {!notification.readAt && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{notification.title}</p>
                        {notification.body && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {notification.body}
                          </p>
                        )}
                        <p className="mt-1 text-[0.68rem] text-muted-foreground">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No notifications yet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

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
