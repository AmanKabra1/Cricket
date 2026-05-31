import Constants from "expo-constants";

// Android emulator reaches the host machine via 10.0.2.2; iOS sim uses localhost.
// Override per build via app.json -> expo.extra, or an EAS env.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  apiBaseUrl?: string;
  socketUrl?: string;
};

export const API_BASE_URL = extra.apiBaseUrl ?? "http://10.0.2.2:8000/api/v1";
export const SOCKET_URL = extra.socketUrl ?? "http://10.0.2.2:8000";
