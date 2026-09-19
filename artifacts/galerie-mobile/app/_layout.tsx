import React, { useCallback, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useDesignSystemFonts } from "@workspace/galerie-design-system/hooks/use-fonts";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Platform, Pressable, Text, View } from "react-native";
import { GalleryProvider } from "@/components/GalleryProvider";
import { GalleryPreferences } from "@/components/GalleryPreferences";
import { useColors } from "@workspace/galerie-design-system/hooks/use-colors";
import { StatusBar } from "expo-status-bar";
import { ensureDatabaseReady } from "@/db";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const colors = useColors();
  return (
    <>
      <StatusBar style={colors.background === "#040E19" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false, presentation: "modal" }}
        />
        <Stack.Screen name="media/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="album/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="hidden" options={{ headerShown: false }} />
        <Stack.Screen name="trash" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const { fontsLoaded, fontError } = useDesignSystemFonts();
  const [dbReady, setDbReady] = useState(Platform.OS === "web");

  const [dbError, setDbError] = useState(false);
  const initialize = useCallback(() => {
    if (Platform.OS === "web") return;
    setDbError(false);
    ensureDatabaseReady()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error("Database init failed:", e);
        setDbError(true);
      });
  }, []);
  useEffect(initialize, [initialize]);

  useEffect(() => {
    if ((fontsLoaded || fontError) && (dbReady || dbError)) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, dbReady, dbError]);

  if (!fontsLoaded && !fontError) return null;
  if (dbError)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
          gap: 20,
        }}
      >
        <Text>
          Databázi se nepodařilo otevřít. Uložená data nebyla smazána.
        </Text>
        <Pressable
          onPress={initialize}
          accessibilityRole="button"
          style={{ padding: 16 }}
        >
          <Text>Zkusit znovu</Text>
        </Pressable>
      </View>
    );
  if (!dbReady) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <GalleryProvider>
                <GalleryPreferences>
                  <RootLayoutNav />
                </GalleryPreferences>
              </GalleryProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
