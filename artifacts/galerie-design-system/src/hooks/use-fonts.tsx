import { Roboto_400Regular } from "@expo-google-fonts/roboto/400Regular";
import { Roboto_500Medium } from "@expo-google-fonts/roboto/500Medium";
import { Roboto_700Bold } from "@expo-google-fonts/roboto/700Bold";
import { useFonts } from "@expo-google-fonts/roboto/useFonts";

export function useDesignSystemFonts() {
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
  });
  return { fontsLoaded, fontError };
}
