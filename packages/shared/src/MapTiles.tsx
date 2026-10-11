// Map background that works without a Google Maps key.
// In Expo Go on Android, Google refuses to load its own map images (we can't add our key there),
// so on Android we draw OpenStreetMap-based tiles instead. iPhones keep Apple Maps.
// Juba is mapped in good detail on OpenStreetMap thanks to humanitarian mapping.
//
// The tile server is configurable with EXPO_PUBLIC_MAP_TILE_URL. The default (CARTO's free
// "Voyager" basemap) is fine for testing; pick a provider with a plan before real launch.
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { UrlTile } from 'react-native-maps';
import { theme } from './theme';
import { Text } from './ui';

const DEFAULT_TILES = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';
const TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL || DEFAULT_TILES;
const useTiles = Platform.OS === 'android' || process.env.EXPO_PUBLIC_MAP_TILES_EVERYWHERE === 'true';

/** Pass to MapView's mapType so Google's own (blocked) map doesn't draw underneath. */
export const baseMapType = useTiles ? ('none' as const) : ('standard' as const);

/** Put inside every MapView, before the markers. */
export function MapTiles() {
  if (!useTiles) return null;
  return <UrlTile urlTemplate={TILE_URL} maximumZ={19} shouldReplaceMapContent zIndex={-1} />;
}

/** The map credit the tile licence requires. Put inside the map's container, after the MapView. */
export function MapAttribution() {
  if (!useTiles) return null;
  return (
    <View pointerEvents="none" style={styles.credit}>
      <Text variant="xs" color="text-muted">
        © OpenStreetMap contributors © CARTO
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  credit: {
    position: 'absolute',
    right: theme.space[1],
    bottom: theme.space[1],
    backgroundColor: theme.color.bg,
    paddingHorizontal: theme.space[1],
    borderRadius: theme.radius.sm,
    opacity: 0.85,
  },
});
