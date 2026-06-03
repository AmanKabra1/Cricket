import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { login } from "@/api/auth";
import { Btn } from "@/components/ui";
import { success, warn } from "@/lib/haptics";
import { useTheme } from "@/theme";

export default function Login() {
  const t = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      success();
      await qc.invalidateQueries({ queryKey: ["me"] });
      if (router.canGoBack()) router.back();
      else router.replace("/");
    } catch (e: any) {
      warn();
      // Distinguish wrong credentials from a network/server-asleep problem.
      if (e?.response?.status === 401) setError("Incorrect email or password.");
      else if (e?.response) setError(e.response.data?.detail ?? "Sign-in failed. Try again.");
      else setError("Can't reach the server (it may be waking up). Try again in a moment.");
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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
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
      <View style={{ position: "relative", justifyContent: "center" }}>
        <TextInput
          style={[inputStyle, { paddingRight: 44 }]}
          placeholder="Password"
          placeholderTextColor={t.muted}
          secureTextEntry={!showPw}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity
          onPress={() => setShowPw((s) => !s)}
          style={{ position: "absolute", right: 12, top: 12 }}
          accessibilityLabel={showPw ? "Hide password" : "Show password"}
        >
          <Text style={{ fontSize: 18 }}>{showPw ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={{ color: t.text, backgroundColor: "#ef444422", padding: 8, borderRadius: 8, marginBottom: 12 }}>{error}</Text>}

      <Btn
        label={busy ? "Signing in…" : "Sign in"}
        onPress={submit}
        loading={busy}
        disabled={!email || !password}
      />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
