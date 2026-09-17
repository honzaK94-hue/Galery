import { Feather } from "@expo/vector-icons";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function DeviceOnly() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top, 67),
          paddingBottom: Math.max(insets.bottom, 34),
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.accent }]}>
        <Feather name="smartphone" size={30} color={colors.accentForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Otevřete Galerii v telefonu
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Fotografie a videa uložené v zařízení jsou dostupné pouze v aplikaci pro
        Android nebo iOS. V Replitu zvolte Náhled v telefonu a naskenujte QR kód
        aplikací Expo Go.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
  },
  title: {
    fontFamily: nativeTheme.fonts.bold,
    fontSize: 24,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    fontFamily: nativeTheme.fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
  },
});