import { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { uploadImage } from "@/lib/api";
import { useTheme } from "@/theme";

/**
 * Tap to pick an image from the library, uploads it, and reports the public URL
 * back via onChange. Mirrors the web logo/photo upload.
 */
export function ImageField({ label, value, onChange, category }: {
  label: string;
  value?: string | null;
  onChange: (url: string | null) => void;
  category: "team_logo" | "player_photo" | "match_image";
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async () => {
    setErr(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setErr("Photo permission denied."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const url = await uploadImage(res.assets[0].uri, category);
      onChange(url);
    } catch {
      setErr("Upload failed. Try a smaller image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: t.muted, fontSize: 12, fontWeight: "700", marginBottom: 4 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {value ? (
          <Image source={{ uri: value }} style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: t.bg }} />
        ) : (
          <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.muted, fontSize: 20 }}>🖼️</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={pick}
          disabled={busy}
          style={{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 10, opacity: busy ? 0.6 : 1 }}
        >
          <Text style={{ color: t.text, fontWeight: "700" }}>{busy ? "Uploading…" : value ? "Change image" : "Pick image"}</Text>
        </TouchableOpacity>
        {value ? (
          <TouchableOpacity onPress={() => onChange(null)} disabled={busy}>
            <Text style={{ color: "#ef4444", fontWeight: "700" }}>Remove</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {err && <Text style={{ color: "#ef4444", marginTop: 6, fontSize: 12 }}>{err}</Text>}
    </View>
  );
}
