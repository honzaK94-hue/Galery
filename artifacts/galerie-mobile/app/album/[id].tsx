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
import { router, useLocalSearchParams } from "expo-router";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import { albumStore, mediaStore, type AlbumRow } from "@/db";
import { albumCountLabel } from "@/components/AlbumCards";
import { GalleryHeader } from "@/components/GalleryHeader";
import { useGalleryPreferences } from "@/components/GalleryPreferences";
import { useLibraryFocus } from "@/components/GalleryProvider";
import { MediaGrid } from "@/components/MediaGrid";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";

export default function AlbumScreen() {
  return (
    <MediaPermissionGate requireIndex>
      <AlbumContent />
    </MediaPermissionGate>
  );
}
function AlbumContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const albumId = Number(id);
  const colors = useColors();
  const { sort, density } = useGalleryPreferences();
  const [album, setAlbum] = useState<AlbumRow | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rename, setRename] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const generation = useRef(0);
  const mutating = useRef(false);
  useEffect(
    () => () => {
      generation.current++;
    },
    [],
  );
  const load = async () => {
    const current = ++generation.current;
    if (!Number.isSafeInteger(albumId) || albumId <= 0) {
      setAlbum(null);
      setLoading(false);
      setError("Album nebylo nalezeno.");
      return;
    }
    try {
      const [next, total] = await Promise.all([
        albumStore.getAlbumById(albumId),
        mediaStore.getMediaCountByAlbum(albumId),
      ]);
      if (current !== generation.current) return;
      setAlbum(next);
      setCount(total);
      setError(next ? null : "Album již není dostupné.");
    } catch {
      if (current === generation.current)
        setError("Album se nepodařilo načíst.");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  useLibraryFocus(load);
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(album?.type === "hidden" ? "/hidden" : "/albums");
  };
  const save = async () => {
    if (mutating.current || !name.trim()) return;
    mutating.current = true;
    setBusy(true);
    setRenameError(null);
    try {
      await albumStore.renameAlbum(albumId, name.trim());
      setAlbum((current) =>
        current ? { ...current, name: name.trim() } : current,
      );
      setRename(false);
      void load();
    } catch (e) {
      setRenameError(
        e instanceof Error ? e.message : "Přejmenování se nezdařilo.",
      );
    } finally {
      mutating.current = false;
      setBusy(false);
    }
  };
  const remove = () => {
    if (!album || mutating.current) return;
    Alert.alert(
      "Smazat album?",
      album.type === "hidden"
        ? "Odstraní se pouze album. Fotky a videa zůstanou v telefonu a nadále je najdete mezi skrytými položkami."
        : "Odstraní se pouze album. Fotky a videa zůstanou v telefonu.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat album",
          style: "destructive",
          onPress: async () => {
            if (mutating.current) return;
            mutating.current = true;
            setBusy(true);
            try {
              await albumStore.deleteAlbum(albumId);
              back();
            } catch (e) {
              Alert.alert(
                "Album se nepodařilo smazat",
                e instanceof Error ? e.message : "Zkuste to znovu.",
              );
            } finally {
              mutating.current = false;
              setBusy(false);
            }
          },
        },
      ],
    );
  };
  const menu = () => {
    if (!album || busy) return;
    Alert.alert(
      album.name,
      album.type === "hidden" ? "Skryté album" : "Vlastní album",
      [
        {
          text: "Přejmenovat",
          onPress: () => {
            setName(album.name);
            setRenameError(null);
            setRename(true);
          },
        },
        { text: "Smazat album", style: "destructive", onPress: remove },
        { text: "Zrušit", style: "cancel" },
      ],
    );
  };
  const header = (
    <GalleryHeader
      title={album?.name ?? "Album"}
      subtitle={
        album
          ? `${album.type === "hidden" ? "Skryté album · " : ""}${albumCountLabel(count)}`
          : undefined
      }
      onBack={back}
      onMenu={menu}
      onSearch={
        album
          ? () => {
              setSearch(!search);
              setQuery("");
            }
          : undefined
      }
    >
      {search ? (
        <TextInput
          autoFocus
          accessibilityLabel="Hledat v albu podle názvu souboru"
          placeholder="Název souboru…"
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={setQuery}
          style={[
            styles.search,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
        />
      ) : null}
      {error && album ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={styles.notice}
        >
          <Text style={{ color: colors.destructive }}>
            {error} · Zkusit znovu
          </Text>
        </Pressable>
      ) : null}
    </GalleryHeader>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {album ? (
        <MediaGrid
          key={album.id}
          source={{
            kind: "album",
            id: String(album.id),
            albumType: album.type,
          }}
          header={header}
          sort={sort}
          density={density}
          query={query}
          emptyText={
            query
              ? "Žádná odpovídající média"
              : album.type === "hidden"
                ? "Album je prázdné. Ve Skryté → Položky podržte médium a přidejte ho do tohoto alba."
                : "Album je prázdné. Ve Fotkách nebo Videích podržte médium a přidejte ho do tohoto alba."
          }
        />
      ) : (
        <>
          {header}
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Text
                  style={[styles.emptyText, { color: colors.mutedForeground }]}
                >
                  {error ?? "Album není dostupné."}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setLoading(true);
                    void load();
                  }}
                  style={[styles.button, { backgroundColor: colors.accent }]}
                >
                  <Text style={{ color: colors.primary }}>Zkusit znovu</Text>
                </Pressable>
              </>
            )}
          </View>
        </>
      )}
      <Modal
        visible={rename}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setRename(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalScroll}
          >
            <View
              style={[
                styles.modal,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Přejmenovat album
              </Text>
              <TextInput
                accessibilityLabel="Název alba"
                autoFocus
                selectTextOnFocus
                maxLength={80}
                value={name}
                editable={!busy}
                onChangeText={setName}
                onSubmitEditing={() => void save()}
                style={[
                  styles.input,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              />
              {renameError ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: colors.destructive }}
                >
                  {renameError}
                </Text>
              ) : null}
              <View style={styles.modalActions}>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => setRename(false)}
                  style={styles.button}
                >
                  <Text style={{ color: colors.mutedForeground }}>Zrušit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !name.trim()}
                  onPress={() => void save()}
                  style={[
                    styles.button,
                    {
                      backgroundColor: colors.primary,
                      opacity: busy || !name.trim() ? 0.45 : 1,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={{ color: colors.primaryForeground }}>
                      Uložit
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: {
    minHeight: 46,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  notice: { padding: 16 },
  empty: {
    flex: 1,
    padding: 28,
    gap: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  button: {
    minHeight: 46,
    minWidth: 96,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 13,
  },
  overlay: { flex: 1, backgroundColor: "#020711BB" },
  modalScroll: {
    flexGrow: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  modal: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    gap: 18,
  },
  modalTitle: { fontSize: 20, fontFamily: nativeTheme.fonts.bold },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 13,
    fontSize: 16,
  },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
});
