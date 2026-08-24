import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { AppRoutes } from "./routes/AppRoutes.jsx";
import { getCurrentUser } from "./services/api.js";
import { selectAuth, setUser } from "./store/authSlice.js";

export default function App() {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector(selectAuth);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    // Refresh the stored user (role + granted modules) so admin-side access
    // changes take effect without requiring a full re-login. Failures are
    // ignored here; the 401 handler in the API layer covers expired sessions.
    const refreshUser = () => getCurrentUser()
      .then((response) => {
        if (response?.user) {
          dispatch(setUser(response.user));
        }
      })
      .catch(() => {});

    refreshUser();
    window.addEventListener("focus", refreshUser);
    const refreshInterval = window.setInterval(refreshUser, 30000);

    return () => {
      window.removeEventListener("focus", refreshUser);
      window.clearInterval(refreshInterval);
    };
  }, [dispatch, isAuthenticated]);

  return <AppRoutes />;
}
