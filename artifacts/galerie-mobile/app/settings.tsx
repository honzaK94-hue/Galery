import React, { useCallback } from 'react';
import {
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
import * as MediaLibrary from 'expo-media-library/legacy';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import {
  DevelopmentBuildRequired,
  isExpoGo,
} from '@/components/DevelopmentBuildRequired';

function Row({
  icon,
  label,
  value,
  onPress,
  colors,
  isLast = false,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
  isLast?: boolean;
}) {
  const content = (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon as any} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text>
        ) : null}
        {onPress ? (
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}

function Section({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function PermissionStatusBadge({
  granted,
  canAskAgain,
  colors,
}: {
  granted: boolean;
  canAskAgain: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const label = granted ? 'Povoleno' : canAskAgain ? 'Nevyřízeno' : 'Zamítnuto';
  const bg: string = granted ? colors.primary : canAskAgain ? colors.muted : colors.destructive;
  const fg: string = granted ? colors.primaryForeground : canAskAgain ? colors.mutedForeground : colors.destructiveForeground;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  if (isExpoGo) {
    return <DevelopmentBuildRequired />;
  }

  return <SettingsContent />;
}

function SettingsContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const [permission, requestPermission] = MediaLibrary.usePermissions({
    granularPermissions: ['photo', 'video'],
  });

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  const handleOpenSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openSettings();
  }, []);

  const handleRequestPermission = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await requestPermission();
  }, [requestPermission]);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const isBlocked =
    permission?.status === 'denied' && !permission.canAskAgain;
  const canRequest =
    permission && !permission.granted && !!permission.canAskAgain;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          testID="btn-back-settings"
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Zpět"
        >
          <Feather name="x" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Nastavení</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Permissions */}
        <Section title="Oprávnění" colors={colors}>
          <Row
            icon="image"
            label="Knihovna fotek"
            colors={colors}
            isLast={true}
            value={undefined}
          />
          <View style={[styles.permRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
            <View style={styles.permRowLeft}>
              {permission ? (
                <PermissionStatusBadge
                  granted={!!permission.granted}
                  canAskAgain={!!permission.canAskAgain}
                  colors={colors}
                />
              ) : (
                <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>Načítám...</Text>
              )}
            </View>
            {isBlocked && (
              <Pressable
                testID="btn-open-device-settings"
                onPress={handleOpenSettings}
                style={({ pressed }) => [
                  styles.settingsLinkBtn,
                  { backgroundColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.settingsLinkText, { color: colors.secondaryForeground }]}>
                  Nastavení zařízení
                </Text>
              </Pressable>
            )}
            {canRequest && (
              <Pressable
                testID="btn-grant-permission"
                onPress={handleRequestPermission}
                style={({ pressed }) => [
                  styles.settingsLinkBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
                accessibilityRole="button"
              >
                <Text style={[styles.settingsLinkText, { color: colors.primaryForeground }]}>
                  Povolit
                </Text>
              </Pressable>
            )}
          </View>
        </Section>

        {/* Appearance */}
        <Section title="Vzhled" colors={colors}>
          <Row
            icon="sun"
            label="Motiv"
            value={colorScheme === 'dark' ? 'Tmavý' : colorScheme === 'light' ? 'Světlý' : 'Systém'}
            colors={colors}
            isLast={true}
          />
        </Section>

        {/* App info */}
        <Section title="Aplikace" colors={colors}>
          <Row
            icon="info"
            label="Verze"
            value={Constants.expoConfig?.version ?? '1.0.0'}
            colors={colors}
          />
          <Row
            icon="cpu"
            label="Platforma"
            value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}
            colors={colors}
            isLast={true}
          />
        </Section>

        {/* Design system */}
        <Section title="Design" colors={colors}>
          <Row
            icon="droplet"
            label="Primární barva"
            value={colors.primary}
            colors={colors}
          />
          <Row
            icon="type"
            label="Písmo"
            value="Roboto"
            colors={colors}
          />
          <Row
            icon="square"
            label="Zaoblení rohů"
            value={`${nativeTheme.radius}px`}
            colors={colors}
            isLast={true}
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: nativeTheme.fonts.bold,
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 24,
  },
  section: {
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: nativeTheme.fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: nativeTheme.radius,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontFamily: nativeTheme.fonts.regular,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 14,
    fontFamily: nativeTheme.fonts.regular,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  permRowLeft: {
    flex: 1,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontFamily: nativeTheme.fonts.medium,
  },
  settingsLinkBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: nativeTheme.radius,
  },
  settingsLinkText: {
    fontSize: 13,
    fontFamily: nativeTheme.fonts.medium,
  },
});
