import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from "react-native";

/**
 * Dependency-free confetti + flower burst, shown once when a completed match
 * with a winner is opened — the app counterpart of the web <Celebration />.
 * Pure Animated transforms (native driver); auto-clears after a few seconds.
 */
const COLORS = ["#16a34a", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#10b981"];
const EMOJI = ["🎉", "🌸", "🏆", "✨", "🎊"];
const { height } = Dimensions.get("window");

export default function Celebration({ run }: { run: boolean }) {
  const [show, setShow] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!run) return;
    setShow(true);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 3600,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    const tmo = setTimeout(() => setShow(false), 4400);
    return () => clearTimeout(tmo);
  }, [run, progress]);

  if (!show) return null;

  const pieces = Array.from({ length: 64 }, (_, i) => {
    const left = (i * 37) % 100;
    const size = 7 + (i % 4) * 2;
    const color = COLORS[i % COLORS.length];
    const baseRot = (i * 47) % 360;
    const delay = (i % 10) * 0.04; // stagger the start, deterministically
    const isEmoji = i % 6 === 0;

    const translateY = progress.interpolate({
      inputRange: [delay, 1],
      outputRange: [-50, height + 50],
      extrapolateLeft: "clamp",
    });
    const translateX = progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0, i % 2 ? 16 : -16, 0],
    });
    const rotate = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [`${baseRot}deg`, `${baseRot + 540}deg`],
    });

    return (
      <Animated.View
        key={i}
        style={{
          position: "absolute",
          top: 0,
          left: `${left}%`,
          transform: [{ translateY }, { translateX }, { rotate }],
        }}
      >
        {isEmoji ? (
          <Text style={{ fontSize: 18 }}>{EMOJI[i % EMOJI.length]}</Text>
        ) : (
          <View style={{ width: size, height: size * 1.6, backgroundColor: color, borderRadius: 1 }} />
        )}
      </Animated.View>
    );
  });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 50 }]}>
      {pieces}
    </View>
  );
}
