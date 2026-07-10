// Derives the module key from the router mount path, e.g. "/api/v1/billing" -> "billing".
// This matches the `key` values in accessModules (config/constants.js).
function moduleFromBaseUrl(baseUrl = "") {
  return baseUrl.split("/").filter(Boolean).pop() || "";
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

    // ...or if an admin has granted them access to this whole module.
    const moduleKey = moduleFromBaseUrl(req.baseUrl);
    const grantedModules = req.user.grantedModules || [];

    if (moduleKey && grantedModules.includes(moduleKey)) {
      return next();
    }

    return res.status(403).json({ message: "You do not have access to this resource." });
  };
}
