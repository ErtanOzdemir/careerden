export class NativeNotificationPermissionRequester {
  private hasAttempted = false;

  constructor(
    private readonly options: {
      initialize: () => unknown;
      isSupported: () => boolean;
      onError?: (error: unknown) => void;
      platform: NodeJS.Platform;
    },
  ) {}

  request(): void {
    if (this.hasAttempted) return;
    this.hasAttempted = true;

    if (this.options.platform !== "darwin") return;

    try {
      if (!this.options.isSupported()) return;

      // Electron 43 asks macOS for notification authorization when its native
      // notification presenter is initialized. Showing a placeholder alert is unnecessary.
      this.options.initialize();
    } catch (error) {
      this.options.onError?.(error);
    }
  }
}
