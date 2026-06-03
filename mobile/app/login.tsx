import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { login } from "@/api/auth";
import { useTheme } from "@/theme";

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    backgroundColor: t.surface,
    color: t.text,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 20, justifyContent: "center" }}>
      <Text style={{ color: t.text, fontSize: 24, fontWeight: "800", marginBottom: 4 }}>Admin sign in</Text>
      <Text style={{ color: t.muted, marginBottom: 20 }}>Sign in to score your matches.</Text>

      <TextInput
        style={inputStyle}
        placeholder="Email"
        placeholderTextColor={t.muted}
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={inputStyle}
        placeholder="Password"
        placeholderTextColor={t.muted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={{ color: t.text, backgroundColor: "#ef444422", padding: 8, borderRadius: 8, marginBottom: 12 }}>{error}</Text>}

      <TouchableOpacity
        onPress={submit}
        disabled={busy || !email || !password}
        style={{ backgroundColor: t.primary, padding: 14, borderRadius: 10, alignItems: "center", opacity: busy || !email || !password ? 0.6 : 1 }}
      >
        <Text style={{ color: "#fff", fontWeight: "700" }}>{busy ? "Signing in…" : "Sign in"}</Text>
      </TouchableOpacity>
    </View>
  );
}
