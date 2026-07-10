import { createSlice } from "@reduxjs/toolkit";

const storedAuth = (() => {
  try {
    const raw = window.localStorage.getItem("hms-auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
})();

const authSlice = createSlice({
  name: "auth",
  initialState: storedAuth || {
    isAuthenticated: false,
    accessToken: null,
    refreshToken: null,
    user: null
  },
  reducers: {
    setAuth(_state, action) {
      const nextState = {
        isAuthenticated: true,
        accessToken: action.payload.accessToken,
        refreshToken: action.payload.refreshToken,
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
        refreshToken: null,
        user: null
      };
    }
  }
});

export const { setAuth, setUser, clearAuth } = authSlice.actions;
export const selectAuth = (state) => state.auth;
export default authSlice.reducer;
