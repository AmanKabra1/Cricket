import { useEffect } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { api } from "@/lib/api";

// Expo Go (SDK 53+) can't do remote push and even *importing* expo-notifications
// there throws. So we detect Expo Go and skip push entirely, and we import
// expo-notifications/expo-device dynamically (only in a dev/standalone build).
const isExpoGo = Constants.executionEnvironment === "storeClient";

/**
 * Registers this device's Expo push token with the backend so it receives
 * match-live / result alerts. No-ops in Expo Go and on simulators.
 */
export function usePushRegistration() {
  useEffect(() => {
    if (isExpoGo) return; // push needs a development or production build
    let tapSub: { remove: () => void } | undefined;
    (async () => {
      try {
        const Device = await import("expo-device");
        if (!Device.isDevice) return;
        const Notifications = await import("expo-notifications");

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        // Tapping a match notification opens that Match Centre. Also handles the
        // case where the app was cold-started by tapping a notification.
        const openFromData = (data: unknown) => {
          const id = (data as { matchId?: number | string } | null)?.matchId;
          if (id != null) router.push(`/match/${id}`);
        };
        tapSub = Notifications.addNotificationResponseReceivedListener((r) =>
          openFromData(r.notification.request.content.data),
        );
        const last = await Notifications.getLastNotificationResponseAsync();
        if (last) openFromData(last.notification.request.content.data);
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Match alerts",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== "granted") status = (await Notifications.requestPermissionsAsync()).status;
        if (status !== "granted") return;

        const projectId =
          (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
        const token = (
          await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
        ).data;
        if (token) await api.post("/push/register", { token });
      } catch {
        /* best-effort — never block app startup on push setup */
      }
    })();
    return () => tapSub?.remove();
  }, []);
}
