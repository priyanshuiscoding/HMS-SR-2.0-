import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "../router.jsx";

import { clearAuth, selectAuth, setAuth } from "../store/authSlice.js";
import { logoutRequest } from "../services/api.js";

export function useAuth() {
  const auth = useSelector(selectAuth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return {
    ...auth,
    login(payload) {
      dispatch(setAuth(payload));
      navigate("/");
    },
    async logout() {
      try {
        await logoutRequest();
      } finally {
        dispatch(clearAuth());
        navigate("/login");
      }
    }
  };
}
