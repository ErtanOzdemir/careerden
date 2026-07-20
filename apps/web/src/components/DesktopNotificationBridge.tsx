import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { notificationsApi } from "../api/notifications.js";

export const notificationsChangedEventName = "link2cv:notifications-changed";

export function DesktopNotificationBridge() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const electronApi = window.electronAPI;
    const consumeActivations = electronApi?.consumePendingNativeNotificationActivations;
    if (!electronApi || typeof consumeActivations !== "function") return;
    const takeActivations = consumeActivations.bind(electronApi);

    let active = true;
    let consuming = false;
    let consumeAgain = false;

    async function consumePendingActivations(): Promise<void> {
      if (consuming) {
        consumeAgain = true;
        return;
      }

      consuming = true;

      do {
        consumeAgain = false;

        try {
          const payload: unknown = await takeActivations();
          if (!active) return;
          const activations = Array.isArray(payload)
            ? payload.filter(isDesktopNotificationActivation)
            : [];

          for (const activation of activations) {
            if (activation.jobApplicationId) {
              navigateRef.current(`/applications/${activation.jobApplicationId}?tab=timeline`);
            }

            try {
              await notificationsApi.markRead(activation.notificationId);
            } catch {
              /* Navigation should still succeed if the read receipt request fails. */
            }

            if (active) dispatchNotificationsChanged();
          }
        } catch {
          /* The desktop bridge is optional; browser behavior remains unchanged. */
        }
      } while (active && consumeAgain);

      consuming = false;
    }

    const unsubscribeArrived = electronApi.onNotificationArrived?.(() => {
      dispatchNotificationsChanged();
    });
    const unsubscribeActivation = electronApi.onNativeNotificationActivationAvailable?.(() => {
      void consumePendingActivations();
    });

    void consumePendingActivations();

    return () => {
      active = false;
      unsubscribeArrived?.();
      unsubscribeActivation?.();
    };
  }, []);

  return null;
}

function dispatchNotificationsChanged(): void {
  window.dispatchEvent(new Event(notificationsChangedEventName));
}

function isDesktopNotificationActivation(value: unknown): value is DesktopNotificationActivation {
  return (
    typeof value === "object" &&
    value !== null &&
    "notificationId" in value &&
    typeof value.notificationId === "string" &&
    (!("jobApplicationId" in value) ||
      value.jobApplicationId === undefined ||
      typeof value.jobApplicationId === "string")
  );
}
