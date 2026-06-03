import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "@/config";

const ACCESS_KEY = "localscore.access";
const REFRESH_KEY = "localscore.refresh";

let accessToken: string | null = null;

export const tokenStore = {
  async load() {
    accessToken = await AsyncStorage.getItem(ACCESS_KEY);
    return accessToken;
  },
  async set(access: string, refresh: string) {
    accessToken = access;
    await AsyncStorage.multiSet([
      [ACCESS_KEY, access],
      [REFRESH_KEY, refresh],
    ]);
  },
  async clear() {
    accessToken = null;
    await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
  },
  get current() {
    return accessToken;
  },
};

// 35s: the free-tier backend can take ~30s to wake from idle (cold start); a
// 10s timeout would fail every first request after the server has slept.
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 35_000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;
      const refresh = await AsyncStorage.getItem(REFRESH_KEY);
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refresh,
          });
          await tokenStore.set(data.access_token, data.refresh_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
          await tokenStore.clear();
        }
      }
    }
    return Promise.reject(error);
  },
);

export const get = async <T>(url: string): Promise<T> => (await api.get<T>(url)).data;
