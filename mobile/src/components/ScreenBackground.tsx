import { ImageBackground, StyleSheet, useColorScheme, View } from "react-native";
import { usePathname } from "expo-router";
import { useBackgrounds } from "@/api/admin";
import { pageKey, resolveBackground } from "@/lib/backgrounds";

/**
 * Full-screen background image for the current screen + theme, behind all
 * content, with a readability overlay — the app counterpart of the web
 * <BackgroundLayer />. Picks the page from the router path; the super admin
 * sets/overrides URLs in Manage → Appearance.
 */
export default function ScreenBackground() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const pathname = usePathname();
  const { data } = useBackgrounds();
  const url = resolveBackground(data, pageKey(pathname || "/"), scheme);
  if (!url) return null;

  const overlay = scheme === "dark" ? "rgba(11,18,32,0.86)" : "rgba(248,250,252,0.82)";

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ImageBackground source={{ uri: url }} style={{ flex: 1 }} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      </ImageBackground>
    </View>
  );
}
