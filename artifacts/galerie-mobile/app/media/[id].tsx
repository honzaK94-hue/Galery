import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColors } from '@workspace/galerie-design-system/hooks/use-colors';
import { nativeTheme } from '@workspace/galerie-design-system/lib/native-theme';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  DevelopmentBuildRequired,
  isExpoGo,
} from '@/components/DevelopmentBuildRequired';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;

type AssetDetails = {
  uri: string;
  filename: string;
  mediaType: MediaLibrary.MediaTypeValue;
  width: number;
  height: number;
  duration: number | null;
  creationTime: number | null;
  modificationTime: number | null;
  isFavorite: boolean;
};

function formatDate(ts: number | null | undefined): string {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(secs: number | null): string {
  if (!secs) return '-';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function MetaRow({
  label,
  value,
  onMediaColor,
}: {
  label: string;
  value: string;
  onMediaColor: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Text style={[styles.metaLabel, { color: onMediaColor, opacity: 0.6 }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: onMediaColor }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function MediaDetailScreen() {
  if (isExpoGo) {
    return <DevelopmentBuildRequired />;
  }

  return <MediaDetailContent />;
}

function MediaDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<AssetDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  // Semantic media-surface tokens
  const mediaBg = colors.mediaBackground;
  const onMedia = colors.onMedia;

  useEffect(() => {
    if (!id || Platform.OS === 'web') {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const info = await MediaLibrary.getAssetInfoAsync(id);
        setDetails({
          uri: info.localUri ?? info.uri,
          filename: info.filename,
          mediaType: info.mediaType,
          width: info.width,
          height: info.height,
          duration: info.duration,
          creationTime: info.creationTime,
          modificationTime: info.modificationTime,
          isFavorite: !!info.isFavorite,
        });
      } catch {
        setError('Nepodařilo se načíst snímek.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const topPad = Platform.OS === 'web' ? insets.top + 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Web: no media library access — show fallback on app background
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <Pressable testID="btn-back-media" onPress={handleBack} style={styles.headerBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <View style={styles.centered}>
          <Feather name="smartphone" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Náhled je dostupný pouze na zařízení.
          </Text>
        </View>
      </View>
    );
  }

  return (
    // mediaBackground (#000000 in both schemes — semantic, not hardcoded)
    <View style={[styles.root, { backgroundColor: mediaBg }]}>
      {/* Header: icon-only buttons, no background container */}
      <View style={[styles.header, { paddingTop: topPad + 4 }]}>
        <Pressable
          testID="btn-back-media"
          onPress={handleBack}
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Zpět"
        >
          <Feather name="arrow-left" size={24} color={onMedia} />
        </Pressable>

        {details && (
          <Pressable
            testID="btn-toggle-meta"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMeta((v) => !v);
            }}
            style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="Informace"
          >
            <Feather name="info" size={22} color={onMedia} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Feather name="alert-circle" size={36} color={colors.destructive} />
          <Text style={[styles.emptyText, { color: onMedia }]}>{error}</Text>
          <Pressable
            testID="btn-retry-media"
            onPress={handleBack}
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Zpět</Text>
          </Pressable>
        </View>
      ) : details ? (
        <>
          <Image
            source={{ uri: details.uri }}
            style={styles.fullImage}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
          />

          {showMeta && (
            <View
              style={[
                styles.metaPanel,
                {
                  // mediaBackground at ~82% opacity via hex alpha suffix
                  backgroundColor: mediaBg + 'D1',
                  paddingBottom: bottomPad + 12,
                },
              ]}
            >
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.metaPanelTitle, { color: onMedia }]}>Informace</Text>
                <MetaRow label="Název" value={details.filename} onMediaColor={onMedia} />
                <MetaRow
                  label="Typ"
                  value={details.mediaType === MediaLibrary.MediaType.video ? 'Video' : 'Fotografie'}
                  onMediaColor={onMedia}
                />
                {details.width > 0 && details.height > 0 ? (
                  <MetaRow
                    label="Rozměry"
                    value={`${details.width} × ${details.height}`}
                    onMediaColor={onMedia}
                  />
                ) : null}
                {details.duration ? (
                  <MetaRow
                    label="Délka"
                    value={formatDuration(details.duration)}
                    onMediaColor={onMedia}
                  />
                ) : null}
                <MetaRow label="Vytvořeno" value={formatDate(details.creationTime)} onMediaColor={onMedia} />
                <MetaRow label="Upraveno" value={formatDate(details.modificationTime)} onMediaColor={onMedia} />
                <MetaRow label="Oblíbené" value={details.isFavorite ? 'Ano' : 'Ne'} onMediaColor={onMedia} />
              </ScrollView>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 50,
  },
  // Icon-only header buttons: no background, no border
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  metaPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.5,
    borderTopLeftRadius: nativeTheme.radius * 2,
    borderTopRightRadius: nativeTheme.radius * 2,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  metaPanelTitle: {
    fontSize: 16,
    fontFamily: nativeTheme.fonts.bold,
    marginBottom: 14,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.regular,
    minWidth: 90,
  },
  metaValue: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.medium,
    flex: 1,
    textAlign: 'right',
  },
  emptyText: {
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
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
});
