import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme";

export function Loading({ label }: { label?: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={t.primary} />
      {label ? <Text style={{ color: t.muted, marginTop: 8 }}>{label}</Text> : null}
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <Text style={{ color: t.muted, textAlign: "center" }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
});
