import { Button } from "./ui/button.js";
import { Bell, Maximize2, Minus, Plus, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { notificationsApi } from "../api/notifications.js";
import type { ApiNotification } from "../api/types.js";
import { useCreditBalance } from "../billing/CreditBalanceProvider.js";
import { notificationsChangedEventName } from "./DesktopNotificationBridge.js";
import { TopbarApplicationSearch } from "./TopbarApplicationSearch.js";

export function Topbar({
  title,
  subtitle,
  onAddJob,
}: {
  title: string;
  subtitle?: string;
  onAddJob: () => void;
}) {
  const navigate = useNavigate();
  const { balance, balanceError, isLoading } = useCreditBalance();
  const [searchOpen, setSearchOpen] = useState(false);
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

  const handleSearchOpenChange = useCallback((nextOpen: boolean) => {
    setSearchOpen(nextOpen);
    if (nextOpen) setNotificationsOpen(false);
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const result = await notificationsApi.unreadCount();
      setUnreadCount(result.count);
    } catch {
      /* ignore */
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const items = await notificationsApi.list();
      setNotifications(items);
      setUnreadCount(items.filter((item) => !item.readAt).length);
    } catch {
      setNotifications([]);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    const interval = window.setInterval(() => void loadUnreadCount(), 30_000);

    return () => window.clearInterval(interval);
  }, [loadUnreadCount]);

  useEffect(() => {
    const refreshNotifications = () => {
      if (notificationsOpen) {
        void loadNotifications();
      } else {
        void loadUnreadCount();
      }
    };

    window.addEventListener(notificationsChangedEventName, refreshNotifications);

    return () => {
      window.removeEventListener(notificationsChangedEventName, refreshNotifications);
    };
  }, [loadNotifications, loadUnreadCount, notificationsOpen]);

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
    if (next) setSearchOpen(false);

    if (!next) {
      return;
    }

    await loadNotifications();
  }

  async function openNotification(notification: ApiNotification) {
    const wasUnread = !notification.readAt;
    const updated = await notificationsApi.markRead(notification.id);
    setNotifications((items) =>
      items.map((item) => (item.id === notification.id ? updated : item)),
    );
    if (wasUnread) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setNotificationsOpen(false);

    if (notification.type === "follow_up_reminder" && notification.jobApplicationId) {
      navigate(`/applications/${notification.jobApplicationId}?tab=timeline`);
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

      <Link
        aria-label="AI credits"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted [-webkit-app-region:no-drag]"
        title={balanceError ?? "Open credits and billing"}
        to="/billing"
      >
        <Sparkles className="size-3.5 text-primary" />
        {isLoading
          ? "Credits…"
          : balance
            ? `${balance.availableCredits} credit${balance.availableCredits === 1 ? "" : "s"}`
            : "Credits unavailable"}
        {balance && balance.reservedCredits > 0 ? (
          <span className="text-muted-foreground">({balance.reservedCredits} held)</span>
        ) : null}
      </Link>

      <TopbarApplicationSearch open={searchOpen} onOpenChange={handleSearchOpenChange} />

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
                    onClick={() => void openNotification(notification)}
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
        Add job application
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
