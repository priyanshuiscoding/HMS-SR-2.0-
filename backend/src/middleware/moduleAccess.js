import { getUserAccessById } from "../modules/users/users.repository.js";

// Runs after `authenticate` on every /api/v1 request. It reads the caller's live
// role, active status, and granted modules straight from the database so that an
// admin granting/revoking access (or deactivating a user) takes effect immediately
// on the next request — the JWT is not trusted for authorization state.
export async function attachModuleAccess(req, res, next) {
  try {
    if (!req.user?.sub) {
      return res.status(401).json({ message: "Authentication required." });
    }

    const access = await getUserAccessById(req.user.sub);

    if (!access || access.isActive === false) {
      return res.status(401).json({ message: "Your account is no longer active. Please sign in again." });
    }

    req.user.role = access.role;
    req.user.grantedModules = access.grantedModules;
    return next();
  } catch (error) {
    return next(error);
  }
}
