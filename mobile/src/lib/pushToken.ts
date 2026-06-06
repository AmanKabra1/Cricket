import AsyncStorage from "@react-native-async-storage/async-storage";

// The device's Expo push token, persisted so the follow feature can target
// notifications to this device. Set by usePushRegistration once granted.
const KEY = "expoPushToken";
let cached: string | null = null;

export async function setPushToken(token: string): Promise<void> {
  cached = token;
  await AsyncStorage.setItem(KEY, token);
}

export async function getPushToken(): Promise<string | null> {
  if (cached) return cached;
  cached = await AsyncStorage.getItem(KEY);
  return cached;
}
