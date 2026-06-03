import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/theme";

export function Screen({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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

export function Btn({ label, onPress, disabled, tone = "primary", style }: {
  label: string; onPress: () => void; disabled?: boolean; tone?: "primary" | "ghost" | "danger"; style?: object;
}) {
  const t = useTheme();
  const bg = tone === "danger" ? "#ef4444" : tone === "ghost" ? "transparent" : t.primary;
  const fg = tone === "ghost" ? t.text : "#fff";
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={{ backgroundColor: bg, borderColor: t.border, borderWidth: tone === "ghost" ? 1 : 0, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", opacity: disabled ? 0.6 : 1, ...style }}
    >
      <Text style={{ color: fg, fontWeight: "700" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ backgroundColor: selected ? t.primary : t.surface, borderColor: selected ? t.primary : t.border, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, marginRight: 6, marginBottom: 6 }}
    >
      <Text style={{ color: selected ? "#fff" : t.text, fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "error" | "ok" }) {
  const t = useTheme();
  const color = tone === "error" ? "#ef4444" : tone === "ok" ? t.primary : t.muted;
  return <Text style={{ color, marginVertical: 8 }}>{children}</Text>;
}
