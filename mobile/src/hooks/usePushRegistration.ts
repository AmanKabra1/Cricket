import { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { api } from "@/lib/api";

// Show notifications while the app is foregrounded too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for notification permission, gets the Expo push token, and registers it
 * with the backend so this device receives match-live / result alerts.
 * No-ops on simulators and in Expo Go (remote push needs a dev/standalone build).
 */
export function usePushRegistration() {
  useEffect(() => {
    (async () => {
      try {
        if (!Device.isDevice) return; // push only works on physical devices
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Match alerts",
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== "granted") {
          status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== "granted") return;

        const projectId =
          Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        const token = (
          await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
        ).data;
        if (token) await api.post("/push/register", { token });
      } catch {
        /* best-effort — never block app startup on push setup */
      }
    })();
  }, []);
}
