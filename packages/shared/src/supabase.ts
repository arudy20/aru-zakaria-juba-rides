import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

let client: SupabaseClient | null = null;

/** One Supabase client per app, signed-in session kept on the phone between launches. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local in the app folder and fill them in.',
    );
  }
  client = createClient(url, key, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Refresh the sign-in only while the app is open, to save battery and data.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client?.auth.startAutoRefresh();
    else client?.auth.stopAutoRefresh();
  });
  return client;
}

/** True when the developer email sign-in is switched on (for testing without an SMS provider). */
export const devEmailLogin = process.env.EXPO_PUBLIC_DEV_EMAIL_LOGIN === 'true';
