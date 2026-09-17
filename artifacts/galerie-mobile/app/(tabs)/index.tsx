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

const NUM_COLUMNS = 3;
const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE_SIZE = SCREEN_WIDTH / NUM_COLUMNS;
const PAGE_SIZE = 60;

type AssetDisplay = {
  id: string;
  uri: string;
  mediaType: MediaLibrary.MediaTypeValue;
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
  const canAsk = status !== 'denied';

  return (
    <View
      style={[
        styles.centered,
        { backgroundColor: colors.background, paddingTop: insets.top + 60 },
      ]}
    >
      <View style={[styles.permIcon, { backgroundColor: colors.muted }]}>
        <Feather name="image" size={36} color={colors.primary} />
      </View>
      <Text style={[styles.permTitle, { color: colors.foreground }]}>
        Přístup k fotkám
      </Text>
      <Text style={[styles.permDesc, { color: colors.mutedForeground }]}>
        {canAsk
          ? 'Galerie potřebuje přístup k vaší knihovně fotek pro zobrazení snímků.'
          : 'Přístup byl odepřen. Otevřete nastavení a povolte přístup ručně.'}
      </Text>
      {canAsk ? (
        <Pressable
          testID="btn-request-permission"
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
          testID="btn-open-settings"
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

function PhotoTile({
  asset,
  onPress,
  onLongPress,
  selected,
  selectionMode,
  onMediaColor,
  onMediaBg,
}: {
  asset: AssetDisplay;
  onPress: () => void;
  onLongPress: () => void;
  selected: boolean;
  selectionMode: boolean;
  onMediaColor: string;
  onMediaBg: string;
}) {
  return (
    <Pressable
      testID={`photo-tile-${asset.id}`}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.tile, { opacity: pressed ? 0.85 : 1 }]}
    >
      <Image
        source={{ uri: asset.uri }}
        style={[styles.tileImage, selected && styles.tileSelected]}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={asset.id}
      />
      {asset.mediaType === MediaLibrary.MediaType.video && (
        <View style={[styles.videoBadge, { backgroundColor: onMediaBg }]}>
          <Feather name="play" size={10} color={onMediaColor} />
        </View>
      )}
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
  const items = Array.from({ length: 18 }, (_, i) => i);
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

export default function FeedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  if (Platform.OS === 'web') {
    return <WebPlaceholder />;
  }

  if (isExpoGo) {
    return <DevelopmentBuildRequired />;
  }

  return <FeedContent colors={colors} insets={insets} />;
}

function FeedContent({
  colors,
  insets,
}: {
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}) {
  const [permission, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo', 'video'],
  });
  const [assets, setAssets] = useState<AssetDisplay[]>([]);
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

  const topPad = insets.top;
  const bottomNavHeight = 52 + (insets.bottom || 0) + 24;

  // Semantic tokens for on-media surfaces (photo badges, overlays)
  const onMediaColor = colors.onMedia;
  const onMediaBg = colors.mediaBackground;

  const refreshHiddenIds = useCallback(async () => {
    hiddenIdsRef.current = await mediaStore.getHiddenMediaIds();
  }, []);

  const loadPage = useCallback(
    async (reset = false) => {
      if (loadingRef.current) return;
      if (!reset && !hasMore) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const page = await MediaLibrary.getAssetsAsync({
          first: PAGE_SIZE,
          after: reset ? undefined : cursorRef.current,
          mediaType: MediaLibrary.MediaType.photo,
          sortBy: [[MediaLibrary.SortBy.creationTime, false]],
        });

        setHasMore(page.hasNextPage);
        cursorRef.current = page.endCursor;

        const hidden = hiddenIdsRef.current;
        const nextAssets = page.assets
          .map(({ id, uri, mediaType }) => ({ id, uri, mediaType }))
          .filter((a) => !hidden.has(a.id));

        const identities: MediaIdentity[] = page.assets.map((a) => ({
          mediaId: a.id,
          uri: a.uri,
          filename: a.filename,
          mediaType: a.mediaType === MediaLibrary.MediaType.video ? 'video' : 'photo',
          creationTime: a.creationTime ?? null,
          width: a.width ?? null,
          height: a.height ?? null,
        }));
        mediaStore.upsertBatch(identities).catch((e) => {
          console.warn('Media upsert failed:', e);
        });

        setAssets((prev) => {
          if (reset) return nextAssets;
          const existingIds = new Set(prev.map((a) => a.id));
          const newOnes = nextAssets.filter((a) => !existingIds.has(a.id));
          return [...prev, ...newOnes];
        });
      } catch {
        setError('Nepodařilo se načíst fotky. Zkuste to znovu.');
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [hasMore]
  );

  useEffect(() => {
    if (permission?.granted) {
      cursorRef.current = undefined;
      setAssets([]);
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

  const handleEndReached = useCallback(() => {
    if (!loading && hasMore) {
      loadPage(false);
    }
  }, [loading, hasMore, loadPage]);

  const handlePress = useCallback((asset: AssetDisplay) => {
    if (selectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(asset.id)) next.delete(asset.id);
        else next.add(asset.id);
        return next;
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/media/${asset.id}`);
  }, [selectionMode]);

  const handleLongPress = useCallback((asset: AssetDisplay) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([asset.id]));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(assets.map((a) => a.id)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [assets]);

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

  const handleSettingsPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/settings');
  }, []);

  if (!permission) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <SkeletonGrid />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <PermissionScreen
        status={permission.status}
        onRequest={requestPermission}
      />
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {/* Settings icon-only button, top-right, no background */}
      <View
        style={[
          styles.headerRow,
          { top: topPad + (Platform.OS === 'web' ? 67 : 8) },
        ]}
      >
        <Pressable
          testID="btn-settings"
          onPress={handleSettingsPress}
          style={({ pressed }) => [styles.settingsBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Nastavení"
        >
          <Feather name="settings" size={24} color={onMediaColor} />
        </Pressable>
      </View>

      {loading && assets.length === 0 ? (
        <SkeletonGrid />
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
          <Pressable
            testID="btn-retry"
            onPress={() => loadPage(true)}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
              Zkusit znovu
            </Text>
          </Pressable>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="image" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Zadne fotky
          </Text>
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          numColumns={NUM_COLUMNS}
          renderItem={({ item }) => (
            <PhotoTile
              asset={item}
              onPress={() => handlePress(item)}
              onLongPress={() => handleLongPress(item)}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
              onMediaColor={onMediaColor}
              onMediaBg={onMediaBg}
            />
          )}
          contentContainerStyle={{
            paddingTop: topPad + (Platform.OS === 'web' ? 67 : 8),
            paddingBottom: bottomNavHeight,
          }}
          onEndReached={handleEndReached}
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
            loading && assets.length > 0 ? (
              <View style={styles.footerLoader}>
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
            testID="btn-select-all"
            onPress={handleSelectAll}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Vybrat vše</Text>
          </Pressable>
          <View style={styles.actionBarRight}>
            <Pressable
              testID="btn-cancel-selection"
              onPress={handleCancelSelection}
              style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Zrušit</Text>
            </Pressable>
            <Pressable
              testID="btn-add-to-album"
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
    flexDirection: 'row',
    alignItems: 'center',
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
    height: TILE_SIZE,
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
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: 999,
    padding: 4,
    opacity: 0.75,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skeletonTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
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
  errorText: {
    fontSize: 16,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: nativeTheme.radius,
    marginTop: 4,
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
});
