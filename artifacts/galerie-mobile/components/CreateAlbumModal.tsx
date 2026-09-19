import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { albumStore, type AlbumRow, type AlbumType } from "@/db";
import { VaultGate } from "./VaultGate";
import { useVault, useVaultProtection } from "./VaultProvider";

export function CreateAlbumModal({
  visible,
  initialType = "normal",
  onClose,
  onCreated,
}: {
  visible: boolean;
  initialType?: AlbumType;
  onClose: () => void;
  onCreated: (album: AlbumRow) => void;
}) {
  const colors = useColors();
  const vault = useVault();
  const protection = useVaultProtection(visible);
  const [name, setName] = useState("");
  const [type, setType] = useState<AlbumType>(initialType);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  useEffect(() => {
    if (visible && protection.error) {
      Alert.alert("Ochrana skrytých alb", protection.error, [
        { text: "Zavřít", style: "cancel", onPress: onClose },
        { text: "Zkusit znovu", onPress: protection.retry },
      ]);
    }
  }, [visible, protection.error, protection.retry, onClose]);
  useEffect(() => {
    if (visible) {
      setName("");
      setType(initialType);
      setError(null);
    }
  }, [visible, initialType]);
  const create = async () => {
    if (saving.current || !name.trim()) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      if (type === "hidden" && !vault.canAccess()) {
        if (!(await vault.unlock()) || !vault.canAccess()) return;
      }
      const album = await albumStore.createAlbum(name.trim(), type);
      onCreated(album);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Album se nepodařilo vytvořit. Zkuste to znovu.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      visible={visible && protection.ready}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Nové album
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zavřít"
                disabled={busy}
                onPress={onClose}
                style={styles.iconButton}
              >
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {type !== "hidden" || vault.canAccess() ? (
              <TextInput
                accessibilityLabel="Název alba"
                testID="input-album-name"
                placeholder="Název alba"
                placeholderTextColor={colors.mutedForeground}
                autoFocus
                maxLength={80}
                value={name}
                editable={!busy}
                onChangeText={setName}
                onSubmitEditing={() => void create()}
                returnKeyType="done"
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
              />
            ) : null}
            <View
              accessibilityRole="tablist"
              style={[styles.types, { backgroundColor: colors.background }]}
            >
              {(["normal", "hidden"] as const).map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: type === value }}
                  disabled={busy}
                  onPress={() => {
                    if (type === "hidden" && !vault.canAccess()) setName("");
                    setType(value);
                  }}
                  style={[
                    styles.typeButton,
                    {
                      backgroundColor:
                        type === value ? colors.accent : "transparent",
                    },
                  ]}
                >
                  <Feather
                    name={value === "hidden" ? "eye-off" : "folder"}
                    size={18}
                    color={
                      type === value ? colors.primary : colors.mutedForeground
                    }
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color:
                          type === value
                            ? colors.foreground
                            : colors.mutedForeground,
                      },
                    ]}
                  >
                    {value === "normal" ? "Normální album" : "Skryté album"}
                  </Text>
                </Pressable>
              ))}
            </View>
            {type === "hidden" ? (
              <VaultGate compact>
                <></>
              </VaultGate>
            ) : null}
            <Text
              style={[styles.description, { color: colors.mutedForeground }]}
            >
              {type === "hidden"
                ? "Bude dostupné ve Více → Skryté. Přidaná média se skryjí z běžných přehledů Galerie. Soubory zůstávají dostupné ostatním aplikacím."
                : "Vlastní album pro vaše fotky a videa. Soubory v telefonu se nekopírují ani nepřesouvají."}
            </Text>
            {error ? (
              <Text
                accessibilityRole="alert"
                style={[styles.description, { color: colors.destructive }]}
              >
                {error}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              testID="btn-create-confirm"
              disabled={busy || !name.trim()}
              onPress={() => void create()}
              style={[
                styles.confirm,
                {
                  backgroundColor: colors.primary,
                  opacity: busy || !name.trim() ? 0.45 : 1,
                },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Feather
                  name="plus"
                  size={19}
                  color={colors.primaryForeground}
                />
              )}
              <Text
                style={[
                  styles.confirmLabel,
                  { color: colors.primaryForeground },
                ]}
              >
                {busy ? "Vytvářím…" : "Vytvořit album"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#020711BB" },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 21, fontFamily: nativeTheme.fonts.bold },
  iconButton: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  types: { flexDirection: "row", padding: 4, borderRadius: 14, gap: 4 },
  typeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 68,
    borderRadius: 11,
    padding: 8,
    gap: 6,
  },
  typeLabel: {
    fontFamily: nativeTheme.fonts.medium,
    fontSize: 12,
    textAlign: "center",
  },
  description: { fontSize: 13, lineHeight: 20 },
  confirm: {
    minHeight: 48,
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  confirmLabel: { fontSize: 15, fontFamily: nativeTheme.fonts.medium },
});
