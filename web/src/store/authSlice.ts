import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { api, tokenStore } from "@/lib/api";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: tokenStore.access ? "loading" : "idle",
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async (creds: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post("/auth/login", creds);
      tokenStore.set(data.access_token, data.refresh_token);
      const me = await api.get<User>("/auth/me");
      return me.data;
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ??
        "Login failed";
      return rejectWithValue(msg);
    }
  },
);

export const loadCurrentUser = createAsyncThunk("auth/me", async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<User>("/auth/me");
    return data;
  } catch {
    tokenStore.clear();
    return rejectWithValue(null);
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      tokenStore.clear();
      state.user = null;
      state.status = "idle";
    },
  },
  extraReducers: (b) => {
    b.addCase(login.pending, (s) => {
      s.status = "loading";
      s.error = null;
    })
      .addCase(login.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = "authenticated";
      })
      .addCase(login.rejected, (s, a) => {
        s.status = "error";
        s.error = (a.payload as string) ?? "Login failed";
      })
      .addCase(loadCurrentUser.fulfilled, (s, a) => {
        s.user = a.payload;
        s.status = "authenticated";
      })
      .addCase(loadCurrentUser.rejected, (s) => {
        s.user = null;
        s.status = "idle";
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
