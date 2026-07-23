import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface DesktopUpdateContextValue {
  checkForUpdates: () => Promise<DesktopUpdateState | undefined>;
  isSupported: boolean;
  restartAndInstall: () => Promise<void>;
  state?: DesktopUpdateState;
}

const DesktopUpdateContext = createContext<DesktopUpdateContextValue>({
  checkForUpdates: async () => undefined,
  isSupported: false,
  restartAndInstall: async () => undefined,
});

export function DesktopUpdateProvider({ children }: { children: ReactNode }) {
  const bridge = window.electronAPI;
  const isSupported = Boolean(
    bridge?.getDesktopUpdateState &&
    bridge.checkForDesktopUpdates &&
    bridge.restartAndInstallDesktopUpdate &&
    bridge.onDesktopUpdateStateChanged,
  );
  const [state, setState] = useState<DesktopUpdateState>();

  useEffect(() => {
    if (!bridge?.getDesktopUpdateState || !bridge.onDesktopUpdateStateChanged || !isSupported) {
      return;
    }

    let isMounted = true;
    const unsubscribe = bridge.onDesktopUpdateStateChanged((nextState) => {
      if (isMounted) setState(nextState);
    });

    void bridge
      .getDesktopUpdateState()
      .then((nextState) => {
        if (isMounted) setState(nextState);
      })
      .catch((error: unknown) => {
        console.error("Could not read desktop update state", error);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [bridge, isSupported]);

  const checkForUpdates = useCallback(async () => {
    return bridge?.checkForDesktopUpdates?.();
  }, [bridge]);

  const restartAndInstall = useCallback(async () => {
    await bridge?.restartAndInstallDesktopUpdate?.();
  }, [bridge]);

  const value = useMemo(
    () => ({ checkForUpdates, isSupported, restartAndInstall, state }),
    [checkForUpdates, isSupported, restartAndInstall, state],
  );

  return <DesktopUpdateContext.Provider value={value}>{children}</DesktopUpdateContext.Provider>;
}

export function useDesktopUpdates(): DesktopUpdateContextValue {
  return useContext(DesktopUpdateContext);
}
