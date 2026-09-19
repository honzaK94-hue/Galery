import React, { useRef } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { useGallery } from "./GalleryProvider";

export function MediaPermissionGate({
  children,
  requireIndex = false,
}: {
  children: React.ReactNode;
  requireIndex?: boolean;
}) {
  const {
    permission,
    requestPermission,
    refreshPermission,
    chooseMedia,
    ready,
    error,
  } = useGallery();
  const colors = useColors();
  const allowed =
    permission?.granted || permission?.accessPrivileges === "limited";
  const initialized = useRef(false);
  if (ready) initialized.current = true;
  if (!allowed) initialized.current = false;
  const blocked = !allowed || (requireIndex && !ready);
  return (
    <View style={{ flex: 1 }}>
      {allowed && (!requireIndex || initialized.current) ? (
        <View key="content" style={{ flex: 1 }}>
          {permission?.accessPrivileges === "limited" ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void chooseMedia()}
              style={[styles.limited, { backgroundColor: colors.card }]}
            >
              <Text style={{ color: colors.primary }}>
                Přístup jen k vybraným médiím · Změnit výběr
              </Text>
            </Pressable>
          ) : null}
          {children}
        </View>
      ) : null}
      {blocked ? (
        <View
          key="blocked"
          style={[
            StyleSheet.absoluteFill,
            styles.center,
            { backgroundColor: colors.background },
          ]}
          accessibilityViewIsModal
        >
          {(!permission && !error) || (allowed && !ready && !error) ? (
            <ActivityIndicator color={colors.primary} />
          ) : null}
          <Text
            style={{
              color: colors.foreground,
              fontSize: 20,
              textAlign: "center",
            }}
          >
            {allowed ? "Obnovuji knihovnu" : "Přístup k fotkám a videím"}
          </Text>
          <Text style={{ color: colors.mutedForeground, textAlign: "center" }}>
            {error ??
              (allowed
                ? "Kontroluji dostupnost uložených médií."
                : "Povolte přístup ke knihovně nebo vyberte konkrétní fotografie a videa.")}
          </Text>
          {permission && !allowed && permission.canAskAgain ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void requestPermission()}
              style={[styles.button, { backgroundColor: colors.primary }]}
            >
              <Text style={{ color: colors.primaryForeground }}>
                Povolit přístup
              </Text>
            </Pressable>
          ) : null}
          {!allowed && permission ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openSettings()}
              style={styles.button}
            >
              <Text style={{ color: colors.primary }}>Nastavení telefonu</Text>
            </Pressable>
          ) : null}
          {error ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void refreshPermission()}
              style={styles.button}
            >
              <Text style={{ color: colors.primary }}>Zkusit znovu</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  center: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  button: { minHeight: 44, padding: 14, borderRadius: 12 },
  limited: { padding: 12, paddingTop: 36 },
});
