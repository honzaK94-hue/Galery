import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  useWindowDimensions,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { nativeTheme } from "@workspace/galerie-design-system/lib/native-theme";
import Feather from "@expo/vector-icons/Feather";
import { Image } from "expo-image";
import * as MediaLibrary from "expo-media-library/legacy";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Linking from "expo-linking";
import {
  DevelopmentBuildRequired,
  isExpoGo,
} from "@/components/DevelopmentBuildRequired";
import { MediaThumbnail } from "@/components/MediaThumbnail";
import { getNativeAlbums, type NativeAlbumDisplay } from "@/lib/native-albums";
import { MediaGrid } from "@/components/MediaGrid";
import { useGallery, useLibraryFocus } from "@/components/GalleryProvider";
import { MediaPermissionGate } from "@/components/MediaPermissionGate";
import { albumStore, mediaStore, type AlbumWithCount } from "@/db";

const ALBUM_COLS = 2;

type CustomAlbumDisplay = AlbumWithCount & {
  coverUri?: string;
};

function WebPlaceholder() {
  const colors = useColors();
  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <Feather name="smartphone" size={48} color={colors.mutedForeground} />
      <Text style={[styles.placeholderTitle, { color: colors.foreground }]}>
        Pouze na zařízení
      </Text>
      <Text style={[styles.placeholderDesc, { color: colors.mutedForeground }]}>
        Přístup k místní knihovně fotek vyžaduje Android nebo iOS.
      </Text>
    </View>
  );
}

