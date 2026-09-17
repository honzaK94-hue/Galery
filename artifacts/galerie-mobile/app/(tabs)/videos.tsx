import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@workspace/galerie-design-system/hooks/use-colors';
import { nativeTheme } from '@workspace/galerie-design-system/lib/native-theme';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import {
  DevelopmentBuildRequired,
  isExpoGo,
} from '@/components/DevelopmentBuildRequired';
import { AddToAlbumModal } from '@/components/AddToAlbumModal';
import { mediaStore, type MediaIdentity } from '@/db';

const SCREEN_WIDTH = Dimensions.get('window').width;
const NUM_COLS = 2;
const TILE_SIZE = SCREEN_WIDTH / NUM_COLS;
const PAGE_SIZE = 40;

type VideoDisplay = {
  id: string;
  uri: string;
  duration: number | null;
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
        Přístup k místní knihovně videí vyžaduje Android nebo iOS.
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
  const canAsk = status !== 'denied';

  return (
    <View style={[styles.centered, { backgroundColor: colors.background, paddingTop: insets.top + 60 }]}>
      <View style={[styles.permIcon, { backgroundColor: colors.muted }]}>
        <Feather name="video" size={36} color={colors.primary} />
      </View>
      <Text style={[styles.permTitle, { color: colors.foreground }]}>
        Přístup k videím
      </Text>
      <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
        {canAsk
          ? 'Galerie potřebuje přístup k vaší knihovně pro zobrazení videí.'
          : 'Přístup byl odepřen. Otevřete nastavení a povolte přístup ručně.'}
      </Text>
      {canAsk ? (
        <Pressable
          testID="btn-request-permission-videos"
          onPress={onRequest}
          style={({ pressed }) => [
            styles.permBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.permBtnText, { color: colors.primaryForeground }]}>
            Povolit přístup
          </Text>
        </Pressable>
      ) : (
        <Pressable
          testID="btn-open-settings-videos"
          onPress={() => Linking.openSettings()}
          style={({ pressed }) => [
            styles.permBtn,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Text style={[styles.permBtnText, { color: colors.secondaryForeground }]}>
            Otevrit nastaveni
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function formatDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function VideoTile({
  video,
  onPress,
  onLongPress,
  selected,
  selectionMode,
  onMediaColor,
  onMediaBg,
}: {
  video: VideoDisplay;
  onPress: () => void;
  onLongPress: () => void;
  selected: boolean;
  selectionMode: boolean;
  onMediaColor: string;
  onMediaBg: string;
}) {
  return (
    <Pressable
      testID={`video-tile-${video.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Image
        source={{ uri: video.uri }}
        style={[styles.tileImage, selected && styles.tileSelected]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={video.id}
      />
      <View style={styles.overlay}>
        <View style={[styles.playCircle, { backgroundColor: onMediaBg }]}>
          <Feather name="play" size={18} color={onMediaColor} />
        </View>
        {video.duration != null && video.duration > 0 && (
          <Text style={[styles.duration, { color: onMediaColor }]}>
            {formatDuration(video.duration)}
          </Text>
        )}
      </View>
      {selectionMode && (
        <View style={styles.checkOverlay}>
          <View style={[styles.checkCircle, { backgroundColor: selected ? onMediaBg : 'rgba(0,0,0,0.4)' }]}>
            {selected && <Feather name="check" size={16} color={onMediaColor} />}
          </View>
        </View>
      )}
    </Pressable>
  );
}

function SkeletonGrid() {
  const colors = useColors();
  const items = Array.from({ length: 8 }, (_, i) => i);
  return (
    <View style={styles.skeletonGrid}>
      {items.map((i) => (
        <View
          key={i}
          style={[styles.skeletonTile, { backgroundColor: colors.muted }]}
        />
      ))}
    </View>
  );
}

export default function VideosScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web') {
    return <WebPlaceholder />;
  }

  if (isExpoGo) {
    return <DevelopmentBuildRequired />;
  }

  return <VideosContent colors={colors} insets={insets} />;
}

function VideosContent({
  colors,
  insets,
}: {
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [permission, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo', 'video'],
  });
  const [videos, setVideos] = useState<VideoDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadingRef = useRef(false);
  const hiddenIdsRef = useRef<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [albumPickerVisible, setAlbumPickerVisible] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const bottomNavHeight = 52 + (insets.bottom || 0) + 24;

  // Semantic tokens for on-media surfaces
  const onMediaColor = colors.onMedia;
  const onMediaBg = colors.mediaBackground;

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  }, []);

  const refreshHiddenIds = useCallback(async () => {
    hiddenIdsRef.current = await mediaStore.getHiddenMediaIds();
  }, []);

  const loadPage = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    if (!reset && !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: PAGE_SIZE,
        after: reset ? undefined : cursorRef.current,
        mediaType: MediaLibrary.MediaType.video,
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });

      setHasMore(page.hasNextPage);
      cursorRef.current = page.endCursor;

      const hidden = hiddenIdsRef.current;
      const nextVideos = page.assets
        .map(({ id, uri, duration }) => ({ id, uri, duration }))
        .filter((v) => !hidden.has(v.id));

      const identities: MediaIdentity[] = page.assets.map((a) => ({
        mediaId: a.id,
        uri: a.uri,
        filename: a.filename,
        mediaType: 'video' as const,
        creationTime: a.creationTime ?? null,
        width: a.width ?? null,
        height: a.height ?? null,
        duration: a.duration ?? null,
      }));
      mediaStore.upsertBatch(identities).catch((e) => {
        console.warn('Media upsert failed:', e);
      });

      setVideos((prev) => {
        if (reset) return nextVideos;
        const existingIds = new Set(prev.map((v) => v.id));
        const newOnes = nextVideos.filter((v) => !existingIds.has(v.id));
        return [...prev, ...newOnes];
      });
    } catch {
      setError('Nepodařilo se načíst videa. Zkuste to znovu.');
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [hasMore]);

  useEffect(() => {
    if (permission?.granted) {
      cursorRef.current = undefined;
      setVideos([]);
      setHasMore(true);
      refreshHiddenIds().then(() => loadPage(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permission?.granted]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    cursorRef.current = undefined;
    setHasMore(true);
    await refreshHiddenIds();
    await loadPage(true);
    setRefreshing(false);
  }, [loadPage, refreshHiddenIds]);

  const handlePress = useCallback((video: VideoDisplay) => {
    if (selectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(video.id)) next.delete(video.id);
        else next.add(video.id);
        return next;
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/media/${video.id}`);
  }, [selectionMode]);

  const handleLongPress = useCallback((video: VideoDisplay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([video.id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(videos.map((v) => v.id)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [videos]);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleAddedToAlbum = useCallback((_albumId: number, addedCount: number) => {
    setAlbumPickerVisible(false);
    setSelectionMode(false);
    setSelectedIds(new Set());
    setToast(
      addedCount > 0
        ? `${addedCount} ${addedCount === 1 ? 'položka přidána' : 'položek přidáno'} do alba`
        : 'Položky už v albu jsou',
    );
    setTimeout(() => setToast(null), 2500);
  }, []);

  if (!permission) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <SkeletonGrid />
      </View>
    );
  }

  if (!permission.granted) {
    return <PermissionScreen status={permission.status} onRequest={requestPermission} />;
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Settings icon-only button, top-right, no background */}
      <View style={[styles.headerRow, { top: insets.top + (Platform.OS === 'web' ? 67 : 8) }]}>
        <Pressable
          testID="btn-settings-videos"
          onPress={handleSettingsPress}
          style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Nastavení"
        >
          <Feather name="settings" size={24} color={onMediaColor} />
        </Pressable>
      </View>

      {loading && videos.length === 0 ? (
        <SkeletonGrid />
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
          <Pressable
            testID="btn-retry-videos"
            onPress={() => loadPage(true)}
            style={({ pressed }) => [styles.retryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Zkusit znovu</Text>
          </Pressable>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="video" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Žádná videa</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLS}
          renderItem={({ item }) => (
            <VideoTile
              video={item}
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item)}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
              onMediaColor={onMediaColor}
              onMediaBg={onMediaBg}
            />
          )}
          contentContainerStyle={{
            paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 8),
            paddingBottom: bottomNavHeight,
          }}
          onEndReached={() => { if (!loading && hasMore) loadPage(false); }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListFooterComponent={
            loading && videos.length > 0 ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Selection action bar */}
      {selectionMode && (
        <View style={[styles.actionBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
          <Pressable
            testID="btn-select-all-videos"
            onPress={handleSelectAll}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Vybrat vše</Text>
          </Pressable>
          <View style={styles.actionBarRight}>
            <Pressable
              testID="btn-cancel-selection-videos"
              onPress={handleCancelSelection}
              style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Zrušit</Text>
            </Pressable>
            <Pressable
              testID="btn-add-to-album-videos"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setAlbumPickerVisible(true);
              }}
              disabled={selectedIds.size === 0}
              style={({ pressed }) => [
                styles.actionPrimaryBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : selectedIds.size === 0 ? 0.4 : 1,
                },
              ]}
            >
              <Feather name="folder-plus" size={16} color={colors.primaryForeground} />
              <Text style={[styles.actionPrimaryText, { color: colors.primaryForeground }]}>
                Přidat do alba ({selectedIds.size})
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.toastText, { color: colors.background }]}>{toast}</Text>
        </View>
      )}

      <AddToAlbumModal
        visible={albumPickerVisible}
        selectedMediaIds={Array.from(selectedIds)}
        onClose={() => setAlbumPickerVisible(false)}
        onAdded={handleAddedToAlbum}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  headerRow: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
  },
  // Icon-only settings button: no background, no border
  settingsBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 0.75,
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileSelected: {
    opacity: 0.6,
  },
  checkOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
    zIndex: 90,
  },
  actionBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.medium,
  },
  actionPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: nativeTheme.radius,
  },
  actionPrimaryText: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.medium,
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignSelf: 'center',
    marginHorizontal: 40,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: nativeTheme.radius * 2,
    zIndex: 100,
  },
  toastText: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.medium,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
    opacity: 0.75,
  },
  duration: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    fontSize: 12,
    fontFamily: nativeTheme.fonts.medium,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonTile: {
    width: TILE_SIZE,
    height: TILE_SIZE * 0.75,
  },
  errorText: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: 'center',
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
    textAlign: 'center',
    marginTop: 12,
  },
  placeholderTitle: {
    fontSize: 22,
    fontFamily: nativeTheme.fonts.bold,
    textAlign: 'center',
    marginTop: 16,
  },
  placeholderDesc: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  permIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  permTitle: {
    fontSize: 24,
    fontFamily: nativeTheme.fonts.bold,
    textAlign: 'center',
  },
  permDesc: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: 'center',
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
});
