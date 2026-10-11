// Extends app.json with settings that come from the environment at build time.
// Android builds need a Google Maps key entry or the map crashes. Android draws its map from
// OpenStreetMap tiles (see packages/shared/src/MapTiles.tsx), so a placeholder works for testing;
// set GOOGLE_MAPS_ANDROID_KEY (an EAS environment variable) to use Google's own map later.
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['react-native-maps', { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_KEY || 'tiles-only-no-google-key' }],
  ],
});
