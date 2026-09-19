import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { GalleryHeader } from "./GalleryHeader";
import { useVault, useVaultProtection } from "./VaultProvider";

export function VaultGate({
  children,
  compact = false,
  onBack,
}: {
  children: React.ReactNode;
  compact?: boolean;
  onBack?: () => void;
}) {
  const colors = useColors();
  const vault = useVault();
  const protection = useVaultProtection(true);
  if (vault.ready && (!vault.enabled || vault.unlocked) && protection.ready)
    return <>{children}</>;
  const waiting = !vault.ready || (!protection.ready && !protection.error);
  const needsSetup = vault.capability?.deviceCredential === false;
  return (
    <View
      style={[
        styles.root,
        compact && styles.compact,
        { backgroundColor: colors.background },
      ]}
    >
      {!compact ? (
        <GalleryHeader
          title="Skryté"
          onBack={
            onBack ??
            (() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/(tabs)/more"))
          }
        />
      ) : null}
      <ScrollView contentContainerStyle={styles.content}>
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.accent, borderColor: colors.border },
          ]}
        >
          <Feather name="lock" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Skryté položky jsou zamčené
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          Odemkněte je otiskem prstu nebo PINem, gestem či heslem telefonu. Po
          opuštění aplikace se zámek znovu aktivuje.
        </Text>
        {waiting ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            {protection.error || vault.error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.description, { color: colors.destructive }]}
              >
                {protection.error ?? vault.error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={vault.authenticating}
              onPress={() =>
                protection.error ? protection.retry() : void vault.unlock()
              }
              style={[
                styles.button,
                {
                  backgroundColor: colors.primary,
                  opacity: vault.authenticating ? 0.6 : 1,
                },
              ]}
            >
              {vault.authenticating ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Feather
                  name="unlock"
                  size={20}
                  color={colors.primaryForeground}
                />
              )}
              <Text
                style={[styles.buttonText, { color: colors.primaryForeground }]}
              >
                {vault.authenticating
                  ? "Ověřuji…"
                  : protection.error
                    ? "Zkusit znovu"
                    : "Odemknout"}
              </Text>
            </Pressable>
            {needsSetup ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void vault.openSecuritySettings()}
                style={styles.settings}
              >
                <Text style={{ color: colors.primary }}>
                  Nastavit zabezpečení telefonu
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          Zámek chrání přístup v Galerii. Soubory nejsou šifrované a ostatní
          aplikace k nim mohou mít přístup.
        </Text>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  compact: { flex: 0, flexShrink: 1, minHeight: 120, maxHeight: 360 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 18,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontFamily: nativeTheme.fonts.bold,
    fontSize: 20,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 380,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 49,
    borderRadius: 15,
    paddingHorizontal: 28,
  },
  buttonText: { fontFamily: nativeTheme.fonts.medium, fontSize: 15 },
  settings: { padding: 10 },
  note: { fontSize: 12, lineHeight: 19, textAlign: "center", maxWidth: 390 },
});
