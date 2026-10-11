// Expo inlines EXPO_PUBLIC_* variables from the app's .env.local at build time.
declare const process: {
  env: {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_DEV_EMAIL_LOGIN?: string;
    [key: string]: string | undefined;
  };
};
