import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState, Linking, Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as ScreenCapture from "expo-screen-capture";
import { settingsStore } from "@/db";

export type VaultCapability = {
  biometricHardware: boolean;
  biometricsEnrolled: boolean;
  deviceCredential: boolean;
};
type VaultContextValue = {
  enabled: boolean;
  unlocked: boolean;
  ready: boolean;
  authenticating: boolean;
  capability: VaultCapability | null;
  error: string | null;
  unlock: () => Promise<boolean>;
  lock: () => void;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  canAccess: () => boolean;
  refreshCapability: () => Promise<VaultCapability | null>;
  openSecuritySettings: () => Promise<void>;
};
const VaultContext = createContext<VaultContextValue | null>(null);
const SETTING_KEY = "hidden_lock_enabled";

/** The Android device credential prompt briefly backgrounds the app itself. */
function waitForForeground(): Promise<boolean> {
  if (AppState.currentState === "active") return Promise.resolve(true);
  return new Promise((resolve) => {
    const finish = (active: boolean) => {
      clearTimeout(timeout);
      listener.remove();
      resolve(active);
    };
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") finish(true);
    });
    const timeout = setTimeout(() => finish(false), 1500);
  });
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [enabled, updateEnabled] = useState(true);
  const [unlocked, updateUnlocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [capability, setCapability] = useState<VaultCapability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const state = useRef({ enabled: true, unlocked: false, ready: false });
  const mounted = useRef(true);
  const authentication = useRef<Promise<boolean> | null>(null);
  const authGeneration = useRef(0);
  const changing = useRef(false);
  const lock = useCallback(() => {
    authGeneration.current++;
    state.current.unlocked = false;
    if (mounted.current) updateUnlocked(false);
  }, []);
  const canAccess = useCallback(
    () =>
      state.current.ready && (!state.current.enabled || state.current.unlocked),
    [],
  );
  const refreshCapability = useCallback(async () => {
    if (Platform.OS === "web") return null;
    try {
      const [biometricHardware, biometricsEnrolled, level] = await Promise.all([
        LocalAuthentication.hasHardwareAsync(),
        LocalAuthentication.isEnrolledAsync(),
        LocalAuthentication.getEnrolledLevelAsync(),
      ]);
      const next = {
        biometricHardware,
        biometricsEnrolled,
        deviceCredential: level !== LocalAuthentication.SecurityLevel.NONE,
      };
      if (mounted.current) setCapability(next);
      return next;
    } catch {
      if (mounted.current) setCapability(null);
      return null;
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        const value =
          Platform.OS === "web"
            ? null
            : await settingsStore.getSetting(SETTING_KEY);
        if (!mounted.current) return;
        state.current.enabled = value !== "false";
        updateEnabled(state.current.enabled);
      } catch {
        if (mounted.current)
          setError(
            "Nastavení zámku nelze načíst. Skryté položky zůstávají zamčené.",
          );
      } finally {
        if (mounted.current) {
          state.current.ready = true;
          setReady(true);
        }
      }
      await refreshCapability();
    })();
    const listener = AppState.addEventListener("change", (next) => {
      if (next !== "active") {
        // Always hide protected content. Do not cancel the system credential
        // activity; only its successful result may establish a fresh session.
        state.current.unlocked = false;
        updateUnlocked(false);
        if (!authentication.current) authGeneration.current++;
      } else {
        void refreshCapability();
      }
    });
    return () => {
      mounted.current = false;
      authGeneration.current++;
      state.current.unlocked = false;
      listener.remove();
    };
  }, [refreshCapability]);

  const authenticate = useCallback(
    (force = false): Promise<boolean> => {
      if (!force && canAccess()) return Promise.resolve(true);
      if (!state.current.ready || Platform.OS === "web")
        return Promise.resolve(false);
      if (authentication.current) return authentication.current;
      const generation = authGeneration.current;
      setAuthenticating(true);
      setError(null);
      const task = (async () => {
        try {
          const available = await refreshCapability();
          if (!available) {
            setError("Ověření zabezpečení není dostupné. Zkuste to znovu.");
            return false;
          }
          if (!available.deviceCredential) {
            setError(
              "Nejdřív nastavte v zabezpečení telefonu PIN, gesto nebo heslo. Potom můžete přidat otisk prstu.",
            );
            return false;
          }
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Odemknout skryté položky Galerie",
            promptSubtitle: "Ověřte se otiskem prstu nebo zámkem telefonu",
            cancelLabel: "Zrušit",
            fallbackLabel: "Použít kód telefonu",
            disableDeviceFallback: false,
            biometricsSecurityLevel: "strong",
          });
          if (!result.success) {
            if (
              !["user_cancel", "app_cancel", "system_cancel"].includes(
                result.error,
              )
            ) {
              setError(
                result.error === "lockout"
                  ? "Biometrie je dočasně zablokovaná. Odemkněte telefon jeho PINem a zkuste to znovu."
                  : "Ověření se nezdařilo. Použijte otisk prstu nebo zámek telefonu.",
              );
            }
            return false;
          }
          const active = await waitForForeground();
          if (
            !active ||
            !mounted.current ||
            generation !== authGeneration.current
          )
            return false;
          state.current.unlocked = true;
          updateUnlocked(true);
          return true;
        } catch {
          if (mounted.current)
            setError(
              "Odemknutí se nezdařilo. Skryté položky zůstávají zamčené.",
            );
          return false;
        } finally {
          authentication.current = null;
          if (mounted.current) setAuthenticating(false);
        }
      })();
      authentication.current = task;
      return task;
    },
    [canAccess, refreshCapability],
  );
  const unlock = useCallback(() => authenticate(), [authenticate]);
  const setEnabled = useCallback(
    async (value: boolean) => {
      if (!state.current.ready || changing.current) return false;
      if (value === state.current.enabled) return true;
      changing.current = true;
      try {
        // Disabling protection always asks again, even in an unlocked session.
        if (!(await authenticate(true))) return false;
        if (AppState.currentState !== "active" || !state.current.unlocked)
          return false;
        await settingsStore.setSetting(SETTING_KEY, String(value));
        state.current.enabled = value;
        updateEnabled(value);
        if (value) lock();
        return true;
      } catch {
        setError(
          "Změnu zámku se nepodařilo uložit. Původní nastavení zůstalo zachováno.",
        );
        return false;
      } finally {
        changing.current = false;
      }
    },
    [authenticate, lock],
  );
  const openSecuritySettings = useCallback(async () => {
    try {
      if (Platform.OS === "android")
        await Linking.sendIntent("android.settings.SECURITY_SETTINGS");
      else await Linking.openSettings();
    } catch {
      setError(
        "Otevřete Nastavení telefonu → Zabezpečení a nastavte zámek obrazovky.",
      );
    }
  }, []);
  const value = useMemo(
    () => ({
      enabled,
      unlocked,
      ready,
      authenticating,
      capability,
      error,
      unlock,
      lock,
      setEnabled,
      canAccess,
      refreshCapability,
      openSecuritySettings,
    }),
    [
      enabled,
      unlocked,
      ready,
      authenticating,
      capability,
      error,
      unlock,
      lock,
      setEnabled,
      canAccess,
      refreshCapability,
      openSecuritySettings,
    ],
  );
  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (!context) throw new Error("useVault requires VaultProvider");
  return context;
}

let captureSequence = 0;
/** Await FLAG_SECURE before rendering any hidden thumbnails or media. */
export function useVaultProtection(active: boolean) {
  const [protectedScreen, setProtectedScreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) {
      setProtectedScreen(false);
      setError(null);
      return;
    }
    let cancelled = false;
    const id = `galerie-hidden-${++captureSequence}`;
    setProtectedScreen(false);
    setError(null);
    const protection = ScreenCapture.preventScreenCaptureAsync(id);
    void protection
      .then(() => {
        if (!cancelled) setProtectedScreen(true);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Ochranu skrytého obsahu před snímáním obrazovky se nepodařilo zapnout.",
          );
      });
    return () => {
      cancelled = true;
      // Wait for the matching prevent call, so a late native completion cannot
      // leave screenshot blocking stuck after the protected route was closed.
      void protection
        .catch(() => {})
        .then(() => ScreenCapture.allowScreenCaptureAsync(id))
        .catch(() => {});
    };
  }, [active, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ready: !active || protectedScreen, error, retry };
}
