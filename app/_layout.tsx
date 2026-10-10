/**
 * Root layout: loads fonts + initializes the local DB, holds the splash screen
 * until both are ready, then renders the tab navigator on a dark background.
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import * as SplashScreen from 'expo-splash-screen';
import { getDb } from '@/db/database';
import { WorkoutSessionProvider } from '@/session/WorkoutSession';
import { SettingsProvider } from '@/settings/SettingsProvider';
import { CelebrationProvider } from '@/components/Celebration';
import { CountdownProvider } from '@/components/Countdown';
import { ShareCardProvider } from '@/components/ShareCardProvider';
import { colors } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getDb()
      .then(() => setDbReady(true))
      .catch((e) => {
        console.error('DB init failed', e);
        setDbReady(true); // don't hard-block the UI on DB errors
      });
  }, []);

  const ready = fontsLoaded && dbReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.appBg }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SettingsProvider>
        <WorkoutSessionProvider>
          <CelebrationProvider>
            <CountdownProvider>
              <ShareCardProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.appBg },
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </ShareCardProvider>
            </CountdownProvider>
          </CelebrationProvider>
        </WorkoutSessionProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}
