import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth.js";
import { canAccess, moduleKeyForPath } from "../utils/accessModules.js";

export function ProtectedRoute({ children, allowedRoles }) {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const allowed = canAccess({
    role: user?.role,
    grantedModules: user?.grantedModules || [],
    allowedRoles,
    moduleKey: moduleKeyForPath(location.pathname)
  });

  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}
