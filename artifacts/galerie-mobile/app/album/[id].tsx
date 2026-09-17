import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@workspace/galerie-design-system/hooks/use-colors';
import { nativeTheme } from '@workspace/galerie-design-system/lib/native-theme';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { albumStore, mediaStore, type AlbumRow, type MediaItemRow } from '@/db';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TILE = SCREEN_WIDTH / 3;

export default function AlbumDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const albumId = Number(id);

  const [album, setAlbum] = useState<AlbumRow | null>(null);
  const [media, setMedia] = useState<MediaItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const loadAlbum = useCallback(async () => {
    if (!albumId || Number.isNaN(albumId)) return;
    setLoading(true);
    try {
      const a = await albumStore.getAlbumById(albumId);
      setAlbum(a);
      const items = await mediaStore.getMediaItemsByAlbum(albumId);
      setMedia(items);
    } catch (e) {
      console.warn('Failed to load album:', e);
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    loadAlbum();
  }, [loadAlbum]);

  const handleRename = useCallback(async () => {
    const trimmed = renameText.trim();
    if (!trimmed || !album) return;
    await albumStore.renameAlbum(album.id, trimmed);
    setAlbum({ ...album, name: trimmed });
    setRenameVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [renameText, album]);

  const handleDelete = useCallback(() => {
    if (!album) return;
    Alert.alert(
      'Smazat album',
      `Opravdu chcete smazat album „${album.name}"? Fotky a videa zůstanou v telefonu.`,
      [
        { text: 'Zrušit', style: 'cancel' },
        {
          text: 'Smazat',
          style: 'destructive',
          onPress: async () => {
            await albumStore.deleteAlbum(album.id);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.back();
          },
        },
      ],
    );
  }, [album]);

  const handleMediaPress = useCallback((item: MediaItemRow) => {
    if (selectionMode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/media/${item.media_id}`);
  }, [selectionMode]);

  const handleMediaLongPress = useCallback((item: MediaItemRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(true);
    setSelectedIds(new Set([item.id]));
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleRemoveFromAlbum = useCallback(async () => {
    if (selectedIds.size === 0 || !albumId) return;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await albumStore.removeMediaFromAlbum(id, albumId);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectionMode(false);
    setSelectedIds(new Set());
    setToast(`${ids.length} ${ids.length === 1 ? 'položka odebrána' : 'položek odebráno'} z alba`);
    setTimeout(() => setToast(null), 2500);
    loadAlbum();
  }, [selectedIds, albumId, loadAlbum]);

  if (loading) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!album) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.centered, { paddingTop: insets.top }]}>
          <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Album nebylo nalezeno
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>
              Zpět
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.detailHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable
          testID="btn-back-album-detail"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Zpět"
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.detailTitle, { color: colors.foreground }]} numberOfLines={1}>
          {album.name}
        </Text>
        {!selectionMode ? (
          <Pressable
            testID="btn-rename-album"
            onPress={() => {
              setRenameText(album.name);
              setRenameVisible(true);
            }}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Přejmenovat"
          >
            <Feather name="edit-2" size={20} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      {!selectionMode && (
        <View style={styles.subHeader}>
          <Text style={[styles.subHeaderText, { color: colors.mutedForeground }]}>
            {media.length} {media.length === 1 ? 'položka' : 'položek'}
          </Text>
          <Pressable
            testID="btn-delete-album"
            onPress={handleDelete}
            style={({ pressed }) => [
              styles.deleteBtn,
              { borderColor: colors.destructive, opacity: pressed ? 0.6 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Smazat album"
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
              Smazat album
            </Text>
          </Pressable>
        </View>
      )}

      {selectionMode && (
        <View style={styles.subHeader}>
          <Text style={[styles.subHeaderText, { color: colors.mutedForeground }]}>
            Vybráno: {selectedIds.size}
          </Text>
        </View>
      )}

      {media.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="image" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Album je prázdné
          </Text>
          <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>
            Přejděte do feedu, podržte fotku a přidejte ji do tohoto alba.
          </Text>
        </View>
      ) : (
        <FlatList
          data={media}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          renderItem={({ item }) => (
            <Pressable
              testID={`album-media-${item.media_id}`}
              onPress={() => handleMediaPress(item)}
              onLongPress={() => handleMediaLongPress(item)}
              style={({ pressed }) => [
                { width: TILE, height: TILE, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Image
                source={{ uri: item.uri }}
                style={{ width: '100%', height: '100%', opacity: selectionMode && selectedIds.has(item.id) ? 0.6 : 1 }}
                contentFit="cover"
                cachePolicy="memory-disk"
                recyclingKey={item.media_id}
              />
              {item.media_type === 'video' && (
                <View
                  style={[
                    styles.videoBadge,
                    { backgroundColor: colors.mediaBackground, opacity: 0.75 },
                  ]}
                >
                  <Feather name="play" size={10} color={colors.onMedia} />
                </View>
              )}
              {selectionMode && (
                <View style={styles.checkOverlay}>
                  <View style={[styles.checkCircle, { backgroundColor: selectedIds.has(item.id) ? colors.mediaBackground : 'rgba(0,0,0,0.4)' }]}>
                    {selectedIds.has(item.id) && <Feather name="check" size={16} color={colors.onMedia} />}
                  </View>
                </View>
              )}
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: selectionMode ? 100 : 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Selection action bar for album detail */}
      {selectionMode && (
        <View style={[styles.actionBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 8 }]}>
          <Pressable
            testID="btn-cancel-removal"
            onPress={handleCancelSelection}
            style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.actionBtnText, { color: colors.mutedForeground }]}>Zrušit</Text>
          </Pressable>
          <Pressable
            testID="btn-remove-from-album"
            onPress={handleRemoveFromAlbum}
            disabled={selectedIds.size === 0}
            style={({ pressed }) => [
              styles.actionDangerBtn,
              {
                borderColor: colors.destructive,
                opacity: pressed ? 0.6 : selectedIds.size === 0 ? 0.4 : 1,
              },
            ]}
          >
            <Feather name="trash-2" size={16} color={colors.destructive} />
            <Text style={[styles.actionDangerText, { color: colors.destructive }]}>
              Odebrat z alba ({selectedIds.size})
            </Text>
          </Pressable>
        </View>
      )}

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { backgroundColor: colors.foreground }]}>
          <Text style={[styles.toastText, { color: colors.background }]}>{toast}</Text>
        </View>
      )}

      {/* Rename modal */}
      <Modal
        visible={renameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Přejmenovat album
            </Text>
            <TextInput
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              selectTextOnFocus
              style={[
                styles.modalInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Název alba"
              placeholderTextColor={colors.mutedForeground}
            />
            <View style={styles.modalActions}>
              <Pressable
                testID="btn-rename-cancel"
                onPress={() => setRenameVisible(false)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>
                  Zrušit
                </Text>
              </Pressable>
              <Pressable
                testID="btn-rename-confirm"
                onPress={handleRename}
                style={({ pressed }) => [
                  styles.modalBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: colors.primary }]}>
                  Uložit
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: nativeTheme.fonts.bold,
    textAlign: 'center',
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  subHeaderText: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.regular,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: nativeTheme.radius,
    borderWidth: 1,
  },
  deleteBtnText: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.medium,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    borderRadius: 999,
    padding: 4,
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
  emptyText: {
    fontSize: 16,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubText: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: 'center',
    opacity: 0.7,
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
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.medium,
  },
  actionDangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: nativeTheme.radius,
    borderWidth: 1,
  },
  actionDangerText: {
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 32,
  },
  modalCard: {
    width: '100%',
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
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
