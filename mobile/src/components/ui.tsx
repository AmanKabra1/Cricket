import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme";
import { tap } from "@/lib/haptics";

export function Screen({ children, onRefresh, refreshing }: {
  children: React.ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const t = useTheme();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "transparent" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={t.primary} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12, ...style }}>
      {children}
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={{ color: t.muted, marginBottom: 10 }}>{children}</Text>;
}

export function Field({ label, value, onChangeText, placeholder, keyboardType, secure }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "numeric" | "email-address"; secure?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <TextInput
        style={{ backgroundColor: t.bg, color: t.text, borderColor: t.border, borderWidth: 1, borderRadius: 10, padding: 10 }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.muted}
        keyboardType={keyboardType ?? "default"}
        secureTextEntry={secure}
        autoCapitalize={keyboardType === "email-address" ? "none" : "sentences"}
      />
    </View>
  );
}

export function Btn({ label, onPress, disabled, loading, tone = "primary", style }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  tone?: "primary" | "ghost" | "danger"; style?: object;
}) {
  const t = useTheme();
  const bg = tone === "danger" ? "#ef4444" : tone === "ghost" ? "transparent" : t.primary;
  const fg = tone === "ghost" ? t.text : "#fff";
  const blocked = disabled || loading;
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      disabled={blocked}
      android_ripple={tone === "ghost" ? undefined : { color: "rgba(255,255,255,0.25)", borderless: false }}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderColor: t.border,
        borderWidth: tone === "ghost" ? 1 : 0,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
        justifyContent: "center",
        opacity: blocked ? 0.55 : pressed ? 0.9 : 1,
        transform: [{ scale: pressed && !blocked ? 0.98 : 1 }],
        ...style,
      })}
    >
      {loading && <ActivityIndicator size="small" color={fg} />}
      <Text style={{ color: fg, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress, loading }: {
  label: string; selected: boolean; onPress: () => void; loading?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      disabled={loading}
      style={({ pressed }) => ({
        backgroundColor: selected ? t.primary : t.surface,
        borderColor: selected ? t.primary : t.border,
        borderWidth: 1,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 6,
        marginBottom: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        opacity: loading ? 0.6 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      {loading && <ActivityIndicator size="small" color={selected ? "#fff" : t.primary} />}
      <Text style={{ color: selected ? "#fff" : t.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" | "ok" }) {
  const t = useTheme();
  const color = tone === "error" ? "#ef4444" : tone === "ok" ? t.primary : t.muted;
  return <Text style={{ color, marginVertical: 8 }}>{children}</Text>;
}