function PermissionScreen({
  status,
  onRequest,
}: {
  status: string | null;
  onRequest: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const canAsk = status !== "denied";

  return (
    <View
      style={[
        styles.centered,
        { backgroundColor: colors.background, paddingTop: insets.top + 60 },
      ]}
    >
      <View style={[styles.permIcon, { backgroundColor: colors.muted }]}>
        <Feather name="book-open" size={36} color={colors.primary} />
      </View>
      <Text style={[styles.permTitle, { color: colors.foreground }]}>
        Přístup k fotkám
      </Text>
      <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
        {canAsk
          ? "Galerie potřebuje přístup k vaší knihovně fotek pro zobrazení alb."
          : "Přístup byl odepřen. Otevřete nastavení a povolte přístup ručně."}
      </Text>
      {canAsk ? (
        <Pressable
          testID="btn-request-permission-albums"
          onPress={onRequest}
          style={({ pressed }) => [
            styles.permBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text
            style={[styles.permBtnText, { color: colors.primaryForeground }]}
          >
            Povolit přístup
          </Text>
        </Pressable>
      ) : (
        <Pressable
          testID="btn-open-settings-albums"
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => [
            styles.permBtn,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text
            style={[styles.permBtnText, { color: colors.secondaryForeground }]}
          >
            Otevrit nastaveni
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function CustomAlbumCard({
  album,
  onPress,
}: {
  album: CustomAlbumDisplay;
  onPress: () => void;
}) {
  const colors = useColors();
  const onMedia = colors.onMedia;
  const ALBUM_SIZE = (useWindowDimensions().width - 3) / ALBUM_COLS;
  return (
    <Pressable
      testID={`custom-album-card-${album.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.albumCard,
        { width: ALBUM_SIZE, height: ALBUM_SIZE, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {album.coverUri ? (
        <View style={styles.albumThumb}>
          <MediaThumbnail
            uri={album.coverUri}
            video={album.cover_type === "video"}
          />
        </View>
      ) : (
        <View
          style={[
            styles.albumThumb,
            styles.albumThumbEmpty,
            { backgroundColor: colors.muted },
          ]}
        >
          <Feather name="folder" size={28} color={colors.mutedForeground} />
        </View>
      )}
      <View
        style={[
          styles.albumMeta,
          { backgroundColor: colors.mediaBackground + "AA" },
        ]}
      >
        <Text style={[styles.albumTitle, { color: onMedia }]} numberOfLines={1}>
          {album.name}
        </Text>
        <Text style={[styles.albumCount, { color: onMedia, opacity: 0.7 }]}>
          {album.photo_count}
        </Text>
      </View>
    </Pressable>
  );
}

function NativeAlbumCard({
  album,
  onPress,
}: {
  album: NativeAlbumDisplay;
  onPress: () => void;
}) {
  const colors = useColors();
  const onMedia = colors.onMedia;
  const ALBUM_SIZE = (useWindowDimensions().width - 3) / ALBUM_COLS;
  return (
    <Pressable
      testID={`native-album-card-${album.album.id}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.albumCard,
        { width: ALBUM_SIZE, height: ALBUM_SIZE, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {album.thumbUri ? (
        <View style={styles.albumThumb}>
          <MediaThumbnail uri={album.thumbUri} video={album.thumbVideo} />
        </View>
      ) : (
        <View
          style={[
            styles.albumThumb,
            styles.albumThumbEmpty,
            { backgroundColor: colors.muted },
          ]}
        >
          <Feather name="image" size={28} color={colors.mutedForeground} />
        </View>
      )}
      <View
        style={[
          styles.albumMeta,
          { backgroundColor: colors.mediaBackground + "AA" },
        ]}
      >
        <Text style={[styles.albumTitle, { color: onMedia }]} numberOfLines={1}>
          {album.title}
        </Text>
        <Text style={[styles.albumCount, { color: onMedia, opacity: 0.7 }]}>
          {album.count}
        </Text>
      </View>
    </Pressable>
  );
}

function NativeAlbumDetailScreen({
  albumDisplay,
  onBack,
}: {
  albumDisplay: NativeAlbumDisplay;
  onBack: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { selectionActive } = useGallery();
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (selectionActive) return false;
          onBack();
          return true;
        },
      );
      return () => subscription.remove();
    }, [onBack, selectionActive]),
  );
  return (
    <MediaGrid
      source={{ kind: "native", id: albumDisplay.album.id }}
      bottomTabs
      emptyText="Album je prázdné"
      header={
        <View
          style={[
            styles.detailHeader,
            { paddingTop: insets.top + 8, backgroundColor: colors.background },
          ]}
        >
          <Pressable
            testID="btn-back-album"
            accessibilityRole="button"
            accessibilityLabel="Zpět na seznam alb"
            onPress={onBack}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.detailTitle, { color: colors.foreground }]}>
            {albumDisplay.title}
          </Text>
        </View>
      }
    />
  );
}

export default function AlbumsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (Platform.OS === "web") {
    return <WebPlaceholder />;
  }

  if (isExpoGo) {
    return <DevelopmentBuildRequired />;
  }

  return (
    <MediaPermissionGate requireIndex>
      <AlbumsContent colors={colors} insets={insets} />
    </MediaPermissionGate>
  );
}

function AlbumsContent({
  colors,
  insets,
}: {
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const { permission, requestPermission } = useGallery();
  const [customAlbums, setCustomAlbums] = useState<CustomAlbumDisplay[]>([]);
  const [nativeAlbums, setNativeAlbums] = useState<NativeAlbumDisplay[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [loadingNative, setLoadingNative] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNativeAlbum, setSelectedNativeAlbum] =
    useState<NativeAlbumDisplay | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [createText, setCreateText] = useState("");
  const bottomNavHeight = 52 + (insets.bottom || 0) + 24;

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push("/settings");
  }, []);

  const loadCustomAlbums = useCallback(async () => {
    setLoadingCustom(true);
    try {
      const albums = await albumStore.getAlbums("normal");
      const withCovers = await Promise.all(
        albums.map(async (a) => {
          let coverUri: string | undefined;
          if (a.cover_media_id) {
            const uri = a.cover_uri;
            coverUri = uri ?? undefined;
          }
          return { ...a, coverUri };
        }),
      );
      setCustomAlbums(withCovers);
    } catch (e) {
      console.warn("Failed to load custom albums:", e);
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  const loadNativeAlbums = useCallback(async () => {
    setLoadingNative(true);
    setError(null);
    try {
      setNativeAlbums(await getNativeAlbums());
    } catch {
      setError("Nepodařilo se načíst alba telefonu. Zkuste to znovu.");
    } finally {
      setLoadingNative(false);
    }
  }, []);

  useLibraryFocus(async () => {
    await Promise.all([loadCustomAlbums(), loadNativeAlbums()]);
  });

  const handleCreateAlbum = useCallback(async () => {
    const trimmed = createText.trim();
    if (!trimmed) return;
    try {
      await albumStore.createAlbum(trimmed, "normal");
    } catch (e) {
      Alert.alert(
        "Album se nepodařilo vytvořit",
        e instanceof Error ? e.message : "Zkuste to znovu.",
      );
      return;
    }
    setCreateText("");
    setCreateVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadCustomAlbums();
  }, [createText, loadCustomAlbums]);

  const handleOpenCustomAlbum = useCallback((album: CustomAlbumDisplay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/album/${album.id}`);
  }, []);

  if (!permission) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 120 }} />
      </View>
    );
  }

  if (!permission.granted && permission.accessPrivileges !== "limited") {
    return (
      <PermissionScreen
        status={permission.status}
        onRequest={requestPermission}
      />
    );
  }

  if (selectedNativeAlbum) {
    return (
      <NativeAlbumDetailScreen
        albumDisplay={selectedNativeAlbum}
        onBack={() => setSelectedNativeAlbum(null)}
      />
    );
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 8);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.headerRow,
          { top: insets.top + (Platform.OS === "web" ? 67 : 8) },
        ]}
      >
        <Pressable
          testID="btn-settings-albums"
          onPress={handleSettingsPress}
          style={({ pressed }) => [
            styles.settingsBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Nastavení"
        >
          <Feather name="settings" size={24} color={colors.foreground} />
        </Pressable>
      </View>

      <FlatList
        data={nativeAlbums}
        keyExtractor={(item) => item.album.id}
        numColumns={ALBUM_COLS}
        ListHeaderComponent={
          <View style={{ paddingTop: topPad }}>
            {/* Custom albums section */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Moje alba
              </Text>
              <Pressable
                testID="btn-create-album"
                onPress={() => {
                  setCreateText("");
                  setCreateVisible(true);
                }}
                style={({ pressed }) => [
                  styles.createBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Vytvořit album"
              >
                <Feather
                  name="plus"
                  size={18}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.createBtnText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Nové
                </Text>
              </Pressable>
            </View>

            {loadingCustom ? (
              <View style={styles.inlineLoader}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : customAlbums.length === 0 ? (
              <View
                style={[styles.emptySection, { backgroundColor: colors.muted }]}
              >
                <Feather
                  name="folder-plus"
                  size={32}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.emptySectionText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Zatím nemáte žádná vlastní alba
                </Text>
                <Text
                  style={[
                    styles.emptySectionSub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Vytvořte si album pro uspořádání fotek a videí.
                </Text>
              </View>
            ) : (
              <View style={styles.customGrid}>
                {customAlbums.map((album) => (
                  <CustomAlbumCard
                    key={album.id}
                    album={album}
                    onPress={() => handleOpenCustomAlbum(album)}
                  />
                ))}
              </View>
            )}

            {/* Native albums section */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Alba telefonu
              </Text>
            </View>

            {loadingNative && (
              <View style={styles.inlineLoader}>
                <ActivityIndicator color={colors.primary} />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          !loadingNative && !error ? (
            <View style={styles.centered}>
              <Feather
                name="book-open"
                size={48}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                Žádná alba telefonu
              </Text>
            </View>
          ) : error ? (
            <View style={styles.centered}>
              <Feather
                name="alert-circle"
                size={36}
                color={colors.destructive}
              />
              <Text style={[styles.errorText, { color: colors.foreground }]}>
                {error}
              </Text>
              <Pressable
                testID="btn-retry-albums"
                onPress={loadNativeAlbums}
                style={({ pressed }) => [
                  styles.retryBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.retryText,
                    { color: colors.primaryForeground },
                  ]}
                >
                  Zkusit znovu
                </Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <NativeAlbumCard
            album={item}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedNativeAlbum(item);
            }}
          />
        )}
        contentContainerStyle={{ paddingBottom: bottomNavHeight }}
        showsVerticalScrollIndicator={false}
      />

      {/* Create album modal */}
      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalCard, { backgroundColor: colors.background }]}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Nové album
            </Text>
            <TextInput
              value={createText}
              onChangeText={setCreateText}
              autoFocus
              placeholder="Název alba"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            />
            <View style={styles.modalActions}>
              <Pressable
                testID="btn-create-cancel"
                onPress={() => setCreateVisible(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.modalBtnText,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Zrušit
                </Text>
              </Pressable>
              <Pressable
                testID="btn-create-confirm"
                onPress={handleCreateAlbum}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: colors.primary }]}>
                  Vytvořit
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  headerRow: {
    position: "absolute",
    right: 16,
    zIndex: 50,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: nativeTheme.fonts.bold,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: nativeTheme.radius,
  },
  createBtnText: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.medium,
  },
  customGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 0.5,
  },
  albumCard: {
    margin: 0.5,
    position: "relative",
    overflow: "hidden",
  },
  albumThumb: {
    width: "100%",
    height: "100%",
  },
  albumThumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  albumMeta: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  albumTitle: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.medium,
  },
  albumCount: {
    fontSize: 11,
    fontFamily: nativeTheme.fonts.regular,
    marginTop: 2,
  },
  emptySection: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 32,
    marginHorizontal: 16,
    borderRadius: nativeTheme.radius * 2,
  },
  emptySectionText: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.medium,
    textAlign: "center",
  },
  emptySectionSub: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: "center",
    opacity: 0.7,
  },
  inlineLoader: {
    paddingVertical: 24,
    alignItems: "center",
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  detailTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: nativeTheme.fonts.bold,
    textAlign: "center",
  },
  videoBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    borderRadius: 999,
    padding: 4,
  },
  errorText: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: "center",
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: nativeTheme.radius,
  },
  retryText: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.medium,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: "center",
    marginTop: 12,
  },
  placeholderTitle: {
    fontSize: 22,
    fontFamily: nativeTheme.fonts.bold,
    textAlign: "center",
    marginTop: 16,
  },
  placeholderDesc: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: "center",
    lineHeight: 22,
  },
  permIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permTitle: {
    fontSize: 24,
    fontFamily: nativeTheme.fonts.bold,
    textAlign: "center",
  },
  permDesc: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
  },
  permBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: nativeTheme.radius,
    marginTop: 8,
  },
  permBtnText: {
    fontSize: 16,
    fontFamily: nativeTheme.fonts.medium,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 32,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    borderRadius: nativeTheme.radius * 2,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: nativeTheme.fonts.bold,
    marginBottom: 16,
  },
  modalInput: {
    fontSize: 16,
    fontFamily: nativeTheme.fonts.regular,
    borderRadius: nativeTheme.radius,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
    marginTop: 20,
  },
  modalBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.medium,
  },
});
