import { useColorScheme } from "react-native";
import { nativeTheme } from "../lib/native-theme";

export function useColors() {
  return useColorScheme() === "dark"
    ? nativeTheme.color.dark
    : nativeTheme.color.light;
}