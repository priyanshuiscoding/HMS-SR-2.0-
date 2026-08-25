// Derives the module key from the router mount path, e.g. "/api/v1/billing" -> "billing".
// This matches the `key` values in accessModules (config/constants.js).
function moduleFromBaseUrl(baseUrl = "") {
  return baseUrl.split("/").filter(Boolean).pop() || "";
}

const privilegedModules = new Set(["users", "hr", "settings"]);

function hasGrantedModuleAccess(req) {
  const moduleKey = moduleFromBaseUrl(req.baseUrl);
  const grantedModules = req.user?.grantedModules || [];

  return Boolean(moduleKey) && !privilegedModules.has(moduleKey) && grantedModules.includes(moduleKey);
}

function hasDoctorModuleAccess(req) {
  const moduleKey = moduleFromBaseUrl(req.baseUrl);
  return req.user?.role === "doctor" && Boolean(moduleKey) && !privilegedModules.has(moduleKey);
}

export function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    // Pass if the user's base role is allowed on this route...
    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // Doctors can read every operational module, but never HR or User
    // Management. Other roles can receive operational modules from an admin.
    if (hasDoctorModuleAccess(req) || hasGrantedModuleAccess(req)) {
      return next();
    }

    return res.status(403).json({ message: "You do not have access to this resource." });
  };
}

export function authorizeRolesOnly(allowedRoles = [], { allowGrantedModule = true } = {}) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required." });
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    // A manual module grant includes that module's normal workflow actions.
    // HR and User Management remain privileged regardless of grants.
    if (allowGrantedModule && hasGrantedModuleAccess(req)) {
      return next();
    }

    return res.status(403).json({ message: "You do not have access to this resource." });
  };
}
