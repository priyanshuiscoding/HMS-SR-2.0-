import { createSlice } from "@reduxjs/toolkit";

const storedAuth = (() => {
  try {
    const raw = window.localStorage.getItem("hms-auth");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed
      ? {
        isAuthenticated: Boolean(parsed.accessToken && parsed.user),
        accessToken: parsed.accessToken || null,
        user: parsed.user || null
      }
      : null;
  } catch {
    return null;
  }
})();

const authSlice = createSlice({
  name: "auth",
  initialState: storedAuth || {
    isAuthenticated: false,
    accessToken: null,
    user: null
  },
  reducers: {
    setAuth(_state, action) {
      const nextState = {
        isAuthenticated: true,
        accessToken: action.payload.accessToken,
        user: action.payload.user
      };

      window.localStorage.setItem("hms-auth", JSON.stringify(nextState));
      return nextState;
    },
    setUser(state, action) {
      if (!state.isAuthenticated) {
        return state;
      }

      const nextState = { ...state, user: action.payload };
      window.localStorage.setItem("hms-auth", JSON.stringify(nextState));
      return nextState;
    },
    clearAuth() {
      window.localStorage.removeItem("hms-auth");
      return {
        isAuthenticated: false,
        accessToken: null,
        user: null
      };
    }
  }
});

export const { setAuth, setUser, clearAuth } = authSlice.actions;
export const selectAuth = (state) => state.auth;
export default authSlice.reducer;
