import { useEffect, useRef, useState } from "react";
import { Animated, useWindowDimensions, View } from "react-native";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";
import { palette } from "@/theme";

/**
 * A thin indeterminate bar pinned to the top that animates whenever ANY React
 * Query request is in flight (fetches + mutations) — the same "something is
 * happening" signal the web app shows, so the app feels responsive on slow
 * (free-tier) networks.
 */
export default function TopProgressBar() {
  const active = useIsFetching() + useIsMutating() > 0;
  const { width } = useWindowDimensions();
  const seg = Math.max(80, width * 0.35);
  const x = useRef(new Animated.Value(0)).current;
  const [show, setShow] = useState(false);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    if (active) {
      setShow(true);
      x.setValue(0);
      loop = Animated.loop(
        Animated.timing(x, { toValue: 1, duration: 950, useNativeDriver: true }),
      );
      loop.start();
    } else {
      setShow(false);
    }
    return () => loop?.stop();
  }, [active, x]);

  if (!show) return null;

  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 1000, overflow: "hidden" }}>
      <Animated.View
        style={{
          height: 3,
          width: seg,
          backgroundColor: palette.pitch,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-seg, width] }) }],
        }}
      />
    </View>
  );
}
