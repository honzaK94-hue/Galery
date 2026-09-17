import { Feather } from '@expo/vector-icons';
import { useColors } from '@workspace/galerie-design-system/hooks/use-colors';
import { nativeTheme } from '@workspace/galerie-design-system/lib/native-theme';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function DevelopmentBuildRequired() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.accent }]}>
        <Feather name="package" size={30} color={colors.accentForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>
        Je potřeba Android build
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        Expo Go na této verzi Androidu nepovoluje přístup ke knihovně médií.
        Nainstalujte vlastní vývojovou APK Galerie, která obsahuje potřebná
        oprávnění pro fotografie a videa.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 34,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  title: {
    fontFamily: nativeTheme.fonts.bold,
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: nativeTheme.fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
});