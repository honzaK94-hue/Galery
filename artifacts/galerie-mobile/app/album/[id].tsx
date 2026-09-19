import React, { useState } from "react";
import { Alert, Modal, Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { albumStore, type AlbumWithCount } from "@/db";
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
  const insets = useSafeAreaInsets();
  const [album, setAlbum] = useState<AlbumWithCount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rename, setRename] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setAlbum(
        (await albumStore.getAlbums()).find((item) => item.id === albumId) ??
          null,
      );
      setError(null);
    } catch {
      setError("Album se nepodařilo načíst.");
    }
  };
  useLibraryFocus(load);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await albumStore.renameAlbum(albumId, name);
      setRename(false);
    } catch (e) {
      Alert.alert("Přejmenování se nezdařilo", String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    Alert.alert(
      "Smazat album?",
      "Fotky a videa zůstanou v telefonu. Odstraní se pouze toto vlastní album.",
      [
        { text: "Zrušit", style: "cancel" },
        {
          text: "Smazat album",
          style: "destructive",
          onPress: async () => {
            try {
              await albumStore.deleteAlbum(albumId);
              router.back();
            } catch (e) {
              Alert.alert("Album se nepodařilo smazat", String(e));
            }
          },
        },
      ],
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={{ paddingVertical: 14 }}
          >
            <Text style={{ color: colors.primary }}>Zpět</Text>
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              color: colors.foreground,
              fontSize: 18,
            }}
            numberOfLines={1}
          >
            {album?.name ?? "Album"}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={!album}
            onPress={() => {
              setName(album!.name);
              setRename(true);
            }}
            style={{ padding: 12 }}
          >
            <Text style={{ color: colors.primary }}>Přejmenovat</Text>
          </Pressable>
        </View>
        {album ? (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.mutedForeground }}>
              {album.photo_count} položek
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={remove}
              style={{ paddingVertical: 12 }}
            >
              <Text style={{ color: colors.destructive }}>Smazat album</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => void load()} style={{ padding: 20 }}>
            <Text style={{ color: colors.mutedForeground }}>
              {error ?? "Album není dostupné."} Zkusit znovu
            </Text>
          </Pressable>
        )}
      </View>
      {album ? (
        <MediaGrid
          source={{ kind: "album", id }}
          emptyText="Album je prázdné. Média přidáte podržením položky ve fotografiích nebo videích."
        />
      ) : null}
      <Modal
        visible={rename}
        transparent
        animationType="fade"
        onRequestClose={() => setRename(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "#0008",
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 400,
              padding: 24,
              borderRadius: 12,
              backgroundColor: colors.background,
            }}
          >
            <Text style={{ color: colors.foreground, fontSize: 18 }}>
              Přejmenovat album
            </Text>
            <TextInput
              accessibilityLabel="Název alba"
              autoFocus
              selectTextOnFocus
              maxLength={80}
              value={name}
              onChangeText={setName}
              style={{
                color: colors.foreground,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 12,
                marginVertical: 16,
              }}
            />
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Pressable
                disabled={busy}
                onPress={() => setRename(false)}
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.mutedForeground }}>Zrušit</Text>
              </Pressable>
              <Pressable
                disabled={busy || !name.trim()}
                onPress={() => void save()}
                style={{ padding: 12 }}
              >
                <Text style={{ color: colors.primary }}>Uložit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
