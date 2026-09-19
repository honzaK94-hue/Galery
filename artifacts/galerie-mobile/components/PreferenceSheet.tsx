import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import {
  useGalleryPreferences,
  sortLabels,
  densityLabels,
} from "./GalleryPreferences";

export type PreferenceKind = "sort" | "density" | "appearance";
export function PreferenceSheet({
  kind,
  onClose,
}: {
  kind: PreferenceKind | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const prefs = useGalleryPreferences();
  const options =
    kind === "sort"
      ? Object.entries(sortLabels)
      : kind === "density"
        ? Object.entries(densityLabels)
        : Object.entries({
            dark: "Tmavý",
            light: "Světlý",
            system: "Podle telefonu",
          });
  const value =
    kind === "sort"
      ? prefs.sort
      : kind === "density"
        ? prefs.density
        : prefs.appearance;
  const titles = {
    sort: "Třídit podle",
    density: "Zobrazení časové osy",
    appearance: "Vzhled",
  };
  const descriptions: Record<string, string> = {
    comfortable: "Větší snímky, přehledné denní oddíly",
    compact: "Více snímků na obrazovce, denní oddíly",
    overview: "Hustá mřížka seskupená po měsících a letech",
    newest: "Datum pořízení · od nejnovějších",
    oldest: "Datum pořízení · od nejstarších",
    name: "Abecedně podle názvu souboru",
  };
  const choose = (key: string) => {
    if (kind === "sort") prefs.setSort(key as typeof prefs.sort);
    if (kind === "density") prefs.setDensity(key as typeof prefs.density);
    if (kind === "appearance")
      prefs.setAppearance(key as typeof prefs.appearance);
    onClose();
  };
  return (
    <Modal
      visible={kind !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "#0009",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Zavřít nabídku"
        />
        <View
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            width: "100%",
            maxWidth: 560,
            maxHeight: "90%",
            padding: 22,
            paddingBottom: Math.max(insets.bottom, 20),
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                color: colors.foreground,
                fontSize: 21,
                fontWeight: "700",
                flex: 1,
              }}
            >
              {kind ? titles[kind] : ""}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zavřít"
              onPress={onClose}
              style={{ padding: 10 }}
            >
              <Feather name="x" size={20} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView bounces={false}>
            {options.map(([key, label]) => (
              <Pressable
                key={key}
                accessibilityRole="radio"
                accessibilityState={{ checked: value === key }}
                onPress={() => choose(key)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  minHeight: 64,
                  padding: 13,
                  borderRadius: 14,
                  marginBottom: 5,
                  backgroundColor:
                    value === key ? colors.accent : "transparent",
                }}
              >
                <Feather
                  name={value === key ? "check-circle" : "circle"}
                  color={
                    value === key ? colors.primary : colors.mutedForeground
                  }
                  size={22}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 16 }}>
                    {label}
                  </Text>
                  {descriptions[key] ? (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontSize: 12,
                        marginTop: 4,
                      }}
                    >
                      {descriptions[key]}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
            {kind === "density" ? (
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontSize: 12,
                  marginTop: 12,
                }}
              >
                Mění se pouze hustota a nadpisy. Žádné fotografie se podle data
                neskrývají.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
