import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@workspace/galerie-design-system/hooks/use-colors';
import { nativeTheme } from '@workspace/galerie-design-system/lib/native-theme';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { albumStore, mediaStore, type AlbumWithCount } from '@/db';

type Props = {
  visible: boolean;
  selectedMediaIds: string[];
  onClose: () => void;
  onAdded: (albumId: number, addedCount: number) => void;
};

export function AddToAlbumModal({ visible, selectedMediaIds, onClose, onAdded }: Props) {
  const colors = useColors();
  const [albums, setAlbums] = useState<(AlbumWithCount & { coverUri?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    try {
      const list = await albumStore.getAlbums('normal');
      const withCovers = await Promise.all(
        list.map(async (a) => {
          let coverUri: string | undefined;
          if (a.cover_media_id) {
            const uri = await mediaStore.getMediaUriByMediaId(a.cover_media_id);
            coverUri = uri ?? undefined;
          }
          return { ...a, coverUri };
        }),
      );
      setAlbums(withCovers);
    } catch (e) {
      console.warn('Failed to load albums for picker:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) loadAlbums();
  }, [visible, loadAlbums]);

  const handleSelectAlbum = useCallback(
    async (albumId: number) => {
      if (selectedMediaIds.length === 0) return;
      setAdding(true);
      try {
        const idMap = await mediaStore.getMediaItemIdsByMediaIds(selectedMediaIds);
        const rowIds: number[] = [];
        for (const mid of selectedMediaIds) {
          const rowId = idMap.get(mid);
          if (rowId != null) rowIds.push(rowId);
        }
        if (rowIds.length > 0) {
          await albumStore.addMediaBatchToAlbum(rowIds, albumId);
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onAdded(albumId, rowIds.length);
      } catch (e) {
        console.warn('Failed to add media to album:', e);
      } finally {
        setAdding(false);
      }
    },
    [selectedMediaIds, onAdded],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Přidat do alba
            </Text>
            <Pressable
              testID="btn-close-album-picker"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, { opacity: pressed ? 0.6 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="Zavřít"
            >
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
            {selectedMediaIds.length} {selectedMediaIds.length === 1 ? 'vybraná položka' : 'vybraných položek'}
          </Text>

          {loading ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : albums.length === 0 ? (
            <View style={styles.emptyPicker}>
              <Feather name="folder-plus" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyPickerText, { color: colors.mutedForeground }]}>
                Zatím nemáte žádná alba
              </Text>
            </View>
          ) : (
            <FlatList
              data={albums}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <Pressable
                  testID={`album-picker-item-${item.id}`}
                  onPress={() => handleSelectAlbum(item.id)}
                  disabled={adding}
                  style={({ pressed }) => [
                    styles.albumRow,
                    { opacity: pressed ? 0.7 : adding ? 0.5 : 1 },
                  ]}
                >
                  {item.coverUri ? (
                    <Image
                      source={{ uri: item.coverUri }}
                      style={styles.rowThumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <View style={[styles.rowThumb, { backgroundColor: colors.muted }]}>
                      <Feather name="folder" size={18} color={colors.mutedForeground} />
                    </View>
                  )}
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: colors.foreground }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.rowCount, { color: colors.mutedForeground }]}>
                      {item.photo_count} {item.photo_count === 1 ? 'položka' : 'položek'}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: nativeTheme.radius * 3,
    borderTopRightRadius: nativeTheme.radius * 3,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 4,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: nativeTheme.fonts.bold,
  },
  sheetSubtitle: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.regular,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineLoader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyPicker: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 40,
  },
  emptyPickerText: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  rowThumb: {
    width: 48,
    height: 48,
    borderRadius: nativeTheme.radius,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowInfo: {
    flex: 1,
  },
  rowName: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.medium,
  },
  rowCount: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.regular,
    marginTop: 2,
  },
});
