"use client";

import { useEffect } from "react";

const legacyOnboardingStorageKey = "link2cv-marketing-onboarding-v1";

export function LegacyOnboardingCleanup() {
  useEffect(() => {
    try {
      window.localStorage.removeItem(legacyOnboardingStorageKey);
    } catch {
      // Storage can be unavailable in restricted browser contexts. Cleanup is best-effort.
    }
  }, []);

  return null;
}
