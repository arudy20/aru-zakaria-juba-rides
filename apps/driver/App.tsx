import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { AtkinsonHyperlegible_400Regular } from '@expo-google-fonts/atkinson-hyperlegible/400Regular';
import { AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible/700Bold';
import { SignInScreen, theme, useSession } from '@juba/shared';
import { DriverHome } from './src/DriverHome';

export default function App() {
  const [fontsLoaded] = useFonts({ AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const { session, ready } = useSession();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {!fontsLoaded || !ready ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.bg }}>
          <ActivityIndicator color={theme.color.accent} size="large" />
        </View>
      ) : session ? (
        <DriverHome />
      ) : (
        <SignInScreen appName="Juba Rides Driver" subtitle="Drive with Juba Rides. Fair commission, fixed fares." />
      )}
    </SafeAreaProvider>
  );
}
