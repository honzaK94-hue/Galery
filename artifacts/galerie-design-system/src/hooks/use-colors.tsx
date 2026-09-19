import { useColorScheme } from "react-native";
import { useSyncExternalStore } from "react";
import { nativeTheme } from "../lib/native-theme";

export type AppearancePreference = "dark" | "light" | "system";
let appearance: AppearancePreference = "dark";
const listeners = new Set<() => void>();
export function setAppearancePreference(value: AppearancePreference) {
  appearance = value;
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useColors() {
  const selected = useSyncExternalStore(
    subscribe,
    () => appearance,
    () => "dark" as AppearancePreference,
  );
  const system = useColorScheme();
  return (selected === "system" ? system === "dark" : selected === "dark")
    ? nativeTheme.color.dark
    : nativeTheme.color.light;
}
